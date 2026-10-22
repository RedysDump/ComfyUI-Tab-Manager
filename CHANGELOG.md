# Changelog

All notable changes to ComfyUI Tab Manager are documented here.

## [1.1.1] - 2026-10-22

### Fixed

- Fixed clicking a workflow tab not switching to that workflow on current
  ComfyUI frontends: the Reka UI "Tabs" rewrite activates tabs on `mousedown`,
  but the extension only forwarded a `click` event, so the native tab never
  changed. A full pointer event sequence (pointerdown/mousedown/pointerup/
  mouseup/click) is now forwarded, which works on both legacy and current
  layouts. A direct fallback through the official workflow store
  (`app.extensionManager.workflow.openWorkflow`) covers the rare case where
  the native tab strip is momentarily unavailable, and stale tab-node mappings
  are re-derived from the live DOM before giving up.

## [1.1.0] - 2026-10-22

### Fixed

- Fixed a blank top tab bar on current ComfyUI frontends: the frontend rewrite
  of the workflow tab bar (Reka UI "Tabs") removed the `data-workflow-path`
  attribute from the DOM, so the extension found no tabs and hid the native
  bar behind an empty custom bar. Tab paths are now resolved from the official
  extension API (`app.extensionManager.workflow`), with filename matching as a
  fallback, and the legacy `data-workflow-path` layout is still supported.
- Fail-open visibility: if workflow tab paths can never be resolved, ComfyUI's
  original tab bar stays visible instead of being hidden behind an empty bar.

## [1.0.1] - 2026-10-21

### Visual Update

- Added a custom icon for the Comfy Registry listing.
- Updated package metadata to reference the new icon.
- No changes to existing functionality.

## [1.0.0] - 2026-10-21

### Initial public release

- Organize open ComfyUI workflow tabs into custom, color-coded groups.
- Create unlimited nested subgroups and collapse or expand them independently.
- Drag and drop workflow tabs between groups and reorder group headers.
- Automatically hide the Ungrouped section when all open workflows are assigned.
- Customize the + Group button color from its context menu.
- Preserve the layout and workflow assignments in browser local storage.
- Import settings from earlier local builds.
- Keep native workflow switching and closing behavior.
- Restore middle-click to close an individual workflow tab through the native close control.
- Restore the original ComfyUI right-click workflow menu with all its built-in actions.
- Add a dedicated Move to Group icon on workflow tabs, plus Shift+right-click access.
- Add a safe menu-dismiss X button and style Close Tab as a red action.
- Truncate long group/workflow names visually, while keeping full titles in tooltips.

