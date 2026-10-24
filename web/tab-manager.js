import { app } from '../../scripts/app.js';
import { api } from '../../scripts/api.js';
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
 * ComfyUI Tab Manager v1.2.0
 * Scope: *open* workflow tabs in the TOP bar. Group layout is stored separately in the ComfyUI user directory.
 * Supports both the legacy workflow tab DOM (Frontend 1.55.x) and the newer
 * Reka UI tabs (Frontend 1.59.x), with native actions kept intact.
 */
(() => {
  const ID = 'ComfyUI Tab Manager';
  const STORAGE = 'ComfyUI.TabManager.v1';
  const LEGACY_STORAGE = 'ComfyUI.ChromeTabGroups.v1';
  const BACKUP_STORAGE = 'ComfyUI.TabManager.LegacyBackup.v1';
  const COLORS = ['#a593ff', '#ff779a', '#faac55', '#ffe178', '#62d6b2', '#6aaeff', '#df91e8', '#ff6969', '#a8b0c2', '#ff4fc5', '#46d5ee', '#81db5a', '#ff8d56', '#d0a4ff', '#dbd85b', '#ffffff'];
  const SELECTOR = '.workflow-tabs-container';
  const VERSION = '1.2.0';
  const TAB_SELECTOR = '[data-testid="workflow-tab"]';
  const LEGACY_PATH_ATTR = 'data-workflow-path';
  const LOCAL_BEFORE_SERVER = 'ComfyUI.TabManager.BeforeServerBackup.v1';
  const LOCAL_CONFLICT_BACKUP = 'ComfyUI.TabManager.UnsyncedBackup.v1';
  const LOCAL_PENDING = 'ComfyUI.TabManager.PendingLayout.v1';
  const SYNC_ENDPOINT = '/comfy-tab-manager/state';
  const SYNC_DELAY = 450;
  const RESTORE_DISMISSED = 'ComfyUI.TabManager.RestoreDismissed.v1';
  const MAX_RESTORE_PATHS = 300;
  // Theme changes affect ONLY the Tab Manager's own elements (never native ComfyUI UI).
  // A null theme preserves all original v1.0.1 CSS without styling regressions.
  const THEME_PRESETS = Object.freeze({
    Classic: null,
    Minimal: { accent: '#a18eff', tabBg: '#292b32', hoverBg: '#363841', panelBg: '#23232b', text: '#eaeaf0', outline: 'none', radius: 6, gap: 5, height: 29, groupTint: 8, hoverTint: 15, shadow: 0, shadowEnabled: false, textShadowEnabled: false, fontSize: 12, fontFamily: 'inherit', fontWeight: 600, italic: false, stroke: 0, strokeColor: '#000000' },
    Soft: { accent: '#c4a7e7', tabBg: '#32313d', hoverBg: '#454153', panelBg: '#292635', text: '#f1ebf7', outline: 'subtle', radius: 14, gap: 7, height: 33, groupTint: 17, hoverTint: 28, shadow: 5, shadowEnabled: true, textShadowEnabled: false, fontSize: 12, fontFamily: 'inherit', fontWeight: 600, italic: false, stroke: 0, strokeColor: '#000000' },
    Neon: { accent: '#fa57d3', tabBg: '#1d1530', hoverBg: '#3a2451', panelBg: '#191526', text: '#fff0fc', outline: 'bold', radius: 9, gap: 6, height: 32, groupTint: 21, hoverTint: 33, shadow: 10, shadowEnabled: true, textShadowEnabled: false, fontSize: 12, fontFamily: 'inherit', fontWeight: 600, italic: false, stroke: 0, strokeColor: '#000000' },
    Tropical: {accent:'#43e6a2',tabBg:'#12352e',hoverBg:'#1c604c',panelBg:'#142923',text:'#e9fff3',outline:'subtle',radius:12,gap:6,height:32,groupTint:24,hoverTint:30,shadow:6,shadowEnabled:true,shadowOpacity:30,textShadowEnabled:false,fontSize:12,fontFamily:'inherit',fontWeight:600,italic:false},
    Ocean: {accent:'#65d8ff',tabBg:'#142e42',hoverBg:'#245773',panelBg:'#142332',text:'#effaff',outline:'subtle',radius:12,gap:6,height:32,groupTint:19,hoverTint:35,shadow:5,shadowEnabled:true,shadowOpacity:28,textShadowEnabled:false,fontSize:12,fontFamily:'inherit',fontWeight:600,italic:false},
    Library: {accent:'#d6ae82',tabBg:'#322923',hoverBg:'#534034',panelBg:'#241f1c',text:'#f6e9d9',outline:'subtle',radius:7,gap:6,height:31,groupTint:22,hoverTint:26,shadow:4,shadowEnabled:true,shadowOpacity:25,textShadowEnabled:false,fontSize:12,fontFamily:'Georgia',fontWeight:600,italic:false},
  });
  const THEME_DEFAULTS = Object.freeze({
    accent: '#a18eff', tabBg: '#34323d', hoverBg: '#464251', panelBg: '#23232b', text: '#f0eef8',
    outline: 'subtle', radius: 9, gap: 5, height: 31, groupTint: 13, hoverTint: 26, shadow: 0, shadowEnabled: false, textShadowEnabled: false, fontSize: 12,
    fontFamily: 'inherit', fontWeight: 600, italic: false, stroke: 0, strokeColor: '#000000', textShadow: 0, textShadowColor: '#000000', shadowOpacity: 40, textShadowOpacity: 100, groupContentGap: 6, barHeight: 34, widthPadding: 10, tabBgOpacity: 100, tabAlignment: 'left'
  });
  const THEME_COLORS = ['accent', 'tabBg', 'hoverBg', 'panelBg', 'text', 'strokeColor', 'textShadowColor'];
  const THEME_NUMBERS = Object.freeze({ radius: [0, 20], gap: [0, 14], height: [24, 42], groupTint: [0, 45], hoverTint: [0, 65], shadow: [0, 18], fontSize: [10, 22], stroke: [0, 3], textShadow: [0, 12], shadowOpacity: [0, 100], textShadowOpacity: [0, 100], groupContentGap: [0, 24], barHeight: [34, 88], widthPadding: [4, 28], tabBgOpacity: [0, 100] });
  const DESIGN_NUMBERS = Object.freeze({borderWidth:[0,3],radius:[0,20],backgroundOpacity:[0,100]});
  const DESIGN_KEYS = Object.freeze(['background','accent','borderColor',...Object.keys(DESIGN_NUMBERS)]);
  const APPEARANCE_KEYS = Object.freeze([...DESIGN_KEYS,'background', 'text', 'fontSize', 'fontFamily', 'fontWeight', 'italic', 'stroke', 'strokeColor']);
  const FONT_FAMILIES = Object.freeze(['inherit', 'Arial', 'Verdana', 'Tahoma', 'Georgia', 'monospace']);
  const THEME_STYLE_PROPERTIES = [
    '--ctm-accent','--ctm-tab-bg','--ctm-tab-hover','--ctm-panel-bg','--ctm-text',
    '--ctm-radius','--ctm-gap','--ctm-tab-height','--ctm-group-tint','--ctm-hover-tint',
    '--ctm-outline-width','--ctm-hover-outline-width','--ctm-font-size','--ctm-font-family','--ctm-font-weight','--ctm-font-style','--ctm-stroke-width','--ctm-stroke-color','--ctm-content-gap', '--ctm-width-padding', '--ctm-tab-bg-alpha', '--ctm-tab-hover-alpha', '--ctm-tab-opacity', '--ctm-bar-height',
    // Remove obsolete inline custom properties from an older live theme.
    '--ctm-shadow-blur','--ctm-text-shadow','--ctm-text-shadow-color','--ctm-box-shadow','--ctm-text-shadow-css'
  ];
  function normalizeTheme(value) {
    if (value === null || value === undefined) return null;
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid theme settings');
    const output = {};
    for (const key of THEME_COLORS) {
      output[key] = /^#[0-9a-fA-F]{6}$/.test(value[key]) ? value[key].toLowerCase() : (THEME_DEFAULTS[key] ?? '#000000');
    }
    for (const [key, [min, max]] of Object.entries(THEME_NUMBERS)) {
      output[key] = Number.isInteger(value[key]) && value[key] >= min && value[key] <= max ? value[key] : THEME_DEFAULTS[key];
    }
    output.outline = ['none', 'subtle', 'bold'].includes(value.outline) ? value.outline : 'subtle';
    output.fontFamily = FONT_FAMILIES.includes(value.fontFamily) ? value.fontFamily : 'inherit';
    output.fontWeight = [400, 500, 600, 700, 800].includes(value.fontWeight) ? value.fontWeight : 600;
    output.italic = typeof value.italic === 'boolean' ? value.italic : false;
    // Legacy layouts may contain custom barHeight values. Keep the key for JSON
    // compatibility, but discard their visual effect: the tab bar is always 34px.
    output.barHeight = 34;
    output.tabAlignment = ['left','center','right'].includes(value.tabAlignment) ? value.tabAlignment : 'left';
    // Backwards compatibility: old themes only stored blur values, not explicit switches.
    output.shadowEnabled = typeof value.shadowEnabled === 'boolean' ? value.shadowEnabled : output.shadow > 0;
    output.textShadowEnabled = typeof value.textShadowEnabled === 'boolean' ? value.textShadowEnabled : output.textShadow > 0;
    // Retired controls: canonicalize older themes without changing storage schema.
    // The surrounding bar remains 34px; tabs and groups use the original 31px height.
    output.height = 31;
    output.shadow = 0;
    output.shadowEnabled = false;
    output.shadowOpacity = 40;
    output.textShadow = 0;
    output.textShadowEnabled = false;
    output.textShadowOpacity = 100;
    output.textShadowColor = '#000000';
    return output;
  }
  function normalizePresets(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).slice(0, 30)
      .filter(([name, theme]) => typeof name === 'string' && name.length <= 48 && name.trim() &&
        !Object.hasOwn(THEME_PRESETS, name) && name !== 'Custom' && theme && typeof theme === 'object' && !Array.isArray(theme))
      .map(([name, theme]) => [name, normalizeTheme(theme)]));
  }
  function normalizeAppearance(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const result = {};
    for (const key of [...APPEARANCE_KEYS, 'preserveClassicSurface']) {
      const v = value[key];
      if (key === 'preserveClassicSurface' && typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) { result[key] = v.toLowerCase(); continue; }
      if (Object.hasOwn(DESIGN_NUMBERS,key) && Number.isInteger(v) && v >= DESIGN_NUMBERS[key][0] && v <= DESIGN_NUMBERS[key][1]) { result[key]=v; continue; }
      if ((key === 'accent' || key === 'borderColor' || key === 'background' || key === 'text' || key === 'strokeColor') && typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) result[key] = v.toLowerCase();
      else if (key === 'fontSize' && Number.isInteger(v) && v >= 10 && v <= 22) result[key] = v;
      else if (key === 'fontWeight' && [400, 500, 600, 700, 800].includes(v)) result[key] = v;
      else if (key === 'fontFamily' && FONT_FAMILIES.includes(v)) result[key] = v;
      else if (key === 'italic' && typeof v === 'boolean') result[key] = v;
      else if (key === 'stroke' && Number.isInteger(v) && v >= 0 && v <= 3) result[key] = v;
    }
    return result;
  }
  function normalizeAppearanceMap(value, validKeys = null) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([id]) => typeof id === 'string' && id.length <= 2048 && (!validKeys || validKeys.has(id)))
      .slice(0, 40000).map(([id, entry]) => {
        const appearance = normalizeAppearance(entry);
        if (validKeys) delete appearance.preserveClassicSurface;
        return [id, appearance];
      }).filter(([, entry]) => Object.keys(entry).length));
  }
  function presetThemes() { return { ...THEME_PRESETS, ...(state.ui?.customPresets || {}) }; }
  // Only compatible element properties propagate; global panel/layout properties never do.
  const INHERITED_APPEARANCE_KEYS = Object.freeze(['text', 'fontFamily', 'fontSize', 'fontWeight', 'italic']);
  let individualPreview = null;
  let previewDockCleanup = null;
  function ownAppearance(scope,key,preview=true) {
    return preview && individualPreview?.scope === scope && individualPreview.id === key
      ? individualPreview.draft : state.ui.appearances[scope][key] || {};
  }
  function sharingEnabled(id,design,preview) {
    return preview && individualPreview?.scope === 'groups' && individualPreview.id === id
      ? (design ? individualPreview.design : individualPreview.typography)
      : !!state.ui[design ? 'inheritGroupDesign' : 'inheritGroupAppearance']?.[id];
  }
  function inheritedAppearance(kind, key, preview = true) {
    const output = {}, visited = new Set();
    let id = kind === 'tab' ? (key === '__preview__' && individualPreview?.scope === 'groups'
      ? individualPreview.id : state.assignments[key]) : state.groups.find(g => g.id === key)?.parentId;
    // Groups-only preview must leave tabs unchanged, including their inherited values.
    const clearGroups = preview && themePreviewActive && themePreviewOverwrite &&
      (themePreviewScope === 'both' || (themePreviewScope === 'groups' && kind === 'group'));
    while (id && !visited.has(id)) {
      visited.add(id);
      const group = state.groups.find(g => g.id === id);
      if (!group) break;
      if (!clearGroups) {
        const values = ownAppearance('groups',id,preview);
        const keys = [...(sharingEnabled(id,false,preview) ? INHERITED_APPEARANCE_KEYS : []),
          ...(sharingEnabled(id,true,preview) ? DESIGN_KEYS : [])];
        for (const property of keys) {
          if (!Object.hasOwn(output, property) && Object.hasOwn(values, property)) output[property] = values[property];
        }
        // The existing group palette is its explicit accent, not a global group theme.
        if (sharingEnabled(id,true,preview) && !Object.hasOwn(output,'accent')) output.accent = values.accent || group.color;
      }
      id = group.parentId;
    }
    return output;
  }
  function effectiveAppearance(kind, key, preview = true) {
    const scope = kind === 'group' ? 'groups' : 'tabs';
    const clearOwn = preview && themePreviewActive && themePreviewOverwrite &&
      (themePreviewScope === 'both' || themePreviewScope === scope);
    const {preserveClassicSurface, ...own} = ownAppearance(scope,key,preview);
    return { ...inheritedAppearance(kind, key, preview), ...(clearOwn ? {} : own) };
  }
  function themeScopes() {
    const scoped = state.ui?.themeScopes;
    return scoped || { tabs: state.ui?.theme || null, groups: state.ui?.theme || null };
  }
  let themePreview = null;
  let themePreviewActive = false;
  let themePreviewScope = 'both';
  let themePreviewOverwrite = false;
  function effectiveThemes() {
    const scoped = themeScopes();
    const result = { tabs: scoped.tabs, groups: scoped.groups };
    if (themePreviewActive) {
      for (const key of ['tabs', 'groups']) {
        if (themePreviewScope === 'both' || themePreviewScope === key) result[key] = themePreview;
      }
    }
    return result;
  }
  function colorWithOpacity(hex, opacity) {
    const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${Math.max(0, Math.min(100, opacity)) / 100})`;
  }
  function themeStyles(theme) {
    if (!theme) return {};
    return {
      '--ctm-accent': theme.accent, '--ctm-tab-bg': theme.tabBg,
      '--ctm-tab-hover': theme.hoverBg, '--ctm-panel-bg': theme.panelBg,
      '--ctm-tab-bg-alpha': colorWithOpacity(theme.tabBg, theme.tabBgOpacity),
      '--ctm-tab-opacity': `${theme.tabBgOpacity}%`,
      '--ctm-tab-hover-alpha': colorWithOpacity(theme.hoverBg, theme.tabBgOpacity),
      '--ctm-content-gap': `${theme.groupContentGap}px`, '--ctm-width-padding': `${theme.widthPadding}px`,
      '--ctm-text': theme.text, '--ctm-radius': `${theme.radius}px`,
      '--ctm-gap': `${theme.gap}px`, '--ctm-tab-height': '31px',
      '--ctm-group-tint': `${theme.groupTint}%`, '--ctm-hover-tint': `${theme.hoverTint}%`,
      '--ctm-outline-width': `${theme.outline === 'none' ? 0 : theme.outline === 'bold' ? 2 : 1}px`,
      '--ctm-hover-outline-width': `${theme.outline === 'none' ? 0 : theme.outline === 'bold' ? 2 : 1}px`,
      '--ctm-font-size': `${theme.fontSize}px`,
      '--ctm-font-family': theme.fontFamily, '--ctm-font-weight': String(theme.fontWeight),
      '--ctm-font-style': theme.italic ? 'italic' : 'normal',
      '--ctm-stroke-width': `0px`, '--ctm-stroke-color': 'transparent',
    };
  }
  function applyElementDesign(element, override, base, sharedBackground) {
    const has = key => Object.hasOwn(override,key);
    if (has('accent')) {
      element.style.setProperty('--ctm-accent',override.accent);
      element.style.setProperty('--ctm-color',override.accent);
    }
    if (has('backgroundOpacity') || (sharedBackground && has('background'))) {
      const background = override.background || base?.tabBg || THEME_DEFAULTS.tabBg;
      element.style.setProperty('background',colorWithOpacity(background,override.backgroundOpacity ?? base?.tabBgOpacity ?? 100),'important');
    }
    // Only choose an automatic text color for a newly inherited/custom opacity surface.
    // Explicit own or inherited typography is never replaced.
    if (!has('text') && (has('backgroundOpacity') || (sharedBackground && has('background')))) {
      const hex = override.background || base?.tabBg || THEME_DEFAULTS.tabBg;
      const alpha = (override.backgroundOpacity ?? base?.tabBgOpacity ?? 100)/100;
      const panel = base?.panelBg || THEME_DEFAULTS.panelBg;
      const linear = v => (v/=255) <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4;
      const rgb = [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)*alpha+parseInt(panel.slice(i,i+2),16)*(1-alpha));
      const lum = rgb.map(linear).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
      const color = (lum+.05)/.05 >= 1.05/(lum+.05) ? '#000000' : '#ffffff';
      const target = element.querySelector('.ctm-tab-main, .ctm-group-name');
      if (target) target.style.setProperty('color',color,'important');
    }
    if (has('radius')) element.style.setProperty('border-radius',`${override.radius}px`,'important');
    if (has('borderWidth')) {
      element.style.setProperty('border-width',`${override.borderWidth}px`,'important');
      element.style.setProperty('border-style','solid','important');
    }
    if (has('borderColor')) element.style.setProperty('border-color',override.borderColor,'important');
  }
  function groupActivity(key, owner = groupFor(activePath())) {
    const group = state.groups.find(g => g.id === key);
    const containsActiveWorkflow = !!group && owner === key;
    return { isCollapsed: !!group?.collapsed, containsActiveWorkflow,
      containsActiveDescendant: !!group && !!owner && !containsActiveWorkflow && isDescendantGroup(owner,key) };
  }
  // Native ownership and its presentation are refreshed independently of appearance.
  // Also used by the preview sample, which is not rebuilt with the workflow bar.
  function applyGroupActivity(element, key, activity = groupActivity(key)) {
    const {isCollapsed,containsActiveWorkflow,containsActiveDescendant} = activity;
    element.classList.toggle('ctm-active',containsActiveWorkflow);
    element.classList.toggle('ctm-active-descendant',containsActiveDescendant);
    element.classList.toggle('ctm-active-closed',(containsActiveWorkflow || containsActiveDescendant) && isCollapsed);
    element.dataset.activeWorkflow = containsActiveWorkflow ? 'direct' : containsActiveDescendant ? 'descendant' : 'none';
    if (containsActiveWorkflow) element.setAttribute('aria-current','true');
    else element.removeAttribute('aria-current');

  }
  function styleItem(element, kind, key) {
    for (const property of ['background','border-radius','border-width','border-style','border-color','box-shadow']) element.style.removeProperty(property);
    const scope = kind === 'group' ? 'groups' : 'tabs';
    const base = effectiveThemes()[scope];
    const previewOverwriting = themePreviewActive && themePreviewOverwrite && (themePreviewScope === 'both' || themePreviewScope === scope);
    const override = effectiveAppearance(kind, key);
    if (kind === 'group') applyGroupActivity(element,key);
    if (kind === 'group' && previewOverwriting && themePreview) element.style.setProperty('--ctm-color', themePreview.accent);
    else if (kind === 'group') element.style.setProperty('--ctm-color', state.groups.find(g => g.id === key)?.color || COLORS[0]);
    for (const prop of ['--ctm-item-background', '--ctm-item-hover-background', '--ctm-item-text', '--ctm-text-shadow', '--ctm-text-shadow-color', '--ctm-text-shadow-css']) element.style.removeProperty(prop);
    const own = ownAppearance(scope,key);
    const themed = !!base || (!previewOverwriting && Object.keys(own).length > 0 && !(kind === 'tab' && own.preserveClassicSurface));
    element.classList.toggle('ctm-themed-item', themed);
    const textTarget = element.querySelector(kind === 'group' ? '.ctm-group-name' : '.ctm-tab-main');
    const typographyProperties = {text:'color',fontSize:'font-size',fontFamily:'font-family',fontWeight:'font-weight',italic:'font-style'};
    if (textTarget) {
      for (const property of [...Object.values(typographyProperties), 'text-shadow']) textTarget.style.removeProperty(property);
    }
    if (!themed) {
      // Classic with inherited typography keeps its original surface and geometry.
      if (kind === 'tab') {
        const group = state.groups.find(g => g.id === state.assignments[key]);
        const palette = themePreviewActive && themePreviewOverwrite && themePreviewScope === 'both'
          ? themePreview?.accent || COLORS[0] : group?.color || '#a18eff';
        element.style.setProperty('--ctm-accent', (!previewOverwriting && own.preserveClassicSurface) || palette);
      }
      if (textTarget) {
        for (const [property, css] of Object.entries(typographyProperties)) {
          if (!Object.hasOwn(override, property)) continue;
          const value = property === 'italic' ? (override[property] ? 'italic' : 'normal') :
            property === 'fontSize' ? `${override[property]}px` : String(override[property]);
          textTarget.style.setProperty(css, value, 'important');
        }
      }
      applyElementDesign(element, override, base, (Object.hasOwn(inheritedAppearance(kind,key),'background') || !!own.preserveClassicSurface));
      return;
    }
    const styles = themeStyles(base || THEME_DEFAULTS);
    for (const [name, value] of Object.entries(styles)) element.style.setProperty(name, value);
    if (Object.hasOwn(override, 'background')) {
      const alpha = base?.tabBgOpacity ?? THEME_DEFAULTS.tabBgOpacity;
      element.style.setProperty('--ctm-item-background', kind === 'tab' ? colorWithOpacity(override.background, alpha) : override.background);
      if (kind === 'tab') element.style.setProperty('--ctm-item-hover-background', `color-mix(in srgb, ${colorWithOpacity(override.background, alpha)} 45%, ${colorWithOpacity(base?.hoverBg || THEME_DEFAULTS.hoverBg, alpha)} 55%)`);
    }
    if (Object.hasOwn(override, 'text')) element.style.setProperty('--ctm-item-text', override.text);
    if (Object.hasOwn(override, 'fontSize')) element.style.setProperty('--ctm-font-size', `${override.fontSize}px`);
    if (Object.hasOwn(override, 'fontFamily')) element.style.setProperty('--ctm-font-family', override.fontFamily);
    if (Object.hasOwn(override, 'fontWeight')) element.style.setProperty('--ctm-font-weight', String(override.fontWeight));
    if (Object.hasOwn(override, 'italic')) element.style.setProperty('--ctm-font-style', override.italic ? 'italic' : 'normal');
    if (Object.hasOwn(override, 'stroke')) element.style.setProperty('--ctm-stroke-width', `${override.stroke}px`);
    // Old text-outline values remain readable for imports, but are no longer drawn.
    // Legacy shadow overrides are intentionally ignored.
    applyElementDesign(element, override, base, (Object.hasOwn(inheritedAppearance(kind,key),'background') || !!own.preserveClassicSurface));
  }
  function applyTheme() {
    const scopes = effectiveThemes();
    if (!bar) return;
    const fallback = scopes.tabs || scopes.groups;
    bar.classList.toggle('ctm-themed', !!fallback);
    bar.classList.toggle('ctm-theme-tabs', !!scopes.tabs);
    bar.classList.toggle('ctm-theme-groups', !!scopes.groups);
    const alignment = scopes.tabs?.tabAlignment || scopes.groups?.tabAlignment || 'left';
    bar.dataset.tabAlignment = alignment;
    for (const property of THEME_STYLE_PROPERTIES) bar.style.removeProperty(property);
    // Tab bar height is fixed; older saved theme values never resize it.
    root?.style.setProperty('--ctm-bar-height', '34px');
    root?.classList.add('ctm-custom-bar-height');
    if (fallback) for (const [name, value] of Object.entries(themeStyles(fallback))) bar.style.setProperty(name, value);
    // Theme affects actual tabs/groups only, never the settings gear, popup or helper controls.
    for (const element of bar.querySelectorAll('.ctm-tab[data-path]')) styleItem(element, 'tab', element.dataset.path);
    for (const element of bar.querySelectorAll('.ctm-group-label[data-group-id]')) styleItem(element, 'group', element.dataset.groupId);
    if (popover) {
      const panelTheme = themePreviewActive ? themePreview : (scopes.groups || scopes.tabs);
      const bg = panelTheme?.panelBg || null;
      if (bg) {
        popover.style.setProperty('--ctm-popover-bg', bg);
        const rgb = [1,3,5].map(i => parseInt(bg.slice(i,i+2),16)/255);
        const lum = rgb.map(c => c <= .04045 ? c / 12.92 : ((c+.055)/1.055)**2.4);
        popover.style.setProperty('--ctm-popover-fg', lum[0]*.2126+lum[1]*.7152+lum[2]*.0722>.28 ? '#17191f' : '#f3f4f8');
      } else { popover.style.removeProperty('--ctm-popover-bg'); popover.style.removeProperty('--ctm-popover-fg'); }
      for (const sample of popover.querySelectorAll('[data-preview-group-id]')) styleItem(sample,'group',sample.dataset.previewGroupId);
      for (const sample of popover.querySelectorAll('[data-preview-tab-path]')) {
        styleItem(sample,'tab',sample.dataset.previewTabPath);
        sample.classList.toggle('ctm-selected',sample.dataset.previewTabPath === activePath());
      }
    }
  }
  // Changes only the selected target scope; unselected elements keep their previous theme.
  function commitTheme(theme, scope, overwrite) {
    // Preserve unselected tabs before removing their explicitly enabled group sources.
    if (scope === 'groups' && overwrite) {
      for (const path of Object.keys(state.assignments)) {
        const inherited = inheritedAppearance('tab', path, false);
        const own = state.ui.appearances.tabs[path] || {};
        const retained = {};
        for (const [property, value] of Object.entries(inherited)) {
          if (!Object.hasOwn(own, property)) retained[property] = value;
        }
        if (Object.hasOwn(retained,'background') && !Object.hasOwn(own,'backgroundOpacity') && !Object.hasOwn(retained,'backgroundOpacity')) retained.backgroundOpacity = themeScopes().tabs?.tabBgOpacity ?? 100;
        const oldAccent = own.preserveClassicSurface || state.groups.find(g => g.id === state.assignments[path])?.color || '#a18eff';
        if (!themeScopes().tabs && (!Object.keys(own).length || own.preserveClassicSurface) &&
            (Object.keys(retained).length || oldAccent !== (theme?.accent || COLORS[0]))) {
          retained.preserveClassicSurface = oldAccent;
        }
        if (Object.keys(retained).length) state.ui.appearances.tabs[path] = { ...retained, ...own };
      }
    }
    const updated = { ...themeScopes() };
    const targets = scope === 'both' ? ['tabs', 'groups'] : [scope];
    for (const key of targets) {
      updated[key] = theme ? normalizeTheme(theme) : null;
      if (overwrite) {
        state.ui.appearances[key] = {};
        // Native group palette colors are also explicit, per-group customizations.
        // This is deliberately destructive ONLY after selecting Overwrite Groups.
        if (key === 'groups') {
          for (const group of state.groups) group.color = theme?.accent || COLORS[0];
        }
      }
    }
    state.ui.themeScopes = updated;
    // Legacy mirror only when both targets are identical; new clients use themeScopes.
    state.ui.theme = JSON.stringify(updated.tabs) === JSON.stringify(updated.groups) ? updated.tabs : null;
  }
  const cssSafe = (v) => String(v ?? '');
  let state = { groups: [], assignments: {}, ui: { createButtonColor: null, theme: null, themeScopes: { tabs: null, groups: null }, customPresets: {}, appearances: { tabs: {}, groups: {} } } };
  let serverRevision = null;
  let syncReady = false;
  let syncBusy = false;
  let dirty = false;
  let conflict = false;
  let syncStatus = 'Connecting to ComfyUI storage…';
  let syncErrorDetail = '';
  let syncSaveTimer = null;
  let lastServerCheck = 0;
  let localMutationVersion = 0;
  let root = null;
  let bar = null;
  let nativeStrip = null;
  let nativeHost = null;
  let nativeObserver = null;
  let bodyObserver = null;
  let timer = null;
  let renderQueued = false;
  let lastSignature = '';
  let lastRenderedActivePath = null;
  let popover = null;
  let dragPath = null;
  let dragGroupId = null;
  let dragEndTime = 0;
  let lastConnectProblem = '';
  let warnedMissingCss = false;
  let detectionMode = 'inactive';
  let nodeByPath = new Map();
  let pathByNode = new WeakMap();
  const oldPaths = new WeakMap();
  let nativeTabSnapshot = [];
  let lastTabAlignment = null;
  let restorePromptHandled = false;
  let restorePromptTimer = null;
  let restorePanel = null;
  let restoringWorkflows = false;
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

  // Only workflow references, NEVER copies of workflow contents. Reject paths that
  // cannot refer to an ordinary saved ComfyUI workflow. The frontend workflow
  // service, not the extension, performs any actual opening.
  function isRestorablePath(path) {
    return typeof path === 'string' && path.length > 10 && path.length <= 2048 &&
      path.startsWith('workflows/') && path.endsWith('.json') &&
      !path.split('/').some(part => part === '..' || part === '.') &&
      !/[\\\x00-\x1f]/.test(path) && !/\/Unsaved Workflow(?: \(\d+\))?\.json$/i.test(path);
  }
  function normalizeRestorePaths(paths) {
    if (!Array.isArray(paths)) return [];
    return [...new Set(paths.filter(isRestorablePath))].slice(0, MAX_RESTORE_PATHS);
  }
  function restorableSavedPaths(layout = state) {
    // An explicit snapshot is exact (and includes ungrouped tabs). Older
    // layouts fall back to their known group assignments.
    if (layout.ui?.restorePaths?.length) return normalizeRestorePaths(layout.ui.restorePaths);
    return normalizeRestorePaths(Object.keys(layout.assignments || {}));
  }
  function missingRestorePaths() {
    const currentlyOpen = new Set(workflows().map(w => w.path));
    return restorableSavedPaths().filter(path => !currentlyOpen.has(path));
  }
  function normalizeState(saved) {
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) throw new Error('Invalid layout data');
    const groups = Array.isArray(saved.groups) ? saved.groups : [];
    const assignments = saved.assignments && typeof saved.assignments === 'object' && !Array.isArray(saved.assignments) ? saved.assignments : {};
    const seen = new Set();
    const cleaned = groups.filter(g => g && typeof g.id === 'string' && g.id && !seen.has(g.id) && seen.add(g.id)).map(g => ({
      id: g.id, name: cssSafe(g.name || 'New Group').slice(0, 80),
      color: /^#[0-9a-fA-F]{6}$/.test(g.color) ? g.color : COLORS[0],
      collapsed: Boolean(g.collapsed),
      parentId: typeof g.parentId === 'string' ? g.parentId : null
    }));
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
    return {
      groups: cleaned,
      assignments: Object.fromEntries(Object.entries(assignments).filter(([key, val]) =>
        typeof key === 'string' && typeof val === 'string' && byId.has(val))),
      ui: {
        customPresets: normalizePresets(saved.ui?.customPresets),
        createButtonColor: /^#[0-9a-fA-F]{6}$/.test(saved.ui?.createButtonColor) ? saved.ui.createButtonColor : null,
        restorePaths: normalizeRestorePaths(saved.ui?.restorePaths),
        theme: normalizeTheme(saved.ui?.theme),
        themeScopes: saved.ui?.themeScopes && typeof saved.ui.themeScopes === 'object' && !Array.isArray(saved.ui.themeScopes)
          ? { tabs: normalizeTheme(saved.ui.themeScopes.tabs), groups: normalizeTheme(saved.ui.themeScopes.groups) }
          : { tabs: normalizeTheme(saved.ui?.theme), groups: normalizeTheme(saved.ui?.theme) },
        appearances: {
          tabs: normalizeAppearanceMap(saved.ui?.appearances?.tabs),
          groups: normalizeAppearanceMap(saved.ui?.appearances?.groups, new Set(cleaned.map(g => g.id)))
        },
        inheritGroupDesign: Object.fromEntries(Object.entries(saved.ui?.inheritGroupDesign || {})
          .filter(([id, enabled]) => byId.has(id) && enabled === true)),
        inheritGroupAppearance: Object.fromEntries(Object.entries(saved.ui?.inheritGroupAppearance || {})
          .filter(([id, enabled]) => byId.has(id) && enabled === true))
      }
    };
  }
  function readState() {
    try {
      state = normalizeState(JSON.parse(localStorage.getItem(STORAGE) || localStorage.getItem(LEGACY_STORAGE) || '{}'));
    } catch (err) {
      console.warn('[ComfyUI Tab Manager] Cannot read saved groups:', err);
      state = normalizeState({});
    }
    try {
      const pending = localStorage.getItem(LOCAL_PENDING);
      if (pending !== null) {
        dirty = true;
        state = normalizeState(JSON.parse(pending));
      }
    } catch (err) {
      // Keep the ordinary cache and require conflict mediation if recovery is damaged.
      dirty = true;
      console.warn('[ComfyUI Tab Manager] Cannot read pending layout:', err);
    }
  }
  function rememberPending() {
    try { localStorage.setItem(LOCAL_PENDING, JSON.stringify(state)); }
    catch (err) { console.warn('[ComfyUI Tab Manager] Cannot save pending layout:', err); }
  }
  function acknowledgePending(saved) {
    try {
      const pending = localStorage.getItem(LOCAL_PENDING);
      // Another browser tab may have written a newer pending snapshot meanwhile.
      if (pending !== null && JSON.stringify(normalizeState(JSON.parse(pending))) === JSON.stringify(saved)) {
        localStorage.removeItem(LOCAL_PENDING);
      }
    } catch (err) { console.warn('[ComfyUI Tab Manager] Cannot acknowledge pending layout:', err); }
  }
  function persist() {
    // Local storage is retained as an automatic offline backup, not the primary store.
    rememberPending();
    try { localStorage.setItem(STORAGE, JSON.stringify(state)); }
    catch (err) { console.warn('[ComfyUI Tab Manager] Cannot save local fallback:', err); }
    dirty = true;
    localMutationVersion += 1;
    if (syncReady && !conflict) scheduleServerSave();
  }
  function hasLayout(layout) {
    return !!(layout.groups?.length || Object.keys(layout.assignments || {}).length || layout.ui?.createButtonColor || layout.ui?.theme || layout.ui?.themeScopes?.tabs || layout.ui?.themeScopes?.groups || layout.ui?.restorePaths?.length || Object.keys(layout.ui?.customPresets || {}).length || Object.keys(layout.ui?.appearances?.tabs || {}).length || Object.keys(layout.ui?.appearances?.groups || {}).length);
  }
  function backupLocal(key) {
    try { localStorage.setItem(key, JSON.stringify(state)); }
    catch (err) { console.warn('[ComfyUI Tab Manager] Could not back up local state:', err); }
  }
  function applyState(incoming) {
    state = normalizeState(incoming);
    try { localStorage.setItem(STORAGE, JSON.stringify(state)); }
    catch (err) { console.warn('[ComfyUI Tab Manager] Could not cache server layout:', err); }
    lastSignature = '';
    applyTheme();
    render(true);
  }
  async function fetchServerState() {
    const response = await api.fetchApi(SYNC_ENDPOINT, { method: 'GET', cache: 'no-store' });
    if (!response.ok) {
      if (response.status === 404) throw new Error('HTTP 404: ComfyUI Tab Manager backend not registered. Restart ComfyUI and check its startup log.');
      if (response.status === 401 || response.status === 403) throw new Error(`HTTP ${response.status}: storage access was denied for this ComfyUI user`);
      const errorBody = await response.json().catch(() => ({}));
      const reason = typeof errorBody?.error === 'string' ? `: ${errorBody.error}` : '';
      throw new Error(`Server layout endpoint returned HTTP ${response.status}${reason}`);
    }
    return response.json();
  }
  function reportConnectionFailure(error) {
    syncErrorDetail = error instanceof Error ? error.message : String(error);
    syncStatus = 'Server storage unavailable — browser backup active';
    console.warn('[ComfyUI Tab Manager] Shared storage connection failed:', error);
  }
  async function retryServerConnection() {
    if (syncBusy) return;
    if (syncReady && !conflict) {
      // For a connected browser, poll without overwriting locally edited data.
      await pollServerSync();
    } else if (!syncReady) {
      await initServerSync();
    } else {
      try { await fetchServerState(); syncErrorDetail = ''; syncStatus = 'Server reachable — resolve local layout conflict before syncing'; }
      catch (error) { reportConnectionFailure(error); }
    }
    // The menu may still be open, so update visible diagnostics in place.
    if (popover?.querySelector('.ctm-storage-status')) {
      popover.querySelector('.ctm-storage-status').textContent = `Status: ${syncStatus}`;
      const detail = popover.querySelector('.ctm-storage-diagnostic');
      if (detail) { detail.textContent = syncErrorDetail; detail.hidden = !syncErrorDetail; }
    }
  }
  async function postServerState(layout, revision) {
    const response = await api.fetchApi(SYNC_ENDPOINT, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: layout, revision })
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 409) {
      const error = new Error('Another browser saved a newer layout');
      error.conflict = data;
      throw error;
    }
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  }
  function scheduleServerSave() {
    clearTimeout(syncSaveTimer);
    syncSaveTimer = setTimeout(flushServerSave, SYNC_DELAY);
  }
  async function flushServerSave() {
    if (!syncReady || syncBusy || conflict || !dirty) return;
    syncBusy = true;
    const snapshot = JSON.parse(JSON.stringify(state));
    const sentMutationVersion = localMutationVersion;
    try {
      const saved = await postServerState(snapshot, serverRevision);
      serverRevision = saved.revision;
      if (sentMutationVersion === localMutationVersion) {
        dirty = false;
        acknowledgePending(snapshot);
        syncStatus = 'Saved in ComfyUI';
        syncErrorDetail = '';
      } else {
        scheduleServerSave();
      }
    } catch (error) {
      if (error.conflict) {
        backupLocal(LOCAL_CONFLICT_BACKUP);
        conflict = true;
        syncStatus = 'Conflict: another browser changed the layout';
        console.warn('[ComfyUI Tab Manager] Server conflict; local edits kept in browser. Open Layout Settings to resolve.');
      } else {
        reportConnectionFailure(error);
      }
    } finally {
      syncBusy = false;
      if (dirty && syncReady && !conflict && sentMutationVersion !== localMutationVersion) scheduleServerSave();
    }
  }
  async function initServerSync() {
    if (syncReady || syncBusy) return;
    syncBusy = true;
    const initialMutationVersion = localMutationVersion;
    try {
      const remote = await fetchServerState();
      serverRevision = remote.revision || null;
      syncErrorDetail = '';
      const localHadChanges = dirty;
      let replacedOldBrowserLayout = false;
      if (initialMutationVersion !== localMutationVersion && remote.state !== null) {
        backupLocal(LOCAL_CONFLICT_BACKUP);
        syncReady = true; conflict = true;
        syncStatus = 'Conflict: edited locally while connecting to server';
        return;
      }
      if (remote.state !== null) {
        const normalized = normalizeState(remote.state);
        // Local edits made while the server was offline MUST NOT be discarded on reconnect.
        // The user must explicitly choose whether to reload or upload in this case.
        if (localHadChanges && JSON.stringify(state) !== JSON.stringify(normalized)) {
          backupLocal(LOCAL_CONFLICT_BACKUP);
          syncReady = true;
          conflict = true;
          lastServerCheck = Date.now();
          syncStatus = 'Conflict: local edits made while offline';
          return;
        }
        if (JSON.stringify(state) !== JSON.stringify(normalized)) {
          if (hasLayout(state)) { backupLocal(LOCAL_BEFORE_SERVER); replacedOldBrowserLayout = true; }
          applyState(normalized);
        }
        acknowledgePending(state);
        dirty = false;
      } else if (hasLayout(state) || localHadChanges) {
        dirty = true; // First-launch migration from browser layout.
      } else {
        dirty = false;
      }
      syncReady = true;
      if (dirty) rememberPending();
      syncErrorDetail = '';
      lastServerCheck = Date.now();
      syncStatus = dirty ? 'Migrating browser layout to ComfyUI…' :
        replacedOldBrowserLayout ? 'Shared layout loaded; previous browser layout backed up' : 'Saved in ComfyUI';
    } catch (error) {
      reportConnectionFailure(error);
    } finally {
      syncBusy = false;
    }
    if (syncReady && dirty) scheduleServerSave();
  }
  async function pollServerSync() {
    if (!syncReady) { await initServerSync(); return; }
    if (syncBusy || conflict) return;
    if (dirty) { await flushServerSave(); return; }
    syncBusy = true;
    const beforePoll = localMutationVersion;
    try {
      const remote = await fetchServerState();
      syncErrorDetail = '';
      if (beforePoll !== localMutationVersion) return;
      if (remote.revision !== serverRevision) {
        serverRevision = remote.revision;
        if (remote.state) applyState(remote.state);
        syncStatus = 'Updated from another browser';
      } else {
        syncStatus = 'Saved in ComfyUI';
      }
      lastServerCheck = Date.now();
    } catch (error) {
      reportConnectionFailure(error);
    } finally { syncBusy = false; }
  }
  function exportLayout(layout = state, filename = 'comfyui-tab-manager-layout.json') {
    const json = JSON.stringify({ format: 'ComfyUI-Tab-Manager-Layout', version: 1, state: layout }, null, 2);
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = filename;
    document.body.append(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  async function importLayoutFile(file) {
    if (!file || file.size > 1_048_576) { window.alert('Please choose a layout JSON under 1 MB.'); return; }
    try {
      const parsed = JSON.parse(await file.text());
      const imported = normalizeState(parsed?.format === 'ComfyUI-Tab-Manager-Layout' ? parsed.state : parsed);
      if (!window.confirm('Replace your current group layout with this imported layout? Your current layout will be backed up first.')) return;
      backupLocal(LOCAL_BEFORE_SERVER);
      applyState(imported);
      persist();
      removePopover();
    } catch (error) { window.alert(`Could not import layout: ${error.message}`); }
  }
  async function reloadServerLayout(force = false) {
    if (dirty && !force && !window.confirm('Unsaved changes exist. Reload server layout and discard those changes? A browser backup will be kept.')) return;
    const initialMutationVersion = localMutationVersion;
    try {
      const remote = await fetchServerState();
      // The user may edit the layout while the request is pending. Never replace newer edits.
      if (initialMutationVersion !== localMutationVersion) {
        backupLocal(LOCAL_CONFLICT_BACKUP);
        window.alert('Layout changed while loading the server version. Your local changes were kept. Please try again.');
        return;
      }
      if (!remote.state) { window.alert('No layout is saved on the server yet.'); return; }
      const stateBeforeReload = JSON.parse(JSON.stringify(state));
      backupLocal(LOCAL_BEFORE_SERVER);
      serverRevision = remote.revision;
      applyState(remote.state);
      syncReady = true;
      conflict = false; dirty = false;
      // Explicit reload is the user's choice to discard this instance's pending layout.
      acknowledgePending(stateBeforeReload);
      clearTimeout(syncSaveTimer);
      syncStatus = 'Loaded from ComfyUI';
      syncErrorDetail = '';
      removePopover();
    } catch (error) { window.alert(`Cannot load server layout: ${error.message}`); }
  }
  async function uploadLayoutWithConfirmation() {
    if (!window.confirm('Overwrite the shared ComfyUI layout with your current local layout? Other browsers will receive this layout.')) return;
    if (syncBusy) return;
    syncBusy = true;
    const sentMutationVersion = localMutationVersion;
    const snapshot = JSON.parse(JSON.stringify(state));
    try {
      const remote = await fetchServerState();
      const saved = await postServerState(snapshot, remote.revision);
      serverRevision = saved.revision;
      syncErrorDetail = '';
      conflict = false; syncReady = true;
      if (sentMutationVersion === localMutationVersion) {
        dirty = false;
        acknowledgePending(snapshot);
        syncStatus = 'Saved in ComfyUI';
      } else {
        // The uploaded snapshot is saved, but subsequent user edits still need a save.
        dirty = true;
        syncStatus = 'Saving newer local edits…';
      }
      removePopover();
    } catch (error) {
      if (error.conflict) {
        backupLocal(LOCAL_CONFLICT_BACKUP);
        conflict = true;
        syncStatus = 'Conflict: another browser changed the layout';
      }
      window.alert(`Cannot upload layout: ${error.message}`);
    } finally {
      syncBusy = false;
      if (dirty && syncReady && !conflict) scheduleServerSave();
    }
  }
  function showLayoutSettings(anchor) {
    const panel = el('div', 'ctm-storage-editor ctm-centered-editor');
    addPopoverHeader(panel, 'Layout Storage & Backup');
    const statusLine = el('div', 'ctm-hint ctm-storage-status', `Status: ${syncStatus}`);
    panel.append(statusLine);
    const diagnostic = el('div', 'ctm-hint ctm-storage-diagnostic', syncErrorDetail);
    diagnostic.hidden = !syncErrorDetail;
    panel.append(diagnostic);
    panel.append(el('div', 'ctm-hint', 'Layouts are saved in the ComfyUI user directory. Workflow files are never changed.'));
    const actions = el('div', 'ctm-layout-actions');
    actions.append(button('Export Layout (.json)', 'ctm-action', () => exportLayout(), 'Back up your groups, assignments and colors'));
    actions.append(button('Import Layout (.json)', 'ctm-action', () => {
      const picker = document.createElement('input');
      picker.type = 'file'; picker.accept = '.json,application/json';
      picker.addEventListener('change', () => importLayoutFile(picker.files?.[0]), { once: true });
      picker.click();
    }, 'Restore a previous layout from JSON'));
    actions.append(button('Reload Server Layout', 'ctm-action', () => reloadServerLayout(), 'Load layout stored in ComfyUI'));
    actions.append(button('Test Server Connection', 'ctm-action', retryServerConnection, 'Check whether the ComfyUI Python backend is responding'));
    actions.append(button('Restore Saved Workflow Tabs', 'ctm-action', () => {
      removePopover();
      showWorkflowRestoreOffer(true);
    }, 'Reopen missing saved workflows without closing current tabs'));
    actions.append(button('Save Current Open Tabs for Restore', 'ctm-action', () => {
      const service = app?.extensionManager?.workflow;
      if (!service || typeof service.getWorkflowByPath !== 'function') {
        window.alert('Cannot verify saved workflows with this ComfyUI frontend. No snapshot was changed.');
        return;
      }
      const open = normalizeRestorePaths(workflows().map(w => w.path).filter(path => {
        const workflow = service.getWorkflowByPath(path);
        return workflow && workflow.isPersisted === true && !workflow.isTemporary;
      }));
      if (!open.length) { window.alert('No saved workflow tabs are open to remember. Unsaved workflows cannot be restored.'); return; }
      if (!window.confirm(`Remember ${open.length} saved workflow tabs for restoration in another browser? This does not copy workflow files.`)) return;
      state.ui.restorePaths = open;
      persist();
      removePopover();
    }, 'Remember open tabs including ungrouped saved workflows; files are never copied'));
    if (conflict || dirty) actions.append(button('Use This Layout on Server', 'ctm-action ctm-primary', uploadLayoutWithConfirmation,
      'Explicitly replace the saved shared layout'));
    let backup = null;
    try { backup = localStorage.getItem(LOCAL_BEFORE_SERVER); } catch (_) { /* storage disabled */ }
    if (backup) actions.append(button('Restore Previous Browser Layout', 'ctm-action', () => {
      try {
        const recovered = normalizeState(JSON.parse(backup));
        if (!window.confirm('Restore your saved pre-sync browser layout?')) return;
        backupLocal(LOCAL_CONFLICT_BACKUP);
        applyState(recovered); persist(); removePopover();
      } catch (error) { window.alert(`Invalid browser backup: ${error.message}`); }
    }, 'Restore your browser groups from before server syncing'));
    panel.append(actions);
    panel.append(button('👾Customize Theme👾', 'ctm-action ctm-theme-launch', () => showThemeStudio(anchor), 'Customize Tab Manager colors, borders, spacing and appearance'));
    showPopover(anchor, panel);
  }
  function showThemeStudio(anchor) {
    let scope = 'both';
    let overwrite = false;
    let draft = themeScopes().tabs ? { ...themeScopes().tabs } : null;
    const panel = el('div', 'ctm-theme-studio');
    addPopoverHeader(panel, 'Customize Theme');
    panel.append(el('p', 'ctm-theme-intro', 'Only the Tab Manager is customized. Workflow files are never changed.'));
    const body = el('div','ctm-theme-body');
    panel.append(body);
    const controls = [];
    const section = title => {
      const element = el('section', 'ctm-theme-section');
      element.append(el('h4','ctm-section-title',title));
      body.append(element);
      return element;
    };
    const row = (parent,label,control) => {
      const field = el('label','ctm-theme-row');
      field.append(el('span','ctm-theme-row-label',label), control);
      parent.append(field);return field;
    };
    const addGrid = sectionNode => {
      const grid=el('div','ctm-refined-grid');sectionNode.append(grid);return grid;
    };
    const makeField = (parent,label,control,key,unit='') => {
      const wrap = el('div','ctm-refined-field');
      const top = el('div','ctm-refined-field-header');
      top.append(el('span','',label));
      let value=null;
      if(control.type === 'range') {
        value=el('output','ctm-theme-value',`${control.value}${unit}`);
        top.append(value);
      }
      wrap.append(top,control);parent.append(wrap);
      controls.push({key,input:control,unit,value});
      return wrap;
    };
    const app=section('Application');
    const scopeSelect=el('select','ctm-theme-select');
    for (const [value,text] of [['both','All Tabs & Groups'],['tabs','Tabs Only'],['groups','Groups Only']]) {
      const option=el('option','',text);option.value=value;scopeSelect.append(option);
    }
    row(app,'Apply to',scopeSelect);
    const modeSelect=el('select','ctm-theme-select');
    for(const [value,text] of [['keep','Keep individual settings'],['overwrite','Overwrite individual settings']]) {
      const option=el('option','',text);option.value=value;modeSelect.append(option);
    }
    row(app,'Custom designs',modeSelect);
    const protectionSummary=el('p','ctm-theme-note');app.append(protectionSummary);
    const presets=section('Preset & Preview');
    const presetSelect=el('select','ctm-theme-select');
    const availablePresets=()=>presetThemes();
    function refreshPresetOptions(value = 'Custom') {
      presetSelect.replaceChildren();
      for(const name of [...Object.keys(availablePresets()),'Custom']) {
        const o=el('option','',name);o.value=name;presetSelect.append(o);
      }
      presetSelect.value=value;
    }
    refreshPresetOptions();
    row(presets,'Theme preset',presetSelect);
    const presetTools=el('div','ctm-preset-tools');
    const savePresetBtn=button('Save as JSON Preset','ctm-action',()=>{
      const entered=window.prompt('Name for your theme preset (up to 48 characters):','My Theme');
      if(entered===null)return;
      const name=entered.trim();
      if(!name||name.length>48||Object.hasOwn(THEME_PRESETS,name)||name==='Custom') {
        window.alert('Choose a different preset name (1–48 characters).');return;
      }
      const existing=state.ui.customPresets||{};
      if(Object.hasOwn(existing,name)&&!window.confirm(`Replace saved preset "${name}"?`))return;
      if(!Object.hasOwn(existing,name)&&Object.keys(existing).length>=30) {
        window.alert('Maximum 30 saved theme presets.');return;
      }
      const preset=normalizeTheme({...THEME_DEFAULTS,...(draft||{})});
      state.ui.customPresets={...existing,[name]:preset};
      persist();
      refreshPresetOptions(name);
      const blob=new Blob([JSON.stringify({name,theme:preset},null,2)],{type:'application/json'});
      const url=URL.createObjectURL(blob);
      const link=document.createElement('a');link.href=url;
      link.download=`ctm-theme-${name.replace(/[^a-z0-9_-]/gi,'_')}.json`;link.click();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    },'Save your current theme as JSON and add it to Theme preset');
    const importPresetInput=el('input','ctm-preset-file');
    importPresetInput.type='file'; importPresetInput.accept='.json,application/json';
    importPresetInput.hidden=true;
    importPresetInput.addEventListener('change',async()=>{
      const file=importPresetInput.files?.[0];importPresetInput.value='';
      if(!file)return;
      if(file.size>65536){window.alert('Theme preset file is too large.');return;}
      try {
        const data=JSON.parse(await file.text());
        const raw=data?.theme||data;
        if(!raw||typeof raw!=='object'||Array.isArray(raw)||!/^#[0-9a-fA-F]{6}$/.test(raw.accent))throw new Error('Missing theme colors');
        const name=String(data.name||file.name.replace(/\.json$/i,'')).trim();
        if(!name||name.length>48||Object.hasOwn(THEME_PRESETS,name)||name==='Custom')throw new Error('Invalid or reserved preset name');
        const existing=state.ui.customPresets||{};
        if(Object.hasOwn(existing,name)&&!window.confirm(`Replace saved preset "${name}"?`))return;
        if(!Object.hasOwn(existing,name)&&Object.keys(existing).length>=30)throw new Error('Maximum 30 saved presets');
        const sanitized=normalizeTheme(raw);
        state.ui.customPresets={...existing,[name]:sanitized};persist();
        draft={...sanitized};refreshPresetOptions(name);updateFields();previewDraft();
      }catch(error){window.alert(`Cannot import theme: ${error.message}`);}
    });
    presetTools.append(savePresetBtn,button('Import JSON','ctm-action',()=>importPresetInput.click(),'Import previously saved theme JSON'),importPresetInput);
    presets.append(presetTools);
    const preview=el('div','ctm-theme-live-preview');
    const previewGroup=el('span','ctm-preview-group','Sample Group  ▸');
    const previewTab=el('span','ctm-preview-tab','Sample Workflow');
    preview.append(previewGroup,previewTab);presets.append(preview);

    function colorField(parent,label,key) {
      const holder=el('div','ctm-color-control');
      const input=el('input','ctm-theme-color');input.type='color';
      input.value=(draft||THEME_DEFAULTS)[key]||'#000000';
      const hex=el('span','ctm-hex',input.value.toUpperCase());
      holder.append(input,hex);
      input.addEventListener('input',()=>{hex.textContent=input.value.toUpperCase();updateDraft(key,input.value);});
      const field=makeField(parent,label,holder,key);
      controls[controls.length-1].input=input;
      controls[controls.length-1].hex=hex;
      return field;
    }
    function selectField(parent,label,key,options) {
      const control=el('select','ctm-theme-select');
      for(const [value,name] of options) {const opt=el('option','',name);opt.value=String(value);control.append(opt);}
      control.value=String((draft||THEME_DEFAULTS)[key]);
      control.addEventListener('change',()=>updateDraft(key,key==='fontWeight'?Number(control.value):key==='italic'?control.value==='true':control.value));
      return makeField(parent,label,control,key);
    }
    function rangeField(parent,label,key,unit='px') {
      const input=el('input','ctm-theme-range');input.type='range';
      [input.min,input.max]=THEME_NUMBERS[key];input.step='1';input.value=(draft||THEME_DEFAULTS)[key];
      const wrap=makeField(parent,label,input,key,unit);
      const record=controls[controls.length-1];
      input.addEventListener('input',()=>{record.value.textContent=`${input.value}${unit}`;updateDraft(key,Number(input.value));});
      return wrap;
    }
    const layout=addGrid(section('Tab Layout'));
    selectField(layout,'Tab layout','tabAlignment',[['left','Left aligned'],['center','Centered'],['right','Right aligned']]).classList.add('ctm-effect-card','ctm-layout-alignment','ctm-refined-wide-select');
    const colors=addGrid(section('Colors'));
    colorField(colors,'Accent color','accent');
    colorField(colors,'Tab background','tabBg');

    colorField(colors,'Tab hover','hoverBg');
    colorField(colors,'Panel background','panelBg');
    colorField(colors,'Text color','text');
    selectField(colors,'Button borders','outline',[['none','None'],['subtle','Subtle'],['bold','Bold']]).classList.add('ctm-refined-wide-select');
    const typography=addGrid(section('Typography'));
    selectField(typography,'Font family','fontFamily',FONT_FAMILIES.map(x=>[x,x]));
    selectField(typography,'Font weight','fontWeight',[[400,'Regular'],[500,'Medium'],[600,'Semibold'],[700,'Bold'],[800,'Extra Bold']]);
    const italicSwitch=el('input','ctm-italic-switch'); italicSwitch.type='checkbox';
    italicSwitch.checked=!!(draft||THEME_DEFAULTS).italic;
    italicSwitch.addEventListener('change',()=>updateDraft('italic',italicSwitch.checked));
    const italicField=makeField(typography,'Italic',italicSwitch,'italic');
    italicField.classList.add('ctm-italic-field');
    rangeField(typography,'Font size','fontSize');
    const dimensions=addGrid(section('Shape & Layout'));
    rangeField(dimensions,'Corner radius','radius').classList.add('ctm-effect-card');
    rangeField(dimensions,'Spacing','gap').classList.add('ctm-effect-card');
    rangeField(dimensions,'Group content gap','groupContentGap').classList.add('ctm-effect-card');
    rangeField(dimensions,'Tab & group padding','widthPadding').classList.add('ctm-effect-card');
    rangeField(dimensions,'Tab fill','tabBgOpacity','%').classList.add('ctm-effect-card');
    rangeField(dimensions,'Group fill','groupTint','%').classList.add('ctm-effect-card');
    const interaction=addGrid(section('Interaction'));
    rangeField(interaction,'Hover intensity','hoverTint','%').classList.add('ctm-refined-wide','ctm-effect-card');

    function matchesPreset(name) {
      const preset=availablePresets()[name];
      return draft && preset && Object.keys(THEME_DEFAULTS).every(key =>
        (draft[key]??THEME_DEFAULTS[key]) === (preset[key]??THEME_DEFAULTS[key]));
    }
    function updateSummary() {
      const targets=scope==='both'?['tabs','groups']:[scope];
      const count=targets.reduce((n,key)=>n+Object.keys(state.ui.appearances[key]||{}).length+(key==='groups'?state.groups.length:0),0);
      protectionSummary.textContent=overwrite
        ? `Overwrite will clear ${count} customized item(s) in the selected scope. Other items remain unchanged.`
        : `Keep protects custom properties on ${count} item(s). Unset properties follow the global theme.`;
    }
    function updatePreviewCard() {
      const theme=draft||THEME_DEFAULTS;
      preview.style.backgroundColor=theme.panelBg;
      preview.style.borderColor=theme.outline==='none'?'#686b77':'#555b6b';
      const groupBg=`color-mix(in srgb, ${theme.accent} ${theme.groupTint}%, ${theme.tabBg})`;
      previewGroup.style.background=groupBg;
      previewGroup.style.color=theme.accent;
      previewTab.style.background=colorWithOpacity(theme.tabBg,theme.tabBgOpacity);
      previewTab.style.color=theme.text;
      preview.style.minHeight=`54px`;
      previewTab.style.paddingInline=`${theme.widthPadding}px`;
      previewGroup.style.paddingInline=`${theme.widthPadding}px`;
      preview.style.columnGap=`${theme.gap}px`;
      preview.style.justifyContent=theme.tabAlignment==='center'?'center':theme.tabAlignment==='right'?'flex-end':'flex-start';
      for (const element of [previewGroup,previewTab]) {
        element.style.border=theme.outline==='none'?'0':`${theme.outline==='bold'?2:1}px solid ${theme.accent}`;
        element.style.borderRadius=`${theme.radius}px`;
        element.style.fontFamily=theme.fontFamily;
        element.style.fontSize=`${theme.fontSize}px`;
        element.style.fontWeight=String(theme.fontWeight);
        element.style.fontStyle=theme.italic?'italic':'normal';
        element.style.textShadow='none';
        element.style.boxShadow='none';
        element.style.height='31px';
      }
    }
    function previewDraft() {
      themePreview=draft;
      themePreviewActive=true;
      themePreviewScope=scope;
      themePreviewOverwrite=overwrite;
      updatePreviewCard();applyTheme();
    }
    function updateDraft(key,value) {
      draft=normalizeTheme({...THEME_DEFAULTS,...(draft||{}),[key]:value});
      presetSelect.value='Custom';previewDraft();
    }
    function updateFields() {
      const theme=draft||THEME_DEFAULTS;
      for(const c of controls) {
        if(c.input.type==='checkbox') c.input.checked=!!theme[c.key];
        else c.input.value=String(theme[c.key]);
        if(c.hex)c.hex.textContent=String(theme[c.key]).toUpperCase();
        if(c.input.type==='range')c.value.textContent=`${c.input.value}${c.unit}`;
      }
      updatePreviewCard();
    }
    scopeSelect.addEventListener('change',()=>{
      scope=scopeSelect.value;
      const current=themeScopes()[scope==='groups'?'groups':'tabs'];
      draft=current?{...current}:null;
      presetSelect.value=draft===null?'Classic':Object.keys(availablePresets()).find(matchesPreset)||'Custom';
      updateFields();updateSummary();previewDraft();
    });
    modeSelect.addEventListener('change',()=>{overwrite=modeSelect.value==='overwrite';updateSummary();previewDraft();});
    presetSelect.value=draft===null?'Classic':Object.keys(availablePresets()).find(matchesPreset)||'Custom';
    presetSelect.addEventListener('change',()=>{
      draft=presetSelect.value==='Custom'?normalizeTheme({...THEME_DEFAULTS,...(draft||{})}):availablePresets()[presetSelect.value]?normalizeTheme(availablePresets()[presetSelect.value]):null;
      updateFields();previewDraft();
    });
    const actions=el('div','ctm-popover-actions');
    actions.append(button('Reset','ctm-action',()=>{draft=null;presetSelect.value='Classic';updateFields();previewDraft();}));
    actions.append(button('Cancel','ctm-action',removePopover));
    actions.append(button('Apply Theme','ctm-action ctm-primary',()=>{
      if(overwrite) {
        const targets=scope==='both'?['tabs','groups']:[scope];
        const count=targets.reduce((n,key)=>n+Object.keys(state.ui.appearances[key]||{}).length+(key==='groups'?state.groups.length:0),0);
        if(count&&!window.confirm(`Overwrite ${count} custom item(s) in selected scope? Workflow files will not change.`))return;
      }
      commitTheme(draft,scope,overwrite);
      themePreview=null;themePreviewActive=false;themePreviewOverwrite=false;
      persist();removePopover();render(true);
    }));
    panel.append(actions);
    showPopover(anchor,panel);
    updateSummary();updateFields();previewDraft();
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
  // Restoring a session is strictly opt-in. No workflow is closed, duplicated,
  // renamed or saved here. The native ComfyUI workflow service owns its tabs.
  function maybeOfferWorkflowRestore() {
    if (restorePromptHandled || restoringWorkflows || !syncReady || conflict || dirty ||
        !nativeStrip?.isConnected || !bar?.isConnected) return;
    // Debounce startup: let ComfyUI finish hydrating its own saved tabs first.
    if (!maybeOfferWorkflowRestore.readyAt) maybeOfferWorkflowRestore.readyAt = Date.now() + 3300;
    if (Date.now() < maybeOfferWorkflowRestore.readyAt) return;
    const missing = missingRestorePaths();
    if (!missing.length) { restorePromptHandled = true; return; }
    const signature = serverRevision || 'unsynced';
    try {
      if (sessionStorage.getItem(RESTORE_DISMISSED) === signature) {
        restorePromptHandled = true; return;
      }
    } catch (_) { /* private browsing may block session storage */ }
    restorePromptHandled = true;
    showWorkflowRestoreOffer(false);
  }

  function showWorkflowRestoreOffer(manual = false) {
    if (restorePanel) restorePanel.remove();
    if (!manual && (!syncReady || conflict || dirty)) return;
    const missing = missingRestorePaths();
    const card = el('div', 'ctm-restore-offer');
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', 'Restore saved workflow tabs');
    card.append(el('h3', 'ctm-restore-heading', 'Restore saved groups & workflows?'));
    const message = el('p', 'ctm-restore-message', missing.length
      ? `${missing.length} saved workflow tab${missing.length === 1 ? ' is' : 's are'} missing from this browser. Reopen them in their saved groups?`
      : 'All remembered workflow tabs are already open in this browser.');
    card.append(message);
    card.append(el('p', 'ctm-restore-note', 'Your current tabs and unsaved edits will remain untouched. Only workflows available in this ComfyUI installation can be reopened.'));
    const status = el('p', 'ctm-restore-status', '');
    status.setAttribute('aria-live', 'polite');
    card.append(status);
    const controls = el('div', 'ctm-restore-controls');
    const close = () => { card.remove(); if (restorePanel === card) restorePanel = null; };
    const dismiss = button('Not now', 'ctm-action', () => {
      // The automatic offer appears once per browser session/revision. The
      // settings menu always provides a manual way to reopen it.
      if (!manual) {
        try { sessionStorage.setItem(RESTORE_DISMISSED, serverRevision || 'unsynced'); } catch (_) {}
      }
      close();
    });
    controls.append(dismiss);
    const restore = button('Restore', 'ctm-action ctm-primary', async () => {
      if (restoringWorkflows) return;
      restoringWorkflows = true;
      restore.disabled = true; dismiss.disabled = true;
      const requested = missingRestorePaths();
      const service = app?.extensionManager?.workflow;
      // ComfyUI's workflow store has an explicit background-only operation.
      // Its ordinary openWorkflow() changes the active workflow, which could
      // disturb unsaved work, so NEVER use that as a fallback here.
      if (!service || typeof service.getWorkflowByPath !== 'function' ||
          typeof service.openWorkflowsInBackground !== 'function') {
        status.textContent = 'This ComfyUI frontend does not support safe background tab restoration. No tabs were changed.';
        restore.disabled = false; dismiss.disabled = false; restoringWorkflows = false;
        return;
      }
      const valid = [], skipped = [];
      for (const path of requested) {
        const workflow = service.getWorkflowByPath(path);
        if (!workflow || workflow.isTemporary || workflow.isPersisted !== true) skipped.push(path);
        else valid.push(path);
      }
      try {
        status.textContent = `Restoring ${valid.length} saved workflow tabs…`;
        // Opening in background never selects a different canvas or replaces
        // the currently active unsaved draft. Duplicate paths are ignored by
        // ComfyUI's store implementation.
        service.openWorkflowsInBackground({right: valid});
        await new Promise(resolve => setTimeout(resolve, 250));
        const opened = valid.filter(path => workflows().some(w => w.path === path)).length;
        status.textContent = `Finished: ${opened} reopened, ${skipped.length} unavailable, ${valid.length - opened} not confirmed.`;
        if (opened === 0 && valid.length > 0) status.textContent += ' Check your ComfyUI frontend compatibility.';
      } catch (error) {
        console.warn('[ComfyUI Tab Manager] Background restore failed:', error);
        status.textContent = 'ComfyUI could not restore the saved tabs. Your existing tabs were not closed.';
      }
      dismiss.textContent = 'Close'; dismiss.disabled = false;
      restoringWorkflows = false;
      queueRender();
    });
    restore.disabled = missing.length === 0;
    controls.append(restore);
    card.append(controls);
    document.body.append(card);
    restorePanel = card;
  }

  // v1.55.x exposes paths on the native DOM; Reka Tabs (v1.59.x) does not.
  // The workflow store is the authoritative source for paths in the new UI.
  // A workflow is unsaved when ComfyUI reports unsaved edits or when the
  // workflow has never been persisted. Native tab markers are folded in by mapTabs().
  function isUnsavedWorkflow(w) {
    return !!(w?.isModified || w?.isDirty || w?.isPersisted === false);
  }
  function storeWorkflows() {
    try {
      const store = app.extensionManager?.workflow;
      const list = store?.openWorkflows;
      if (!Array.isArray(list)) return [];
      // Some frontend builds expose modification state only on the active workflow.
      const active = store?.activeWorkflow;
      return list.flatMap(w => {
        const path = typeof w?.path === 'string' ? w.path : '';
        if (!path) return [];
        const activeModified = active && active.path === path ? !!active.isModified : false;
        return [{
          path,
          filename: typeof w.filename === 'string' && w.filename ? w.filename : path.split('/').pop(),
          isModified: !!(w.isModified || w.isDirty) || activeModified,
          isPersisted: w.isPersisted !== false
        }];
      });
    } catch (error) {
      console.warn('[ComfyUI Tab Manager] Cannot read the workflow store:', error);
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
    // Native builds use different dirty-marker test ids; any of them counts.
    return !!node.querySelector('[data-testid*="dirty"]');
  }
  // Mapping never invents workflow paths from filenames. Ambiguous or incomplete
  // mappings fail open to native ComfyUI tabs rather than risk wrong assignments.
  function mapTabs(nodes) {
    nodeByPath = new Map();
    pathByNode = new WeakMap();
    if (!nodes.length) { detectionMode = 'empty'; return []; }
    const register = (node, wf) => {
      nodeByPath.set(wf.path, node);
      pathByNode.set(node, wf);
      return wf;
    };
    if (nodes.every(node => !!node.getAttribute(LEGACY_PATH_ATTR))) {
      detectionMode = 'legacy';
      return nodes.map(node => {
        const path = node.getAttribute(LEGACY_PATH_ATTR);
        return register(node, {
          path, filename: tabFilename(node) || path.split('/').pop() || path,
          isModified: tabDirty(node), isPersisted: true
        });
      });
    }
    const store = storeWorkflows();
    const labels = nodes.map(tabFilename);
    // The tab bar renders openWorkflows in order. Accept positional matching
    // only when all available labels agree; one coincidental match is unsafe.
    if (store.length === nodes.length &&
        labels.every((label, i) => label && label === store[i].filename)) {
      detectionMode = 'store';
      return nodes.map((node, i) => register(node, {
        ...store[i], isModified: store[i].isModified || tabDirty(node)
      }));
    }
    // During reordered DOM updates, match by unique filename only. Never pair
    // duplicate names arbitrarily (different paths can share a filename).
    const counts = new Map();
    for (const w of store) counts.set(w.filename, (counts.get(w.filename) || 0) + 1);
    const unique = new Map(store.filter(w => counts.get(w.filename) === 1).map(w => [w.filename, w]));
    const matched = labels.map(label => label && unique.get(label));
    if (store.length === nodes.length && matched.every(Boolean) &&
        new Set(matched.map(w => w.path)).size === nodes.length) {
      detectionMode = 'filename';
      return nodes.map((node, i) => register(node, {
        ...matched[i], isModified: matched[i].isModified || tabDirty(node)
      }));
    }
    detectionMode = 'unresolved';
    return nodes.map(() => null);
  }
  function workflows() {
    return mapTabs(nativeTabs()).filter(Boolean);
  }
  function nativeToggle(tab) {
    if (!tab) return null;
    // Legacy (Frontend 1.55.x): data-testid="workflow-tab" lives INSIDE the
    // activation button and also contains a nested close button. Picking a
    // descendant button before the parent ACTIVATES THE CLOSE BUTTON instead.
    // Reka (Frontend 1.59.x): the trigger may be the tab itself or a child.
    const parentTrigger = tab.closest('[role="tab"]') || tab.closest('button');
    if (parentTrigger) return parentTrigger;
    const childTrigger = tab.querySelector('[role="tab"]');
    if (childTrigger) return childTrigger;
    // Never choose an inner close button as an activation fallback.
    return [...tab.querySelectorAll('button')].find(button =>
      !button.closest('[data-testid="close-workflow-button"], [data-testid="workflow-close-button"]') &&
      !/\b(close|delete|remove)\b/i.test(button.getAttribute('aria-label') || '')
    ) || null;
  }
  function activePath() {
    try {
      const path = app.extensionManager?.workflow?.activeWorkflow?.path;
      if (path && nodeByPath.has(path)) return path;
    } catch (_error) { /* use native tab state */ }
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
    return null;
  }
  function getNativeTab(path) {
    const mapped = nodeByPath.get(path);
    if (mapped?.isConnected) return mapped;
    // A Vue re-render can replace the native element between renders/clicks.
    mapTabs(nativeTabs());
    return nodeByPath.get(path) || null;
  }
  function activateNativeTab(trigger) {
    // Reka TabsTrigger listens to mousedown; the old layout listens to click.
    const rect = trigger.getBoundingClientRect();
    const init = {
      bubbles: true, cancelable: true, composed: true, view: window,
      button: 0, buttons: 1, detail: 1,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2
    };
    if (typeof PointerEvent === 'function') {
      trigger.dispatchEvent(new PointerEvent('pointerdown', {
        ...init, pointerId: 1, pointerType: 'mouse', isPrimary: true
      }));
    }
    trigger.dispatchEvent(new MouseEvent('mousedown', init));
    if (typeof PointerEvent === 'function') {
      trigger.dispatchEvent(new PointerEvent('pointerup', {
        ...init, buttons: 0, pointerId: 1, pointerType: 'mouse', isPrimary: true
      }));
    }
    trigger.dispatchEvent(new MouseEvent('mouseup', { ...init, buttons: 0 }));
    trigger.dispatchEvent(new MouseEvent('click', { ...init, buttons: 0 }));
  }
  function openWorkflowViaStore(path) {
    try {
      const store = app.extensionManager?.workflow;
      const workflow = store?.openWorkflows?.find(w => w?.path === path);
      if (workflow && typeof store.openWorkflow === 'function') {
        store.openWorkflow(workflow);
        return true;
      }
    } catch (error) {
      console.warn('[ComfyUI Tab Manager] Cannot switch workflows through the store:', error);
    }
    return false;
  }
  function openWorkflow(path) {
    const native = getNativeTab(path);
    const trigger = nativeToggle(native);
    if (trigger) {
      // Preserve the EXACT legacy click behavior. Synthetic pointer/mousedown
      // sequences are only necessary for Reka TabsTrigger, and should not be
      // sent to the old PrimeVue buttons.
      if (native?.hasAttribute(LEGACY_PATH_ATTR)) trigger.click();
      else activateNativeTab(trigger);
    } else if (!openWorkflowViaStore(path)) {
      console.warn('[ComfyUI Tab Manager] Cannot activate native workflow tab:', path);
    }
    queueRender();
  }
  function nativeMappingIncomplete(strip = nativeStrip) {
    if (!strip) return false;
    const nodes = [...strip.querySelectorAll(TAB_SELECTOR)];
    if (!nodes.length) return storeWorkflows().length > 0;
    const mapped = mapTabs(nodes);
    return mapped.some(w => !w) || new Set(mapped.map(w => w?.path)).size !== mapped.length;
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
    if (previewDockCleanup) { previewDockCleanup(); previewDockCleanup = null; }
    if (popover) { popover.remove(); popover = null; }
    individualPreview = null;
    themePreview = null;
    themePreviewActive = false;
    themePreviewOverwrite = false;
    applyTheme();
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
    if (node.classList.contains('ctm-individual-editor')) node.style.setProperty('--ctm-dialog-top',`${y}px`);
    applyTheme();
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
    const panel = el('div', 'ctm-group-editor ctm-centered-editor');
    addPopoverHeader(panel, existing ? 'Edit Group' : parent ? `New Subgroup in \"${parent.name}\"` : 'New Tab Group');
    const lab = el('label', 'ctm-group-name-label', 'Name');
    const input = el('input'); input.type = 'text'; input.maxLength = 80;
    input.value = existing ? existing.name : '';
    input.placeholder = 'Enter a group name';
    panel.append(lab, input);
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
    panel.append(customColorLabel, colorPicker);
    if (existing) {
      const tools = el('div', 'ctm-group-tools');
      tools.append(button('＋ Add Subgroup', 'ctm-action', () => showGroupEditor(anchor, null, groupId), 'Create a new group inside this group'));
      tools.append(button('← Move Left', 'ctm-action', () => { moveSibling(groupId, -1); removePopover(); }, 'Move left within the same level'));
      tools.append(button('Move Right →', 'ctm-action', () => { moveSibling(groupId, 1); removePopover(); }, 'Move right within the same level'));
      if (existing.parentId) {
        tools.append(button('↖ Top Level', 'ctm-action', () => { moveGroup(groupId, null, 'root'); removePopover(); }, 'Move subgroup back to the top level'));
      }
      panel.append(tools);
      panel.append(button('👽Customize Group👽', 'ctm-action ctm-customize-launch', () => showIndividualAppearanceEditor(anchor, 'group', groupId)));
      panel.append(el('div', 'ctm-hint', 'Drag a group: left/right edge to reorder; center to nest it.'));
    }
    const actions = el('div', 'ctm-popover-actions');
    if (existing) {
      actions.append(button('Delete', 'ctm-action ctm-danger', () => {
        // Removing a folder never closes workflows or deletes any JSON files.
        // Child groups are promoted to the removed folder's parent level.
        for (const child of childrenOf(groupId)) child.parentId = existing.parentId ?? null;
        state.groups = state.groups.filter(g => g.id !== groupId);
        delete state.ui.appearances.groups[groupId];
        delete state.ui.inheritGroupAppearance[groupId];
        delete state.ui.inheritGroupDesign[groupId];
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
    panel.append(customLabel, colorPicker);
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
  function setupIndividualPreviewDock(panel, body, preview) {
    const header = panel.querySelector('.ctm-popover-header');
    const footer = panel.querySelector(':scope > .ctm-popover-actions');
    const spacer = el('div','ctm-preview-scroll-spacer');
    spacer.setAttribute('aria-hidden','true'); body.append(spacer);
    let mode = '', normalHeight = preview.getBoundingClientRect().height, frame = 0;
    function layout() {
      frame = 0;
      if (!panel.isConnected) return;
      if (mode !== 'compact') normalHeight = preview.getBoundingClientRect().height;
      const rowHeight = body.querySelector('.ctm-individual-field')?.getBoundingClientRect().height || 32;
      const disclosureHeight = body.querySelector('summary')?.getBoundingClientRect().height || 32;
      const available = innerHeight - panel.getBoundingClientRect().top - 8 - header.offsetHeight - footer.offsetHeight;
      const canDock = available >= normalHeight + rowHeight * 3 + disclosureHeight;
      const next = !canDock ? 'flow' : body.scrollTop >= 64 ? 'compact' : body.scrollTop <= 8 ? 'normal' : mode === 'compact' ? 'compact' : 'normal';
      const scroll = body.scrollTop;
      if (next !== mode) {
        mode = next; preview.dataset.previewMode = mode;
        if (mode === 'flow') body.prepend(preview);
        else header.after(preview);
      }
      // Compensate for the space released by compaction, so scrollTop does not clamp
      // and trigger an inverse mode change when the user is near the end of the form.
      const compensation = mode === 'compact' ? Math.max(0,normalHeight-preview.getBoundingClientRect().height) : 0;
      const height = `${compensation}px`;
      if (spacer.style.height !== height) spacer.style.height = height;
      if (body.scrollTop !== scroll) body.scrollTop = scroll;
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(layout); };
    const observer = new ResizeObserver(schedule);
    observer.observe(panel); observer.observe(preview); observer.observe(footer);
    body.addEventListener('scroll',schedule,{passive:true});
    window.addEventListener('resize',schedule);
    layout();
    return () => {
      observer.disconnect(); body.removeEventListener('scroll',schedule);
      window.removeEventListener('resize',schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }
  function showIndividualAppearanceEditor(anchor, kind, id) {
    const isGroup = kind === 'group';
    const name = isGroup ? state.groups.find(g => g.id === id)?.name : workflows().find(w => w.path === id)?.filename;
    const panel = el('div', 'ctm-individual-editor');
    addPopoverHeader(panel, `Customize ${isGroup ? 'Group' : 'Tab'}`);
    const body = el('div','ctm-individual-body');
    panel.append(body);
    const previewSection = el('section','ctm-individual-preview-section');
    previewSection.append(el('h4','ctm-section-title','Live Preview'));
    body.append(previewSection);
    const basic = el('section','ctm-individual-section');
    basic.append(el('h4','ctm-section-title','Appearance'));
    basic.append(el('div','ctm-hint','Check Override to set a property. Unchecked properties inherit.'));
    const columns = el('div','ctm-individual-columns');
    columns.append(el('span','','Property'),el('span','','Override'),el('span','','Value'));
    basic.append(columns); body.append(basic);
    const inheritance = el('section','ctm-individual-section ctm-inheritance-section');
    inheritance.append(el('h4','ctm-section-title','Inheritance'));
    const advanced = el('details','ctm-individual-advanced');
    advanced.append(el('summary','','Advanced'));
    const advancedSections = {};
    for (const title of ['Borders & Shape','Background & Effects','Typography']) {
      const section = el('section','ctm-individual-section');
      section.append(el('h4','ctm-section-title',title));
      advancedSections[title] = section; advanced.append(section);
    }
    const table = isGroup ? state.ui.appearances.groups : state.ui.appearances.tabs;
    const current = normalizeAppearance(table[id]);
    const draft = { ...current };
    let propagate = null, propagateDesign = null;
    if (isGroup) {
      const label = el('label', 'ctm-individual-field ctm-inheritance-field');
      label.append(el('span', '', 'Share typography with descendants'));
      propagate = el('input'); propagate.type = 'checkbox';
      propagate.checked = state.ui.inheritGroupAppearance[id] === true;
      label.append(propagate); inheritance.append(label);
      const designLabel = el('label','ctm-individual-field ctm-inheritance-field');
      designLabel.append(el('span','','Share design with descendants'));
      propagateDesign = el('input'); propagateDesign.type = 'checkbox';
      propagateDesign.checked = state.ui.inheritGroupDesign[id] === true;
      designLabel.append(propagateDesign); inheritance.append(designLabel);
      body.append(inheritance);
    }
    const fields = [
      ['Background color','background','color'], ['Accent color','accent','color'],
      ['Border color','borderColor','color'], ['Border width','borderWidth','design'],
      ['Corner radius','radius','design'], ['Background opacity','backgroundOpacity','design'],
      ['Text color','text','color'],
      ['Font family','fontFamily','font'], ['Font size','fontSize','number'],
      ['Font weight','fontWeight','weight'], ['Italic','italic','boolean']
    ];
    const effective = effectiveAppearance(kind,id,false);
    const global = themeScopes()[isGroup?'groups':'tabs'] || THEME_DEFAULTS;
    const inheritedDefaults = {...global,background:global.tabBg,borderColor:global.accent,
      borderWidth:global.outline==='none'?0:global.outline==='bold'?2:1,
      backgroundOpacity:global.tabBgOpacity};
    function addField(label, key, type) {
      const field = el('label','ctm-individual-field');
      field.append(el('span','',label));
      const enabled = el('input'); enabled.type = 'checkbox'; enabled.checked = Object.hasOwn(current,key);
      enabled.title = 'Use an individual value; uncheck to inherit this property';
      enabled.setAttribute('aria-label',`Override ${label}`);
      const control = el('select','ctm-theme-select');
      if (type === 'color') {
        control.remove();
      }
      let widget;
      if (type === 'color') { widget = el('input','ctm-theme-color'); widget.type='color'; widget.value = effective[key] || inheritedDefaults[key] || '#000000'; }
      else {
        widget = control;
        const options = type === 'design' ? Array.from({length:DESIGN_NUMBERS[key][1]+1},(_,i)=>[i,String(i)]) : type === 'font' ? FONT_FAMILIES.map(v=>[v,v]) :
          type === 'number' ? Array.from({length:13},(_,i)=>[i+10, `${i+10}px`]) :
          type === 'weight' ? [[400,'Regular'],[500,'Medium'],[600,'Semibold'],[700,'Bold'],[800,'Extra Bold']] :
          type === 'boolean' ? [['false','Normal'],['true','Italic']] :
          Array.from({length:13},(_,i)=>[i, i===0?'None':`${i}px`]);
        for (const [value,text] of options) { const opt=el('option','',text); opt.value=String(value); widget.append(opt); }
        widget.value = String(effective[key] ?? inheritedDefaults[key] ?? (type === 'font' ? 'inherit' : type === 'number' ? 12 : type === 'weight' ? 600 : type === 'boolean' ? false : 0));
      }
      function update() {
        widget.disabled = !enabled.checked;
        field.dataset.overridden = String(enabled.checked);
        if (!enabled.checked) { delete draft[key]; return; }
        let value = widget.value;
        if (type === 'number' || type === 'weight' || type === 'design') value = Number(value);
        if (type === 'boolean') value = value === 'true';
        draft[key] = value;
      }
      enabled.addEventListener('change', update); widget.addEventListener('input', update);
      enabled.addEventListener('change',previewIndividual); widget.addEventListener('input',previewIndividual);
      field.append(enabled,widget);
      const section = ['background','accent','text','fontSize'].includes(key) ? basic :
        advancedSections[['borderColor','borderWidth','radius'].includes(key) ? 'Borders & Shape' :
          ['backgroundOpacity'].includes(key) ? 'Background & Effects' : 'Typography'];
      section.append(field); update();
    }
    const previewSamples = el('div','ctm-individual-preview ctm-bar');
    previewSection.append(previewSamples);
    const groupName = isGroup ? name : state.groups.find(g=>g.id===state.assignments[id])?.name;
    const groupSample = el('div','ctm-group-label'); groupSample.append(el('span','ctm-group-name',groupName || 'Group preview'));
    const previewGroupId = isGroup ? id : state.assignments[id];
    if (previewGroupId) groupSample.dataset.previewGroupId = previewGroupId;
    groupSample.title = groupName || 'Group preview';
    const tabSample = el('div','ctm-tab');
    const samplePath = Object.keys(state.assignments).find(path => state.assignments[path] === id || isDescendantGroup(state.assignments[path],id));
    tabSample.dataset.previewTabPath = isGroup ? (samplePath || '__preview__') : id;
    const sampleName = isGroup ? workflows().find(w=>w.path===samplePath)?.filename || samplePath?.split('/').pop() : name;
    const previewName = sampleName || 'Workflow preview';
    tabSample.append(el('span','ctm-tab-main',previewName)); tabSample.title = previewName;
    previewSamples.append(groupSample,tabSample);
    function previewIndividual() {
      individualPreview = {scope:isGroup?'groups':'tabs',id,draft:normalizeAppearance(draft),typography:!!propagate?.checked,design:!!propagateDesign?.checked};
      applyTheme();
      previewSamples.dataset.tabAlignment = effectiveThemes().tabs?.tabAlignment || effectiveThemes().groups?.tabAlignment || 'left';
      styleItem(groupSample,'group',isGroup?id:state.assignments[id]);
      styleItem(tabSample,'tab',isGroup?(samplePath || '__preview__'):id);
    }
    for (const [label,key,type] of fields) addField(label,key,type);
    if (isGroup) {
      propagate.addEventListener('change',previewIndividual);
      propagateDesign.addEventListener('change',previewIndividual);

    }
    const advancedCount = fields.filter(([,key])=>!['background','accent','text','fontSize'].includes(key) && Object.hasOwn(current,key)).length;
    if (advancedCount) advanced.querySelector('summary').append(el('span','ctm-advanced-count',`${advancedCount} custom`));
    body.append(advanced);
    const actions=el('div','ctm-popover-actions');
    actions.append(button('Reset to Inherited','ctm-action',()=>{ delete table[id]; persist(); removePopover(); render(true); }));
    actions.append(button('Cancel','ctm-action',removePopover));
    actions.append(button('Save','ctm-action ctm-primary',()=>{
      const valid = normalizeAppearance(draft);
      if (valid.background) delete valid.preserveClassicSurface;
      if (Object.keys(valid).length) table[id]=valid; else delete table[id];
      if (isGroup) {
        if (propagate.checked) state.ui.inheritGroupAppearance[id] = true;
        else delete state.ui.inheritGroupAppearance[id];
        if (propagateDesign.checked) state.ui.inheritGroupDesign[id] = true;
        else delete state.ui.inheritGroupDesign[id];
      }
      persist(); removePopover(); render(true);
    }));
    panel.append(actions); showPopover(anchor,panel);
    previewIndividual();
    previewDockCleanup = setupIndividualPreviewDock(panel,body,previewSection);
  }
  function showTabMenu(anchor, path) {
    const panel = el('div', 'ctm-tab-menu ctm-centered-editor');
    const item = workflows().find(w => w.path === path);
    addPopoverHeader(panel, item?.filename || path.split('/').pop());
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
    panel.append(button('🌟Customize Tab🌟', 'ctm-action ctm-customize-launch', () => showIndividualAppearanceEditor(anchor, 'tab', path)));
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
    const unsaved = isUnsavedWorkflow(w);
    const node = el('div', `ctm-tab${selected ? ' ctm-selected' : ''}`);
    node.style.setProperty('--ctm-accent', state.ui.appearances.tabs[w.path]?.preserveClassicSurface || accent || '#a18eff');
    node.title = unsaved ? `${w.path} — unsaved changes` : w.path;
    node.draggable = true;
    node.dataset.path = w.path;
    // Unsaved work is shown as an amber ring on the tab border (see .ctm-unsaved).
    // The old inline dot was clipped by the label's ellipsis on long filenames.
    if (unsaved) {
      node.classList.add('ctm-unsaved');
      node.dataset.unsaved = 'true';
    }
    const main = button(w.filename || w.path.split('/').pop(), 'ctm-tab-main', () => openWorkflow(w.path));
    const moveButton = button('⋯', 'ctm-tab-group-button', event => {
      event.preventDefault(); event.stopPropagation();
      showTabMenu(moveButton, w.path);
    }, 'Move to Group');
    moveButton.setAttribute('aria-label', `Move ${w.filename || 'workflow'} to Group`);
    node.append(main, moveButton);
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
  function transferWorkflowMetadata(oldPath, newPath) {
    if (!oldPath || !newPath || oldPath === newPath) return false;
    let changed = false;
    if (Object.hasOwn(state.assignments, oldPath)) {
      // Never destroy an already-customized destination assignment.
      if (!Object.hasOwn(state.assignments, newPath)) {
        state.assignments[newPath] = state.assignments[oldPath];
        changed = true;
      }
      delete state.assignments[oldPath]; changed = true;
    }
    if (Object.hasOwn(state.ui.appearances.tabs, oldPath)) {
      if (!Object.hasOwn(state.ui.appearances.tabs, newPath)) {
        state.ui.appearances.tabs[newPath] = state.ui.appearances.tabs[oldPath];
        changed = true;
      }
      delete state.ui.appearances.tabs[oldPath]; changed = true;
    }
    if (state.ui.restorePaths.includes(oldPath) && isRestorablePath(newPath)) {
      state.ui.restorePaths = normalizeRestorePaths(state.ui.restorePaths.map(path => path === oldPath ? newPath : path));
      changed = true;
    }
    return changed;
  }
  function syncPaths() {
    const current = nativeTabs().map(node => ({
      node,
      path: pathByNode.get(node)?.path || node.getAttribute(LEGACY_PATH_ATTR),
      name: tabFilename(node)
    })).filter(entry => !!entry.path);
    let changed = false;
    // Best signal: ComfyUI reuses the exact native tab element and changes its path.
    for (const entry of current) {
      const previous = oldPaths.get(entry.node);
      if (previous && previous !== entry.path) {
        changed = transferWorkflowMetadata(previous, entry.path) || changed;
      }
    }
    // Some ComfyUI builds REPLACE the DOM node on Rename/Save As. The old
    // WeakMap loses its identity, so require the same number of tabs, precisely
    // one old path gone, one new path added, and an unchanged tab position.
    // This is deliberately conservative: never guess during a bulk tab change.
    if (nativeTabSnapshot.length && current.length === nativeTabSnapshot.length) {
      const priorPaths = new Set(nativeTabSnapshot.map(x => x.path));
      const currentPaths = new Set(current.map(x => x.path));
      const removed = nativeTabSnapshot.filter(x => !currentPaths.has(x.path));
      const added = current.filter(x => !priorPaths.has(x.path));
      if (removed.length === 1 && added.length === 1) {
        const from = nativeTabSnapshot.findIndex(x => x.path === removed[0].path);
        const to = current.findIndex(x => x.path === added[0].path);
        const sameNeighbors = (from === to) && current.every((x, index) => index === to || x.path === nativeTabSnapshot[index].path);
        if (sameNeighbors) changed = transferWorkflowMetadata(removed[0].path, added[0].path) || changed;
      }
    }
    for (const entry of current) oldPaths.set(entry.node, entry.path);
    nativeTabSnapshot = current.map(({path,name}) => ({path,name}));
    if (changed) persist();
  }
  function signature() {
    return JSON.stringify([
      workflows().map(w => [w.path, w.filename, !!w.isModified, w.isPersisted !== false]),
      activePath() || '',
      state.groups.map(g => [g.id, g.name, g.color, g.collapsed, g.parentId]),
      state.assignments,
      state.ui.createButtonColor, state.ui.themeScopes, state.ui.appearances, state.ui.customPresets, state.ui.inheritGroupAppearance, state.ui.inheritGroupDesign
    ]);
  }
  // Keep native canvas input behavior unchanged: only the custom tab lane
  // responds to scrolling, and the new arrows appear only on actual overflow.
  function updateScrollArrows(items, left, right) {
    if (!items?.isConnected || !bar?.isConnected) return;
    const showing = bar.classList.contains('ctm-has-overflow');
    const gap = parseFloat(getComputedStyle(bar).columnGap) || 0;
    // The CSS width is fixed; hidden buttons report offsetWidth=0.
    const arrowWidth = 24;
    const availableWithoutArrows = items.clientWidth + (showing ? 2 * arrowWidth + 2 * gap : 0);
    const overflowing = items.scrollWidth > availableWithoutArrows + 2;
    if (showing !== overflowing) {
      bar.classList.toggle('ctm-has-overflow', overflowing);
      requestAnimationFrame(() => updateScrollArrows(items, left, right));
    }
    if (!overflowing) {
      left.disabled = true; right.disabled = true;
      return;
    }
    const max = Math.max(0, items.scrollWidth - items.clientWidth);
    left.disabled = items.scrollLeft <= 1;
    right.disabled = items.scrollLeft >= max - 1;
  }
  function scrollActiveIntoView(items) {
    // Prefer the actual active tab; collapsed groups expose their active ancestor.
    const target = items.querySelector('.ctm-tab.ctm-selected') ||
      items.querySelector('.ctm-group-label.ctm-active-closed');
    if (!target) return;
    const view = items.getBoundingClientRect();
    const rect = target.getBoundingClientRect();
    const margin = 10;
    if (rect.left < view.left + margin) items.scrollLeft -= view.left + margin - rect.left;
    else if (rect.right > view.right - margin) items.scrollLeft += rect.right - (view.right - margin);
  }
  function scrollLaneBy(items, distance) {
    const max = Math.max(0, items.scrollWidth - items.clientWidth);
    items.scrollLeft = Math.max(0, Math.min(max, items.scrollLeft + distance));
  }
  function render(force = false) {
    if (!bar || !root || !root.isConnected || !nativeStrip?.isConnected) return;
    // Restore the native bar immediately if the frontend becomes unresolvable.
    if (nativeMappingIncomplete()) {
      lastConnectProblem = 'unmapped-tabs';
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
    // Roll unsaved state up to ancestor groups so a collapsed group can still warn.
    const unsavedGroupIds = new Set();
    for (const w of open) {
      if (!isUnsavedWorkflow(w)) continue;
      let owner = groupFor(w.path);
      while (owner && !unsavedGroupIds.has(owner)) {
        unsavedGroupIds.add(owner);
        owner = state.groups.find(g => g.id === owner)?.parentId ?? null;
      }
    }
    const currentActive = activePath();
    const activeOwner = currentActive ? groupFor(currentActive) : null;
    const activeChanged = currentActive !== lastRenderedActivePath;
    // Resolve alignment before creating group buttons so caret orientation is current.
    const effectiveAlignment = effectiveThemes().tabs?.tabAlignment || effectiveThemes().groups?.tabAlignment || 'left';
    bar.dataset.tabAlignment = effectiveAlignment;
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
      // Activity is native workflow ownership; expansion only controls content visibility.
      const activity = groupActivity(group.id,activeOwner);
      const {isCollapsed,containsActiveWorkflow,containsActiveDescendant} = activity;
      const title = button('', `ctm-group-label${containsActiveWorkflow ? ' ctm-active' : ''}`, () => {
        // HTML drag sometimes produces a click afterwards; do not toggle in that case.
        if (Date.now() - dragEndTime > 250) toggleGroup(group.id);
      });
      title.style.setProperty('--ctm-color', group.color);
      applyGroupActivity(title,group.id,activity);
      // Collapsed groups hide their tabs; surface hidden unsaved work on the header.
      title.classList.toggle('ctm-has-unsaved', isCollapsed && unsavedGroupIds.has(group.id));
      title.title = `${group.name} (${descendantCount(group.id)}) • Drag: left/right to reorder, center to nest • Right-click to edit`;
      title.setAttribute('aria-expanded', String(!isCollapsed));
      title.setAttribute('aria-label', `${group.name}, ${descendantCount(group.id)} Workflows, ${isCollapsed ? 'collapsed' : 'expanded'}${containsActiveWorkflow ? ', contains active workflow' : containsActiveDescendant ? ', contains active descendant workflow' : ''}`);
      title.draggable = true;
      title.dataset.groupId = group.id;
      title.append(el('span', 'ctm-group-name', group.name));
      title.append(el('span', 'ctm-count', descendantCount(group.id)));
      const rightAligned = bar.dataset.tabAlignment === 'right';
      const caret = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      caret.classList.add('ctm-caret');
      caret.setAttribute('viewBox', '0 0 16 16');
      caret.setAttribute('aria-hidden', 'true');
      caret.setAttribute('focusable', 'false');
      const chevron = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      chevron.setAttribute('d', isCollapsed
        ? (rightAligned ? 'M10 4 L6 8 L10 12' : 'M6 4 L10 8 L6 12')
        : 'M4 6 L8 10 L12 6');
      caret.append(chevron);
      title.append(caret);
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
      if (!isCollapsed) {
        const contents = el('div', 'ctm-group-contents');
        contents.style.setProperty('--ctm-parent-color', group.color);
        for (const w of members) contents.append(tabNode(w, group.color));
        const childGroups = childrenOf(group.id);
        if (childGroups.length) {
          const nested = el('div', 'ctm-subgroups');
          nested.style.setProperty('--ctm-parent-color', group.color);
          for (const child of childGroups) nested.append(makeGroupNode(child, depth + 1));
          contents.append(nested);
        }
        if (contents.childNodes.length) groupNode.append(contents);
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
    const alignmentInner = el('div','ctm-items-inner');
    alignmentInner.append(fragment);
    items.append(alignmentInner);
    const settings = button('⚙', 'ctm-storage-button', () => showLayoutSettings(settings), 'Layout Storage / Import / Export');
    settings.setAttribute('aria-label', 'Layout Storage and Backups');
    const previousItems = bar.querySelector('.ctm-items');
    const previousScroll = previousItems?.scrollLeft ?? 0;
    const wasAtRightEdge = !!previousItems &&
      previousItems.scrollWidth - previousItems.clientWidth - previousScroll <= 1;
    const previousAlignment = lastTabAlignment;
    const newAlignment = effectiveThemes().tabs?.tabAlignment || effectiveThemes().groups?.tabAlignment || 'left';
    const scrollLeft = button('‹', 'ctm-scroll-arrow ctm-scroll-left', () =>
      scrollLaneBy(items, -Math.max(120, Math.round(items.clientWidth * 0.7))), 'Scroll workflow tabs left');
    const scrollRight = button('›', 'ctm-scroll-arrow ctm-scroll-right', () =>
      scrollLaneBy(items, Math.max(120, Math.round(items.clientWidth * 0.7))), 'Scroll workflow tabs right');
    scrollLeft.setAttribute('aria-label', 'Scroll workflow tabs left');
    scrollRight.setAttribute('aria-label', 'Scroll workflow tabs right');
    scrollLeft.disabled = true;
    scrollRight.disabled = true;
    bar.classList.remove('ctm-has-overflow');

    const track=el('div','ctm-scroll-track');
    const thumb=el('div','ctm-scroll-thumb');track.append(thumb);
    bar.replaceChildren(settings, create, rootDrop, scrollLeft, items, scrollRight, track);
    items.scrollLeft=previousScroll;
    lastRenderedActivePath = currentActive;
    setupScrollTrack(items,track,thumb,scrollLeft,scrollRight);
    applyTheme();
    lastTabAlignment = newAlignment;
    requestAnimationFrame(() => {
      if (!items.isConnected || bar?.querySelector('.ctm-items') !== items) return;
      updateScrollArrows(items,scrollLeft,scrollRight);
      // With right alignment, the first root group should be visible at the right edge.
      if (newAlignment === 'right' && (previousAlignment !== newAlignment || wasAtRightEdge)) {
        items.scrollLeft = Math.max(0, items.scrollWidth - items.clientWidth);
      }
      if (activeChanged) scrollActiveIntoView(items);
      updateScrollArrows(items,scrollLeft,scrollRight);
    });
  }
  // Browser scrollbar tracks reserve vertical pixels. Use a non-layout overlay thumb
  // instead: the tabs keep their fixed height even with hundreds of visible items.
  function setupScrollTrack(items, track, thumb, leftArrow, rightArrow) {
    const update = () => {
      if (!items.isConnected || !bar) return;
      const overflow = items.scrollWidth - items.clientWidth;
      updateScrollArrows(items,leftArrow,rightArrow);
      track.hidden = overflow <= 1;
      if (track.hidden) return;
      track.style.left = `${items.offsetLeft}px`;
      track.style.width = `${items.clientWidth}px`;
      const width = Math.max(26, Math.round(items.clientWidth * items.clientWidth / items.scrollWidth));
      thumb.style.width = `${Math.min(width,items.clientWidth)}px`;
      thumb.style.transform = `translateX(${Math.round(items.scrollLeft / overflow * Math.max(0,items.clientWidth-width))}px)`;
    };
    items.addEventListener('scroll', update, {passive:true});
    // Native wheel gestures and Shift+wheel can scroll without affecting ComfyUI's canvas.
    items.addEventListener('wheel', event => {
      const overflow = items.scrollWidth-items.clientWidth;
      if (overflow <= 1) return;
      const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY);
      // A vertical wheel over an overflowing horizontal row scrolls that row.
      if (!horizontal && event.ctrlKey) return;
      let delta = horizontal ? event.deltaX : event.deltaY;
      if (event.deltaMode === 1) delta *= 18;
      else if (event.deltaMode === 2) delta *= Math.max(120,items.clientWidth);
      if (!delta || dragPath || dragGroupId) return;
      const next = Math.max(0,Math.min(overflow,items.scrollLeft+delta));
      if (next !== items.scrollLeft) {event.preventDefault();items.scrollLeft=next;}
    },{passive:false});
    track.addEventListener('pointerdown',event=>{
      if (event.button!==0)return;
      event.preventDefault();event.stopPropagation();
      const rect=track.getBoundingClientRect();
      const target = event.target === thumb ? items.scrollLeft :
        Math.max(0, (event.clientX-rect.left-(thumb.offsetWidth/2)) / Math.max(1,track.clientWidth-thumb.offsetWidth))*(items.scrollWidth-items.clientWidth);
      items.scrollLeft=target;
      const startX=event.clientX, startScroll=items.scrollLeft;
      track.setPointerCapture(event.pointerId);
      const move=ev=>{items.scrollLeft=startScroll+(ev.clientX-startX)/Math.max(1,track.clientWidth-thumb.offsetWidth)*(items.scrollWidth-items.clientWidth);};
      const stop=()=>{track.removeEventListener('pointermove',move);track.removeEventListener('pointerup',stop);track.removeEventListener('pointercancel',stop);};
      track.addEventListener('pointermove',move);track.addEventListener('pointerup',stop);track.addEventListener('pointercancel',stop);
    });
    requestAnimationFrame(update);
    if (typeof ResizeObserver !== 'undefined') {
      const observer=new ResizeObserver(update);
      observer.observe(items);
      observer.observe(bar);
      // Avoid retaining per-render observers: disconnect the previous one explicitly.
      if (bar.__ctmScrollObserver) bar.__ctmScrollObserver.disconnect();
      bar.__ctmScrollObserver=observer;
    }
  }
  function queueRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => { renderQueued = false; render(); });
  }
  function detach() {
    removePopover();
    cleanupDrag();
    if (nativeObserver) { nativeObserver.disconnect(); nativeObserver = null; }
    if (bar?.__ctmScrollObserver) bar.__ctmScrollObserver.disconnect();
    if (bar) bar.remove();
    if (root) { root.classList.remove('ctm-ready','ctm-custom-bar-height'); root.style.removeProperty('--ctm-bar-height'); }
    if (nativeHost) nativeHost.classList.remove('ctm-native-host');
    root = null; bar = null; nativeStrip = null; nativeHost = null; lastSignature = ''; lastRenderedActivePath = null;
    nativeTabSnapshot = []; lastTabAlignment = null;
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
    if (nativeMappingIncomplete(strip)) {
      if (lastConnectProblem !== 'unmapped-tabs') {
        lastConnectProblem = 'unmapped-tabs';
        console.warn('[ComfyUI Tab Manager] Native tabs are visible while workflow paths cannot be resolved.');
      }
      if (root) detach();
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
      if (!bar.querySelector('.ctm-new-group')) throw new Error('Group creation button was not rendered');
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
    void initServerSync();
    // Periodically refresh layouts changed in another browser.
    window.setInterval(() => { void pollServerSync(); }, 12000);
    bodyObserver = new MutationObserver(() => {
      if (!root?.isConnected || !bar?.isConnected || !nativeStrip?.isConnected) connect();
    });
    bodyObserver.observe(document.body, { childList: true, subtree: true });
    // The tab strip may mount only after the extension's setup hook.
    timer = window.setInterval(() => { connect(); render(); }, 800);
    // ComfyUI may itself restore tabs asynchronously. Wait for the native tab
    // strip and shared state before presenting any optional restore prompt.
    restorePromptTimer = window.setInterval(maybeOfferWorkflowRestore, 1000);
    document.addEventListener('pointerdown', outsideHandler, true);
    document.addEventListener('keydown', event => { if (event.key === 'Escape') removePopover(); });
    window.__comfyTabManagerDebug = () => ({
      version: VERSION, detectionMode,
      mappedTabCount: workflows().length,
      unsavedPaths: workflows().filter(isUnsavedWorkflow).map(w => w.path),
      storeWorkflowCount: storeWorkflows().length,
      syncStatus, syncReady, dirty, conflict, serverRevision, lastServerCheck,
      nativeTabCount: document.querySelectorAll('[data-testid="workflow-tab"]').length,
      stripCount: document.querySelectorAll('.workflow-tabs').length,
      attached: !!bar?.isConnected,
      button: !!bar?.querySelector('.ctm-new-group'),
      groupCount: state.groups.length,
      rootCount: childrenOf(null).length,
      nestedCount: state.groups.filter(g => g.parentId).length,
      ungroupedVisible: !!bar?.querySelector('.ctm-ungrouped'),
      createButtonColor: state.ui.createButtonColor,
      theme: state.ui.theme, themeScopes: state.ui.themeScopes, appearances: state.ui.appearances,
      visible: !!(bar && getComputedStyle(bar).display !== 'none'),
      blockedNativeCloseActions: [...BLOCKED_NATIVE_ACTIONS],
      nativeCloseGuardEnabled: nativeMenuGuardActive,
      problem: lastConnectProblem
    });
    console.info(`[ComfyUI Tab Manager v${VERSION}] Loaded; locating top workflow tabs.`);
  }
  app.registerExtension({ name: ID, setup });
})();
