import { app } from '../../scripts/app.js';
// CSS is loaded as a stylesheet: browsers do not support ordinary CSS ESM imports.
const stylesheetHref = new URL('./tab-manager.css', import.meta.url).href;
if (!document.querySelector('link[data-ctm-styles]')) {
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = stylesheetHref;
  stylesheet.dataset.ctmStyles = '1';
  document.head.append(stylesheet);
}

/**
 * ComfyUI Tab Manager v1.1.1
 * Scope: *open* workflow tabs in the TOP bar. No workflow files or backend code modified.
 * Reads the actual rendered workflow tabs from the ComfyUI top bar, then forwards
 * native click, close, and contextmenu events (preserving standard ComfyUI actions).
 * Supports both the legacy (<= 1.55.x, data-workflow-path in the DOM) and the
 * current (Reka UI Tabs + workflow store) top-bar layouts.
 */
(() => {
  const ID = 'ComfyUI Tab Manager';
  const STORAGE = 'ComfyUI.TabManager.v1';
  const LEGACY_STORAGE = 'ComfyUI.ChromeTabGroups.v1';
  const BACKUP_STORAGE = 'ComfyUI.TabManager.LegacyBackup.v1';
  const COLORS = ['#a593ff', '#ff779a', '#faac55', '#ffe178', '#62d6b2', '#6aaeff', '#df91e8', '#ff6969', '#a8b0c2'];
  const SELECTOR = '.workflow-tabs-container';
  const VERSION = '1.1.1';
  // Both supported top-bar layouts render every open workflow tab as:
  //   [data-testid="workflow-tab"]
  // Legacy frontends (<= 1.55.x, PrimeVue) stamp the exact workflow path on
  // that node as `data-workflow-path`. Current frontends (Reka UI "Tabs") no
  // longer put the path in the DOM, so it is resolved from the official
  // extension API (`app.extensionManager.workflow`, the workflow store).
  const TAB_SELECTOR = '[data-testid="workflow-tab"]';
  const LEGACY_PATH_ATTR = 'data-workflow-path';
  const cssSafe = (v) => String(v ?? '');
  let state = { groups: [], assignments: {}, ui: { createButtonColor: null } };
  let root = null;
  let bar = null;
  let nativeStrip = null;
  let nativeHost = null;
  let nativeObserver = null;
  let bodyObserver = null;
  let timer = null;
  let renderQueued = false;
  let lastSignature = '';
  let popover = null;
  let dragPath = null;
  let dragGroupId = null;
  let dragEndTime = 0;
  let lastConnectProblem = '';
  let warnedMissingCss = false;
  let warnedFilenameOnly = false;
  let detectionMode = 'inactive';
  let nodeByPath = new Map();
  let pathByNode = new WeakMap();
  const oldPaths = new WeakMap();
  // The original ComfyUI context menu exposes mass-closing actions based on the
  // *native* tab order, not the visual group order. Never expose those actions
  // through a forwarded contextmenu event.
  const BLOCKED_NATIVE_ACTIONS = new Set([
    'close tab', 'close tabs to left', 'close tabs to right', 'close other tabs',
    'close tabs to the left', 'close tabs to the right'
  ]);
  // Fail closed for unrecognized actions inside the native workflow context menu.
  // This protects future ComfyUI releases from newly introduced bulk actions.
  const ALLOWED_NATIVE_ACTIONS = new Set([
    'rename', 'duplicate', 'add to bookmarks', 'remove from bookmarks',
    'save', 'save as', 'export', 'export (api)', 'clear workflow'
  ]);
  let nativeMenuGuardActive = false;
  let nativeMenuGuardObserver = null;

  function normalizedMenuText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }
  function nativeMenuItems() {
    return document.querySelectorAll('[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]');
  }
  function isDangerousNativeItem(element) {
    if (!(element instanceof Element)) return false;
    const item = element.closest('[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]');
    if (!item) return false;
    const value = normalizedMenuText(item.getAttribute('aria-label') || item.textContent);
    if (BLOCKED_NATIVE_ACTIONS.has(value)) return true;
    const menu = item.closest('[role="menu"]');
    if (!menu) return false;
    const labels = [...menu.querySelectorAll('[role^="menuitem"]')]
      .map(node => normalizedMenuText(node.getAttribute('aria-label') || node.textContent));
    const looksLikeWorkflowMenu = labels.includes('rename') && labels.includes('duplicate') && labels.includes('save');
    return looksLikeWorkflowMenu && !ALLOWED_NATIVE_ACTIONS.has(value);
  }
  function protectNativeMenu() {
    if (!nativeMenuGuardActive) return;
    for (const item of nativeMenuItems()) {
      if (!isDangerousNativeItem(item)) continue;
      item.setAttribute('data-ctm-blocked-close', 'true');
      item.setAttribute('aria-disabled', 'true');
      item.setAttribute('tabindex', '-1');
    }
  }
  function preventDangerousNativeAction(event) {
    if (!nativeMenuGuardActive || !isDangerousNativeItem(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();
    console.warn('[ComfyUI Tab Manager] Blocked unsafe native tab-closing menu command. Use the individual tab X instead.');
  }
  function enableNativeMenuGuard() {
    if (!nativeMenuGuardActive) {
      nativeMenuGuardActive = true;
      for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'auxclick', 'touchstart', 'touchend', 'keydown', 'keyup']) {
        document.addEventListener(type, preventDangerousNativeAction, true);
      }
      // Portaled native menus can be mounted asynchronously by Reka UI.
      nativeMenuGuardObserver = new MutationObserver(protectNativeMenu);
      nativeMenuGuardObserver.observe(document.body, { childList: true, subtree: true });
    }
    protectNativeMenu();
  }

  function readState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE) || localStorage.getItem(LEGACY_STORAGE) || '{}');
      const groups = Array.isArray(saved.groups) ? saved.groups : [];
      const assignments = saved.assignments && typeof saved.assignments === 'object' && !Array.isArray(saved.assignments) ? saved.assignments : {};
      const seen = new Set();
      const cleaned = groups.filter(g => g && typeof g.id === 'string' && !seen.has(g.id) && seen.add(g.id)).map(g => ({
        id: g.id, name: cssSafe(g.name || 'New Group').slice(0, 80),
        color: /^#[0-9a-fA-F]{6}$/.test(g.color) ? g.color : COLORS[0],
        collapsed: Boolean(g.collapsed),
        parentId: typeof g.parentId === 'string' ? g.parentId : null
      }));
      // Legacy flat groups without parentId migrate to root groups,
      // keeping existing order, names, colors, collapse state and tab assignments.
      const byId = new Map(cleaned.map(g => [g.id, g]));
      for (const group of cleaned) {
        const visited = new Set([group.id]);
        let parent = group.parentId;
        while (parent !== null) {
          if (!byId.has(parent) || visited.has(parent)) { group.parentId = null; break; }
          visited.add(parent);
          parent = byId.get(parent).parentId;
        }
      }
      state = {
        groups: cleaned,
        assignments: Object.fromEntries(Object.entries(assignments).filter(([key, val]) => typeof key === 'string' && typeof val === 'string')),
        ui: { createButtonColor: /^#[0-9a-fA-F]{6}$/.test(saved.ui?.createButtonColor) ? saved.ui.createButtonColor : null }
      };
    } catch (err) {
      console.warn('[ComfyUI Tab Manager] Cannot read saved groups:', err);
      state = { groups: [], assignments: {}, ui: { createButtonColor: null } };
    }
  }
  function persist() {
    try { localStorage.setItem(STORAGE, JSON.stringify(state)); }
    catch (err) { console.warn('[ComfyUI Tab Manager] Cannot save groups:', err); }
  }
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = String(text);
    return e;
  }
  function button(text, cls, fn, title) {
    const b = el('button', cls, text);
    b.type = 'button';
    if (title) b.title = title;
    if (fn) b.addEventListener('click', fn);
    return b;
  }
  // Read the open workflows from the official extension API.
  // `app.extensionManager.workflow` is ComfyUI's workflow store; its
  // `openWorkflows` array is the exact source the top bar renders tabs from
  // (v-for over the same array, so DOM order always matches). Entries are
  // copied into plain objects because the store exposes class instances.
  function storeWorkflows() {
    try {
      const list = app.extensionManager?.workflow?.openWorkflows;
      if (!Array.isArray(list)) return [];
      const result = [];
      for (const w of list) {
        const path = typeof w?.path === 'string' ? w.path : '';
        if (!path) continue;
        const filename = typeof w?.filename === 'string' && w.filename
          ? w.filename
          : path.split('/').pop() || path;
        result.push({
          path, filename,
          isModified: !!w?.isModified,
          isPersisted: w?.isPersisted !== false
        });
      }
      return result;
    } catch (err) {
      console.warn('[ComfyUI Tab Manager] Cannot read the workflow store:', err);
      return [];
    }
  }
  function nativeTabs() {
    return nativeStrip ? [...nativeStrip.querySelectorAll(TAB_SELECTOR)] : [];
  }
  function tabFilename(node) {
    return node.querySelector('.workflow-label')?.textContent?.trim() || '';
  }
  function tabDirty(node) {
    return !!node.querySelector('[data-testid="workflow-dirty-indicator"]');
  }
  // Resolve every rendered native tab node to a workflow entry, in tab order.
  // An entry is null when that node's workflow path could not be resolved.
  // Also refreshes the node <-> path lookup tables used by getNativeTab().
  function mapTabs(nodes) {
    nodeByPath = new Map();
    pathByNode = new WeakMap();
    if (!nodes.length) {
      detectionMode = 'empty';
      return [];
    }
    const register = (node, wf) => {
      nodeByPath.set(wf.path, node);
      pathByNode.set(node, wf);
      return wf;
    };
    // Legacy layout: the workflow path is stamped on the node itself.
    if (nodes.every(node => node.hasAttribute(LEGACY_PATH_ATTR))) {
      detectionMode = 'legacy';
      return nodes.map(node => {
        const path = node.getAttribute(LEGACY_PATH_ATTR);
        const filename = tabFilename(node) || path.split('/').pop() || path;
        return register(node, { path, filename, isModified: tabDirty(node), isPersisted: true });
      });
    }
    const store = storeWorkflows();
    // Current layout: the DOM no longer exposes the workflow path, so mirror
    // the workflow store by tab order. Sanity-check the positional mapping
    // with at least one matching filename before trusting it.
    if (store.length === nodes.length &&
        nodes.some((node, i) => store[i].filename === tabFilename(node))) {
      detectionMode = 'store';
      return nodes.map((node, i) =>
        register(node, { ...store[i], isModified: store[i].isModified || tabDirty(node) }));
    }
    // Fallback: match tabs to store entries by visible filename; the first
    // unused entry with that name wins (deterministic even with duplicates).
    if (store.length) {
      detectionMode = 'filename';
      const used = new Set();
      return nodes.map(node => {
        const wf = store.find(s => !used.has(s.path) && s.filename === tabFilename(node));
        if (!wf) return null;
        used.add(wf.path);
        return register(node, { ...wf, isModified: wf.isModified || tabDirty(node) });
      });
    }
    // Last resort when the store is unavailable: key tabs by their visible
    // filename. Grouping still works; saved path-keyed assignments simply
    // cannot match these tabs.
    detectionMode = 'filename-only';
    if (!warnedFilenameOnly) {
      warnedFilenameOnly = true;
      console.warn('[ComfyUI Tab Manager] Workflow store unavailable; identifying tabs by filename only.');
    }
    return nodes.map(node => {
      const filename = tabFilename(node) || 'Untitled Workflow';
      return register(node, { path: filename, filename, isModified: tabDirty(node), isPersisted: false });
    });
  }
  function workflows() {
    return mapTabs(nativeTabs()).filter(Boolean);
  }
  function nativeToggle(tab) {
    if (!tab) return null;
    // Reka UI layout: the tab trigger is a descendant of the tab node.
    // Legacy PrimeVue layout: the tab node sits inside the toggle button.
    return tab.querySelector('[role="tab"]') || tab.querySelector('button')
      || tab.closest('button') || tab.closest('[role="tab"]') || null;
  }
  function activePath() {
    // Prefer the workflow store's own notion of the active workflow; it is
    // more reliable than DOM state sniffing on every frontend version.
    try {
      const active = app.extensionManager?.workflow?.activeWorkflow;
      if (active?.path) return active.path;
    } catch (err) { /* fall through to DOM sniffing */ }
    for (const node of nativeTabs()) {
      const toggle = nativeToggle(node);
      if (!toggle) continue;
      const pressed = toggle.getAttribute('aria-pressed');
      const stateAttr = toggle.getAttribute('data-state');
      if (pressed === 'true' || stateAttr === 'on' || stateAttr === 'active' ||
          toggle.getAttribute('aria-selected') === 'true' ||
          toggle.classList.contains('p-togglebutton-checked') ||
          toggle.classList.contains('p-highlight')) {
        return node.getAttribute(LEGACY_PATH_ATTR) || pathByNode.get(node)?.path || null;
      }
    }
    // Most builds expose the active tab on its button; if a theme hides that,
    // the grouping remains fully functional, just without active highlights.
    return null;
  }
  function getNativeTab(path) {
    const mapped = nodeByPath.get(path);
    if (mapped && mapped.isConnected) return mapped;
    // Vue may have re-rendered the native strip since the last render pass,
    // leaving detached nodes in the lookup table. Re-derive the mapping from
    // the live DOM before giving up.
    if (mapped) {
      mapTabs(nativeTabs());
      const refreshed = nodeByPath.get(path);
      if (refreshed && refreshed.isConnected) return refreshed;
      return null;
    }
    // Legacy layout lookup (and a fresh scan if the map is not populated yet).
    return nativeTabs().find(tab => tab.getAttribute(LEGACY_PATH_ATTR) === path) || null;
  }
  // The current ComfyUI frontend (Reka UI Tabs) activates a tab on MOUSEDOWN
  // (TabsTrigger handles @mousedown.left / @keydown.enter.space, NOT click).
  // Legacy frontends activate on click. Dispatch the full pointer sequence so
  // both layouts switch workflows — a bare `trigger.click()` only satisfies the
  // legacy path, which is why tab clicks silently did nothing on the new UI.
  function activateNativeTab(trigger) {
    const rect = trigger.getBoundingClientRect();
    const init = {
      bubbles: true, cancelable: true, composed: true, view: window,
      button: 0, buttons: 1, detail: 1,
      ctrlKey: false, shiftKey: false, altKey: false, metaKey: false,
      clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2
    };
    trigger.dispatchEvent(new PointerEvent('pointerdown', { ...init, pointerId: 1, pointerType: 'mouse', isPrimary: true }));
    trigger.dispatchEvent(new MouseEvent('mousedown', init));
    trigger.dispatchEvent(new PointerEvent('pointerup', { ...init, buttons: 0, pointerId: 1, pointerType: 'mouse', isPrimary: true }));
    trigger.dispatchEvent(new MouseEvent('mouseup', { ...init, buttons: 0 }));
    trigger.dispatchEvent(new MouseEvent('click', init));
  }
  // Direct fallback through the official workflow store, used when the native
  // tab strip is momentarily unavailable (e.g. mid-re-render).
  function openWorkflowViaStore(path) {
    try {
      const store = app.extensionManager?.workflow;
      const wf = store?.openWorkflows?.find(w => w.path === path);
      if (wf && typeof store.openWorkflow === 'function') {
        store.openWorkflow(wf);
        return true;
      }
    } catch (err) {
      console.warn('[ComfyUI Tab Manager] Cannot switch workflows through the store:', err);
    }
    return false;
  }
  function openWorkflow(path) {
    const native = getNativeTab(path);
    const trigger = nativeToggle(native);
    if (!trigger) {
      if (!openWorkflowViaStore(path)) {
        console.warn('[ComfyUI Tab Manager] Native tab unavailable:', path);
      }
      queueRender();
      return;
    }
    // ComfyUI's own tab handlers (Reka UI @mousedown / legacy @click) call
    // workflowService.openWorkflow.
    activateNativeTab(trigger);
    queueRender();
  }
  function openNativeWorkflowMenu(path, event) {
    const native = getNativeTab(path);
    if (!native) {
      console.warn('[ComfyUI Tab Manager] Cannot open original workflow menu: native tab is unavailable:', path);
      return false;
    }
    // Preserve native single-workflow actions while disabling all native Close Tab /
    // mass-close menu commands. These commands are unsafe from a grouped tab bar.
    removePopover();
    enableNativeMenuGuard();
    const point = event || native.getBoundingClientRect();
    const originalEvent = new MouseEvent('contextmenu', {
      bubbles: true, cancelable: true, composed: true,
      button: 2, buttons: 2,
      clientX: Number.isFinite(point.clientX) ? point.clientX : point.left,
      clientY: Number.isFinite(point.clientY) ? point.clientY : point.top,
      screenX: event?.screenX || 0,
      screenY: event?.screenY || 0,
      ctrlKey: !!event?.ctrlKey, shiftKey: !!event?.shiftKey,
      altKey: !!event?.altKey, metaKey: !!event?.metaKey
    });
    native.dispatchEvent(originalEvent);
    protectNativeMenu();
    return true;
  }

  function closeWorkflow(path) {
    const native = getNativeTab(path);
    const close = native?.querySelector('[data-testid="close-workflow-button"]');
    if (!close) { console.warn('[ComfyUI Tab Manager] Native close control unavailable:', path); return; }
    close.click(); // ComfyUI's own close flow, including save warnings.
    queueRender();
  }
  function assign(path, id) {
    if (id) state.assignments[path] = id;
    else delete state.assignments[path];
    persist(); render(true);
  }
  function groupFor(path) {
    const id = state.assignments[path];
    return state.groups.some(g => g.id === id) ? id : null;
  }
  function makeId() {
    if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
    return `ctm_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
  function removePopover() {
    if (!popover) return;
    popover.remove(); popover = null;
  }
  function addPopoverHeader(panel, heading) {
    const header = el('div', 'ctm-popover-header');
    const title = el('h3', 'ctm-popover-title', heading);
    title.title = heading;
    header.append(title);
    // This dismisses the popover only; it never closes a workflow tab.
    const dismiss = button('×', 'ctm-popover-dismiss', removePopover, 'Close this menu');
    dismiss.setAttribute('aria-label', 'Close this menu');
    header.append(dismiss);
    panel.append(header);
  }

  function showPopover(anchor, node) {
    removePopover();
    node.classList.add('ctm-popover');
    document.body.append(node);
    popover = node;
    const r = anchor.getBoundingClientRect();
    const w = node.offsetWidth || 280;
    const h = node.offsetHeight || 250;
    const x = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
    const y = r.bottom + 6 + h <= window.innerHeight ? r.bottom + 6 : Math.max(8, r.top - h - 6);
    node.style.left = `${x}px`; node.style.top = `${y}px`;
  }
  function outsideHandler(event) {
    if (popover && !popover.contains(event.target) && !event.target.closest('.ctm-bar')) removePopover();
  }
  function childrenOf(parentId) {
    return state.groups.filter(g => (g.parentId ?? null) === parentId);
  }
  function isDescendantGroup(possibleChildId, ancestorId) {
    const visited = new Set();
    let id = possibleChildId;
    while (id && !visited.has(id)) {
      if (id === ancestorId) return true;
      visited.add(id);
      id = state.groups.find(g => g.id === id)?.parentId ?? null;
    }
    return false;
  }
  function moveGroup(sourceId, targetId, mode = 'inside') {
    const source = state.groups.find(g => g.id === sourceId);
    if (!source || sourceId === targetId) return false;
    const target = targetId ? state.groups.find(g => g.id === targetId) : null;
    if (targetId && !target) return false;
    if (target && isDescendantGroup(target.id, source.id)) return false;
    const parentId = mode === 'root' ? null : mode === 'inside' ? targetId : target?.parentId ?? null;
    if (parentId && isDescendantGroup(parentId, sourceId)) return false;
    state.groups = state.groups.filter(g => g.id !== sourceId);
    source.parentId = parentId;
    if ((mode === 'before' || mode === 'after') && target) {
      const i = state.groups.findIndex(g => g.id === target.id);
      state.groups.splice(i + (mode === 'after' ? 1 : 0), 0, source);
    } else {
      // A new child goes at the end of its siblings. Root drops also append.
      state.groups.push(source);
    }
    persist(); render(true);
    return true;
  }
  function moveSibling(groupId, delta) {
    const group = state.groups.find(g => g.id === groupId);
    if (!group) return;
    const siblings = childrenOf(group.parentId ?? null);
    const i = siblings.findIndex(g => g.id === group.id);
    const target = siblings[i + delta];
    if (target) moveGroup(group.id, target.id, delta < 0 ? 'before' : 'after');
  }
  function showGroupEditor(anchor, groupId, newParentId = null) {
    const existing = state.groups.find(g => g.id === groupId);
    const parent = state.groups.find(g => g.id === newParentId);
    const panel = el('div');
    addPopoverHeader(panel, existing ? 'Edit Group' : parent ? `New Subgroup in \"${parent.name}\"` : 'New Tab Group');
    const lab = el('label', '', 'Name');
    const input = el('input'); input.type = 'text'; input.maxLength = 80;
    input.value = existing ? existing.name : '';
    input.placeholder = 'Enter a group name';
    lab.append(input); panel.append(lab);
    panel.append(el('label', '', 'Color'));
    const palette = el('div', 'ctm-palette');
    let selected = existing?.color || COLORS[0];
    const updateColor = () => [...palette.children].forEach((c, i) => c.classList.toggle('ctm-picked', COLORS[i] === selected));
    for (const c of COLORS) {
      const sw = button('', 'ctm-swatch', () => { selected = c; updateColor(); }, c);
      sw.style.background = c; palette.append(sw);
    }
    panel.append(palette); updateColor();
    const customColorLabel = el('label', 'ctm-custom-color-label', 'Custom Color');
    const colorPicker = el('input', 'ctm-color-picker');
    colorPicker.type = 'color'; colorPicker.value = selected;
    colorPicker.addEventListener('input', () => { selected = colorPicker.value; updateColor(); });
    palette.addEventListener('click', () => { colorPicker.value = selected; });
    customColorLabel.append(colorPicker); panel.append(customColorLabel);
    if (existing) {
      const tools = el('div', 'ctm-group-tools');
      tools.append(button('＋ Add Subgroup', 'ctm-action', () => showGroupEditor(anchor, null, groupId), 'Create a new group inside this group'));
      tools.append(button('← Move Left', 'ctm-action', () => { moveSibling(groupId, -1); removePopover(); }, 'Move left within the same level'));
      tools.append(button('Move Right →', 'ctm-action', () => { moveSibling(groupId, 1); removePopover(); }, 'Move right within the same level'));
      if (existing.parentId) {
        tools.append(button('↖ Top Level', 'ctm-action', () => { moveGroup(groupId, null, 'root'); removePopover(); }, 'Move subgroup back to the top level'));
      }
      panel.append(tools);
      panel.append(el('div', 'ctm-hint', 'Drag a group: left/right edge to reorder; center to nest it.'));
    }
    const actions = el('div', 'ctm-popover-actions');
    if (existing) {
      actions.append(button('Delete', 'ctm-action ctm-danger', () => {
        // Removing a folder never closes workflows or deletes any JSON files.
        // Child groups are promoted to the removed folder's parent level.
        for (const child of childrenOf(groupId)) child.parentId = existing.parentId ?? null;
        state.groups = state.groups.filter(g => g.id !== groupId);
        for (const [path, value] of Object.entries(state.assignments)) {
          if (value === groupId) delete state.assignments[path];
        }
        persist(); removePopover(); render(true);
      }, 'Delete this group only; subgroups are preserved'));
    }
    actions.append(button('Cancel', 'ctm-action', removePopover));
    function submit() {
      const name = input.value.trim();
      if (!name) { input.focus(); return; }
      if (existing) { existing.name = name; existing.color = selected; }
      else state.groups.push({ id: makeId(), name, color: selected, collapsed: false, parentId: parent?.id ?? null });
      persist(); removePopover(); render(true);
    }
    actions.append(button(existing ? 'Save' : 'Create', 'ctm-action ctm-primary', submit));
    panel.append(actions);
    input.addEventListener('keydown', event => { if (event.key === 'Enter') submit(); if (event.key === 'Escape') removePopover(); });
    showPopover(anchor, panel); input.focus(); input.select();
  }

  function showCreateButtonEditor(anchor) {
    const panel = el('div');
    addPopoverHeader(panel, 'Customize + Group Button');
    panel.append(el('label', '', 'Button Color'));
    const palette = el('div', 'ctm-palette');
    let selected = state.ui.createButtonColor || COLORS[0];
    const updateColor = () => [...palette.children].forEach((node, index) =>
      node.classList.toggle('ctm-picked', COLORS[index] === selected));
    for (const color of COLORS) {
      const swatch = button('', 'ctm-swatch', () => { selected = color; colorPicker.value = color; updateColor(); }, color);
      swatch.style.background = color;
      swatch.setAttribute('aria-label', `Choose ${color}`);
      palette.append(swatch);
    }
    panel.append(palette);
    updateColor();
    const customLabel = el('label', 'ctm-custom-color-label', 'Custom Color');
    const colorPicker = el('input', 'ctm-color-picker');
    colorPicker.type = 'color';
    colorPicker.value = selected;
    colorPicker.addEventListener('input', () => { selected = colorPicker.value; updateColor(); });
    customLabel.append(colorPicker);
    panel.append(customLabel);
    const actions = el('div', 'ctm-popover-actions');
    actions.append(button('Reset to Default', 'ctm-action ctm-danger', () => {
      state.ui.createButtonColor = null;
      persist(); removePopover(); render(true);
    }, 'Restore the original + Group button appearance'));
    actions.append(button('Cancel', 'ctm-action', removePopover));
    actions.append(button('Save', 'ctm-action ctm-primary', () => {
      state.ui.createButtonColor = selected;
      persist(); removePopover(); render(true);
    }));
    panel.append(actions);
    showPopover(anchor, panel);
  }
  function showTabMenu(anchor, path) {
    const panel = el('div');
    const item = workflows().find(w => w.path === path);
    addPopoverHeader(panel, item?.filename || path);
    panel.append(el('div', 'ctm-hint', 'Move to Group'));
    const active = groupFor(path);
    const ungroup = button(`${active === null ? '✓ ' : ''}Ungrouped`, 'ctm-choice', () => { assign(path, null); removePopover(); });
    panel.append(ungroup);
    for (const g of state.groups) {
      const depth = (() => { let n = 0, cur = g, guard = 0; while (cur?.parentId && guard++ < 32) { n++; cur = state.groups.find(x => x.id === cur.parentId); } return n; })();
      const choice = button(`${'↳ '.repeat(Math.min(depth, 4))}${active === g.id ? '✓ ' : ''}${g.name}`, 'ctm-choice', () => { assign(path, g.id); removePopover(); });
      const dot = el('span', 'ctm-mini-dot'); dot.style.background = g.color;
      choice.prepend(dot); panel.append(choice);
    }
    panel.append(el('div', 'ctm-hint', 'Workflow files are never moved.'));
    panel.append(el('div', 'ctm-hint', 'To close this menu, press × above. To close a workflow, use the × on its tab.'));
    showPopover(anchor, panel);
  }
  function toggleGroup(id) {
    const group = state.groups.find(g => g.id === id);
    if (!group) return;
    group.collapsed = !group.collapsed;
    persist(); render(true);
  }
  function tabNode(w, accent) {
    const selected = activePath() === w.path;
    const node = el('div', `ctm-tab${selected ? ' ctm-selected' : ''}`);
    node.style.setProperty('--ctm-accent', accent || '#a18eff');
    node.title = w.path;
    node.draggable = true;
    node.dataset.path = w.path;
    const main = button(w.filename || w.path.split('/').pop(), 'ctm-tab-main', () => openWorkflow(w.path));
    if (w.isModified || w.isPersisted === false) {
      const dot = el('span', 'ctm-dirty', '•'); main.append(dot);
    }
    const moveButton = button('▣', 'ctm-tab-group-button', event => {
      event.preventDefault(); event.stopPropagation();
      showTabMenu(moveButton, w.path);
    }, 'Move to Group');
    moveButton.setAttribute('aria-label', `Move ${w.filename || 'workflow'} to Group`);
    node.append(moveButton, main);
    node.append(button('×', 'ctm-tab-close', e => { e.stopPropagation(); closeWorkflow(w.path); }, 'Close tab (ComfyUI unsaved-change warnings are preserved)'));
    node.addEventListener('contextmenu', event => {
      event.preventDefault(); event.stopPropagation();
      if (event.shiftKey) showTabMenu(node, w.path);
      else openNativeWorkflowMenu(w.path, event);
    });
    // Restore native browser-style middle-click closing for exactly this workflow.
    // Let ComfyUI's own close button handle save warnings and other safety checks.
    // Prevent the browser's middle-click auto-scroll without closing on mousedown.
    node.addEventListener('mousedown', event => {
      if (event.button !== 1) return;
      event.preventDefault();
      event.stopPropagation();
    });
    node.addEventListener('auxclick', event => {
      if (event.button !== 1) return;
      event.preventDefault();
      event.stopPropagation();
      closeWorkflow(w.path);
    });
    node.addEventListener('dragstart', event => {
      event.stopPropagation();
      dragGroupId = null;
      dragPath = w.path;
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('application/x-comfy-tab-manager-path', w.path);
      event.dataTransfer.setData('text/plain', w.path);
    });
    node.addEventListener('dragend', () => { dragPath = null; cleanupDrag(); });
    return node;
  }
  const dragClasses = ['ctm-drag-over', 'ctm-drop-before', 'ctm-drop-after', 'ctm-drop-inside'];
  function cleanupDrag() {
    dragPath = null;
    dragGroupId = null;
    if (bar) bar.classList.remove('ctm-group-dragging');
    for (const cls of dragClasses) document.querySelectorAll(`.${cls}`).forEach(node => node.classList.remove(cls));
  }
  function dropMode(element, ev) {
    const r = element.getBoundingClientRect();
    const x = r.width ? (ev.clientX - r.left) / r.width : 0.5;
    // Center means "place IN this group", side edges mean "before/after".
    return x < 0.28 ? 'before' : x > 0.72 ? 'after' : 'inside';
  }
  function allowedGroupDrop(sourceId, targetId) {
    return sourceId !== targetId && !isDescendantGroup(targetId, sourceId);
  }
  function attachDrop(element, groupId) {
    element.addEventListener('dragover', ev => {
      if (!dragPath && !dragGroupId) return;
      if (dragGroupId && !allowedGroupDrop(dragGroupId, groupId)) return;
      ev.preventDefault(); ev.stopPropagation();
      ev.dataTransfer.dropEffect = 'move';
      for (const cls of dragClasses) element.classList.remove(cls);
      element.classList.add(dragGroupId ? `ctm-drop-${dropMode(element, ev)}` : 'ctm-drag-over');
    });
    element.addEventListener('dragleave', () => {
      for (const cls of dragClasses) element.classList.remove(cls);
    });
    element.addEventListener('drop', ev => {
      if (!dragPath && !dragGroupId) return;
      ev.preventDefault(); ev.stopPropagation();
      const path = dragPath;
      const dragged = dragGroupId;
      const mode = dropMode(element, ev);
      cleanupDrag();
      if (path) assign(path, groupId);
      else if (dragged) moveGroup(dragged, groupId, mode);
    });
  }
  function attachRootDrop(element) {
    element.addEventListener('dragover', ev => {
      if (!dragGroupId) return;
      ev.preventDefault(); ev.stopPropagation();
      ev.dataTransfer.dropEffect = 'move';
      element.classList.add('ctm-drag-over');
    });
    element.addEventListener('dragleave', () => element.classList.remove('ctm-drag-over'));
    element.addEventListener('drop', ev => {
      if (!dragGroupId) return;
      ev.preventDefault(); ev.stopPropagation();
      const id = dragGroupId;
      cleanupDrag();
      moveGroup(id, null, 'root');
    });
  }
  function syncPaths() {
    let changed = false;
    for (const node of nativeTabs()) {
      const wf = pathByNode.get(node);
      if (!wf || typeof wf.path !== 'string' || !wf.path) continue;
      const previous = oldPaths.get(node);
      if (previous && previous !== wf.path && Object.prototype.hasOwnProperty.call(state.assignments, previous)) {
        state.assignments[wf.path] = state.assignments[previous];
        delete state.assignments[previous]; changed = true;
      }
      oldPaths.set(node, wf.path);
    }
    if (changed) persist();
  }
  function signature() {
    return JSON.stringify([
      workflows().map(w => [w.path, w.filename, !!w.isModified, w.isPersisted !== false]),
      activePath() || '',
      state.groups.map(g => [g.id, g.name, g.color, g.collapsed, g.parentId]),
      state.assignments,
      state.ui.createButtonColor
    ]);
  }
  function render(force = false) {
    if (!bar || !root || !root.isConnected || !nativeStrip?.isConnected) return;
    // Fail-open visibility: if workflow tabs are rendered but their workflow
    // paths cannot be resolved (e.g. a future ComfyUI release changed the DOM
    // or the store again), restore ComfyUI's original tab bar instead of
    // hiding it behind a custom bar that would look empty.
    if (unmappableTabs()) {
      console.warn('[ComfyUI Tab Manager] Rendering stopped: workflow tab paths could not be resolved; restoring the native tab bar.');
      detach();
      return;
    }
    syncPaths();
    const next = signature();
    if (!force && lastSignature === next) return;
    lastSignature = next;
    // Rebuild only the custom bar, never Vue's original controls or workflow objects.
    const fragment = document.createDocumentFragment();
    const open = workflows();
    const currentActive = activePath();
    function descendantCount(id) {
      return open.filter(w => {
        const owner = groupFor(w.path);
        return owner === id || (owner && isDescendantGroup(owner, id));
      }).length;
    }
    function makeGroupNode(group, depth = 0) {
      const members = open.filter(w => groupFor(w.path) === group.id);
      const groupNode = el('div', `ctm-group${depth ? ' ctm-subgroup' : ''}`);
      groupNode.dataset.groupId = group.id;
      const selectedOwner = currentActive && groupFor(currentActive);
      const selected = selectedOwner && isDescendantGroup(selectedOwner, group.id);
      const title = button('', `ctm-group-label${selected ? ' ctm-active' : ''}`, () => {
        // HTML drag sometimes produces a click afterwards; do not toggle in that case.
        if (Date.now() - dragEndTime > 250) toggleGroup(group.id);
      });
      title.style.setProperty('--ctm-color', group.color);
      title.title = `${group.name} (${descendantCount(group.id)}) • Drag: left/right to reorder, center to nest • Right-click to edit`;
      title.setAttribute('aria-expanded', String(!group.collapsed));
      title.setAttribute('aria-label', `${group.name}, ${descendantCount(group.id)} Workflows, ${group.collapsed ? 'collapsed' : 'expanded'}`);
      title.draggable = true;
      title.dataset.groupId = group.id;
      title.append(el('span', 'ctm-folder', depth ? '▤' : '▣'));
      title.append(el('span', 'ctm-group-name', group.name));
      title.append(el('span', 'ctm-count', descendantCount(group.id)));
      title.append(el('span', 'ctm-caret', group.collapsed ? '▸' : '▾'));
      title.addEventListener('contextmenu', event => { event.preventDefault(); showGroupEditor(title, group.id); });
      title.addEventListener('dragstart', event => {
        event.stopPropagation();
        dragPath = null;
        dragGroupId = group.id;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('application/x-comfy-tab-manager-group', group.id);
        event.dataTransfer.setData('text/plain', `group:${group.id}`);
        if (bar) bar.classList.add('ctm-group-dragging');
      });
      title.addEventListener('dragend', () => { dragEndTime = Date.now(); cleanupDrag(); });
      attachDrop(title, group.id);
      groupNode.append(title);
      if (!group.collapsed) {
        for (const w of members) groupNode.append(tabNode(w, group.color));
        const childGroups = childrenOf(group.id);
        if (childGroups.length) {
          const nested = el('div', 'ctm-subgroups');
          nested.style.setProperty('--ctm-parent-color', group.color);
          for (const child of childGroups) nested.append(makeGroupNode(child, depth + 1));
          groupNode.append(nested);
        }
      }
      return groupNode;
    }
    for (const group of childrenOf(null)) fragment.append(makeGroupNode(group));
    const ungrouped = open.filter(w => groupFor(w.path) === null);
    // Hide the "Ungrouped" section when every open workflow belongs to a group.
    if (ungrouped.length) {
      const noGroup = el('div', 'ctm-ungrouped');
      if (state.groups.length) {
        const label = el('div', 'ctm-ungrouped-title', 'Ungrouped');
        label.title = 'Drop a workflow here to remove it from its group';
        attachDrop(label, null);
        noGroup.append(label);
      }
      for (const w of ungrouped) noGroup.append(tabNode(w, '#a18eff'));
      fragment.append(noGroup);
    }
    // Keep the creation button permanently visible. If it is the LAST child,
    // users with 17+ opened workflows will never see it without scrolling!
    const create = button('+ Group', 'ctm-new-group', () => showGroupEditor(create, null), 'Left-click to create a group. Right-click to customize this button color.');
    if (state.ui.createButtonColor) {
      create.classList.add('ctm-colored');
      create.style.setProperty('--ctm-create-color', state.ui.createButtonColor);
    }
    create.addEventListener('contextmenu', event => {
      event.preventDefault();
      event.stopPropagation();
      showCreateButtonEditor(create);
    });
    const rootDrop = el('div', 'ctm-root-drop', '↖ Top Level');
    rootDrop.title = 'Drop a group here to move it to the top level (at the end)';
    attachRootDrop(rootDrop);
    const items = el('div', 'ctm-items');
    items.append(fragment);
    bar.replaceChildren(create, rootDrop, items);
  }
  function queueRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => { renderQueued = false; render(); });
  }
  // True when the strip shows workflow tabs whose workflow path could not be
  // resolved. Used to fail open: ComfyUI's native bar stays visible instead of
  // being hidden behind a custom bar with missing tabs.
  function unmappableTabs(stripElement) {
    const nodes = stripElement ? [...stripElement.querySelectorAll(TAB_SELECTOR)] : nativeTabs();
    if (!nodes.length) return false;
    return mapTabs(nodes).some(entry => !entry);
  }
  function detach() {
    removePopover();
    cleanupDrag();
    if (nativeObserver) { nativeObserver.disconnect(); nativeObserver = null; }
    if (bar) bar.remove();
    if (root) root.classList.remove('ctm-ready');
    if (nativeHost) nativeHost.classList.remove('ctm-native-host');
    root = null; bar = null; nativeStrip = null; nativeHost = null; lastSignature = '';
  }
  function attachmentPoint() {
    // Do not assume a particular wrapper class or parent nesting; Vue and
    // PrimeVue can insert extra divs between the root and SelectButton.
    // Always resolve the root FROM the strip rather than finding unrelated
    // hidden workflow-tabs-container elements elsewhere in the page.
    const strips = [...document.querySelectorAll('.workflow-tabs')];
    for (const strip of strips) {
      const candidate = strip.closest(SELECTOR);
      if (!candidate || !candidate.isConnected) continue;
      // Pick the actual top-bar widget, not hidden template copies, where possible.
      const tabCount = strip.querySelectorAll(TAB_SELECTOR).length;
      if (!tabCount && strips.length > 1) continue;
      let host = strip;
      while (host.parentElement && host.parentElement !== candidate) host = host.parentElement;
      if (host.parentElement === candidate) return { candidate, strip, host };
    }
    return null;
  }
  function connect() {
    const point = attachmentPoint();
    if (!point) {
      if (root && (!root.isConnected || !nativeStrip?.isConnected)) detach();
      if (lastConnectProblem !== 'missing-root-or-strip') {
        lastConnectProblem = 'missing-root-or-strip';
        console.warn('[ComfyUI Tab Manager] Waiting: top workflow strip attachment point not found');
      }
      return;
    }
    const { candidate, strip, host } = point;
    // Do not take over a strip whose tabs cannot be resolved (fail open).
    if (unmappableTabs(strip)) {
      if (lastConnectProblem !== 'unmapped-tabs') {
        lastConnectProblem = 'unmapped-tabs';
        console.warn('[ComfyUI Tab Manager] Waiting: workflow tabs found, but their workflow paths could not be resolved yet.');
      }
      detach();
      return;
    }
    if (lastConnectProblem === 'unmapped-tabs') lastConnectProblem = '';
    if (root === candidate && nativeStrip === strip && nativeHost === host && bar?.isConnected) return;
    detach();
    root = candidate;
    nativeStrip = strip;
    nativeHost = host;
    bar = el('div', 'ctm-bar no-drag');
    bar.setAttribute('aria-label', 'ComfyUI Tab Manager - Open Workflow Tabs');
    bar.setAttribute('role', 'toolbar');
    try {
      // Mount first. A detached bar made debugging the old version harder.
      // CSS only hides native tabs after the replacement is mounted and rendered.
      host.before(bar);
      render(true);
      if (!bar?.querySelector('.ctm-new-group')) throw new Error('Group creation button was not rendered');
      host.classList.add('ctm-native-host');
      root.classList.add('ctm-ready');
      nativeObserver = new MutationObserver(queueRender);
      nativeObserver.observe(strip, {
        subtree: true, childList: true, attributes: true, characterData: true,
        attributeFilter: ['aria-selected', 'aria-pressed', 'data-state', 'title', 'class', 'data-workflow-path']
      });
      lastConnectProblem = '';
      console.info(`[ComfyUI Tab Manager v${VERSION}] Connected (${detectionMode}): ${nativeTabs().length} opened workflow tabs`);
    } catch (error) {
      console.error(`[ComfyUI Tab Manager v${VERSION}] Initialization failed:`, error);
      detach();
    }
  }
  function setup() {
    if (window.__comfyTabManagerActive) return;
    window.__comfyTabManagerActive = true;
    // Back up and migrate previous installations without altering their metadata.
    // Existing group labels (user-chosen), colors, nesting and tab assignments are kept.
    try {
      const legacy = localStorage.getItem(LEGACY_STORAGE);
      if (legacy && !localStorage.getItem(BACKUP_STORAGE)) {
        localStorage.setItem(BACKUP_STORAGE, legacy);
      }
      if (legacy && !localStorage.getItem(STORAGE)) {
        localStorage.setItem(STORAGE, legacy);
      }
    } catch (err) { console.warn('[ComfyUI Tab Manager] Cannot migrate previous settings:', err); }
    readState();
    connect();
    bodyObserver = new MutationObserver(() => {
      if (!root?.isConnected || !bar?.isConnected || !nativeStrip?.isConnected) connect();
    });
    bodyObserver.observe(document.body, { childList: true, subtree: true });
    // The tab strip may mount only after the extension's setup hook.
    timer = window.setInterval(() => { connect(); render(); }, 800);
    document.addEventListener('pointerdown', outsideHandler, true);
    document.addEventListener('keydown', event => { if (event.key === 'Escape') removePopover(); });
    window.__comfyTabManagerDebug = () => ({
      version: VERSION,
      detectionMode,
      nativeTabCount: document.querySelectorAll(TAB_SELECTOR).length,
      mappedTabCount: workflows().length,
      storeWorkflowCount: storeWorkflows().length,
      stripCount: document.querySelectorAll('.workflow-tabs').length,
      attached: !!bar?.isConnected,
      button: !!bar?.querySelector('.ctm-new-group'),
      groupCount: state.groups.length,
      rootCount: childrenOf(null).length,
      nestedCount: state.groups.filter(g => g.parentId).length,
      ungroupedVisible: !!bar?.querySelector('.ctm-ungrouped'),
      createButtonColor: state.ui.createButtonColor,
      visible: !!(bar && getComputedStyle(bar).display !== 'none'),
      blockedNativeCloseActions: [...BLOCKED_NATIVE_ACTIONS],
      nativeCloseGuardEnabled: nativeMenuGuardActive,
      problem: lastConnectProblem
    });
    console.info(`[ComfyUI Tab Manager v${VERSION}] Loaded; locating top workflow tabs.`);
  }
  app.registerExtension({ name: ID, setup });
})();
