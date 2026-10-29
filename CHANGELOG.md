# Changelog

Notable changes to **ComfyUI Tab Manager** are listed below.

## [1.2.0] - 2026-10-29

### Added

- A **Tab Manager / Original ComfyUI Tabs** switch with safe native-tab fallback when workflow discovery is empty, ambiguous, or not safely mappable.
- Session-aware handling for unnamed, empty, and duplicate-name workflows, plus **Save All Workflows** using ComfyUI's native save flow.
- Direct drag-and-drop workflow reordering within and between visible groups and subgroups, with centered insertion feedback.
- A single-item keyboard Move mode for groups and workflow tabs.
- **Dirty Point**, **Border Glow**, and **Mixed** unsaved-indicator modes, with separate indicator and group-count colors.
- Separate tab and group accent, surface, hover, chevron, count, and control colors.
- Independent, opt-in group typography sharing and compatible design sharing for descendants.

### Improved

- **Tab Manager Settings** groups existing actions into Layout Backup, Workflow Tab Recovery, and Server Tools accordions.
- **Customize Themes** edits are reflected on the actual tab bar. Its former sample strip was removed; preset controls remain, and the individual Customize Group and Customize Tab live previews remain.
- Theme presets, reset behavior, JSON import/export, tab alignment, and group/tab overrides now preserve their intended scopes.
- Appearance editors use property-level overrides, inherited values, far-right checkboxes, bounded numeric sliders, and dedicated reset-to-inherited behavior.
- Long workflow and group names, right-aligned ordering, chevrons, glow bounds, and compact viewport layouts received targeted fixes.

### Fixed

- Distinguish duplicate or unnamed workflow resources using native identity when available instead of pairing by tab position.
- Keep the unsaved indicator visible beside truncated long workflow names.
- Preserve temporary workflow identity and organization during safe native view switching and session recovery.
- Retain offline layout edits across browser restart and report server revision conflicts instead of silently overwriting newer changes.
- Preserve group assignments, custom appearance, and deduplicated restore paths across workflow rename.
- Apply preset and Reset colors consistently to group names, accents, counts, chevrons, and surfaces.
- Ensure a dirty Border Glow replaces the global button border only on that glowing item, in the live bar, without overlapping the dirty indicator.

### Storage and compatibility

- Add optional validated theme fields while retaining legacy layout normalization and older-client field preservation.
- Keep workflow file contents outside layout storage and layout exports. Workflow saving and file restoration continue to use ComfyUI's native workflow store.
- No automatic migration removes existing layout or appearance values.

## [1.1.1] - 2026-10-23

### Fixed

- **Newer frontend compatibility:** Workflow tabs are detected and displayed with the updated Reka UI tab components, which no longer expose the legacy data-workflow-path attribute. Workflow paths are resolved using the ComfyUI workflow store, while retaining support for older frontends.
- **Reliable workflow switching:** Corrected native tab activation for both the legacy (1.55.x) and newer (1.59.x) frontend implementations.
- **Accidental tab closing:** Fixed a regression where selecting a workflow on older frontends could target a close button instead of activating the tab.
- **Safe native-tab fallback:** If workflow tabs cannot be mapped reliably, the extension leaves ComfyUI's native tab bar visible rather than showing an empty replacement.

Thanks to [@hulkx07](https://github.com/hulkx07) for identifying the compatibility issues and proposing improvements in [pull request #3](https://github.com/RedysDump/ComfyUI-Tab-Manager/pull/3).

## [1.1.0] - 2026-10-23

### Added

- **Customize Theme:** Live appearance preview and seven built-in presets (Classic, Minimal, Soft, Neon, Tropical, Ocean and Library).
- **Per-group and per-tab customization:** Choose individual colors, typography, borders and other appearance settings, with per-property theme inheritance.
- **Flexible theme application:** Style tabs, groups or both while preserving or overwriting individual customizations.
- **Custom theme presets:** Save and import themes as JSON.
- **Server-backed layout storage:** Save group structure, workflow assignments and visual settings in the ComfyUI user directory, with browser fallback and cross-browser access for the same user profile.
- **Layout JSON import/export:** Back up and restore your tab organization.
- **Optional workflow tab restoration:** Save a set of open workflow references and restore available saved workflows in the background.
- **Tab-bar navigation:** Left/center/right alignment, overflow controls, mouse-wheel scrolling and automatic reveal of the selected workflow.
- **Active nested-group highlights:** Highlight the selected workflow's group and all of its parent groups.

### Improved

- More compact global, group and tab customization panels with expanded appearance controls.
- Refined color palettes, group chevrons and nested-group layout.
- Workflow organization via a **⋯** menu on hover, or **Shift + right-click**.

### Fixed

- Better preservation of workflow-to-group assignments and appearance settings when workflows are renamed.
- More reliable layout recovery after a restart or temporary server connection loss.
- Improved conflict handling when editing a shared layout from multiple browsers.
- Safer workflow tab restoration and more reliable native activation and individual close actions.

## [1.0.1] - 2026-10-21

### Updated

- Added a custom icon for the Comfy Registry listing and linked it in the package metadata.

## [1.0.0] - 2026-10-21

### Initial release

- Color-coded collapsible groups and unlimited nested subgroups.
- Drag-and-drop tab organization, group reordering and nesting.
- Adaptive Ungrouped section and customizable **+ Group** button color.
- Browser-local layout persistence and migration from earlier builds.
- Native tab activation, middle-click closing and individual **×** controls.
- Standard ComfyUI workflow context-menu actions, with unsafe grouped mass-close actions hidden.
- Move-to-group menu and full-name tooltips for long tab titles.
