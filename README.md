# ComfyUI Tab Manager

<img width="1672" height="941" alt="ComfyUI Tab Manager showcase" src="https://github.com/user-attachments/assets/ed9b1f8e-fecc-4043-9fb4-0a860fff91ef" />

**A Chrome-style workflow tab organizer for ComfyUI.** Organize open workflows in color-coded groups and nested subgroups, move tabs where you want them, and customize the tab bar without leaving ComfyUI.

### Showcase video

https://github.com/user-attachments/assets/cbbdbf18-35fa-4bd3-9bd3-ff8c88685d30

**Version:** 1.2.0  
**Type:** ComfyUI frontend extension with local server-backed settings  
**Dependencies:** ComfyUI; no additional Python packages required

## ❤️ Support the Project

ComfyUI Tab Manager is free and open-source. If you enjoy using it and would like to support future development, you can [buy me a coffee on Ko-fi](https://ko-fi.com/redysdump). Support is optional; the features remain free.

## What's new in v1.2.0

- **Native tabs or Tab Manager:** Switch between the custom bar and original ComfyUI tabs, with a safety fallback if workflow identity cannot be resolved.
- **Faster organization:** Reorder workflows directly within groups and move them across visible groups or nested subgroups; use single-item keyboard Move mode when preferred.
- **Save All Workflows:** Select new or modified open workflows and save them through ComfyUI's native save flow, including empty new drafts.
- **Unsaved indicators:** Choose **Dirty Point**, **Border Glow**, or **Mixed**, with configurable indicator color. A dirty glow visually replaces that item's global button border.
- **Expanded customization:** Independent group and tab colors, button borders, appearance sliders, per-property overrides, and optional group typography/design sharing.
- **Improved settings and storage:** Dedicated Layout Backup, Workflow Tab Recovery, and Server Tools sections; safer offline edits and revision-conflict handling.

See the [full changelog](CHANGELOG.md) and [v1.2.0 release notes](RELEASE_NOTES_v1.2.0.md).

## Features

### Workflows, tabs and groups

- Create, rename, recolor, reorder, collapse, and nest groups and subgroups.
- Drag workflow tabs within a group or between groups and visible subgroups, with clear insertion feedback.
- Toggle between **Tab Manager** and **Original ComfyUI Tabs**; ambiguous workflow mapping keeps the native view available.
- Left, center, or right bar alignment, overflow navigation, and automatic reveal of the active workflow.
- Adaptive **Ungrouped** section when workflows are not assigned to a group; active-workflow highlighting through nested parents.
- Native tab activation and context-menu actions, individual **×** closing, and middle-click closing. ComfyUI remains responsible for save warnings.
- Single-item keyboard Move mode: Ctrl-click a group or workflow tab, use Left/Right arrows, and Escape to leave.
- Visually truncate long names without discarding the complete title.

### Themes and appearance

- Seven built-in themes: **Classic, Minimal, Soft, Neon, Tropical, Ocean, Library**.
- **Customize Themes:** Colors, typography, surfaces, hover effects, button borders, corner radius, opacity, and other appearance controls. Changes preview **immediately on the real tab bar**, without first clicking Apply Theme.
- Apply global themes to tabs, groups, or both, either keeping or overwriting individual overrides in the chosen scope.
- **Customize Group** and **Customize Tab:** Individual appearance overrides, inheritance, and their own previews. Groups can independently opt to share typography and compatible design settings with descendants.
- **Button borders:** None, Subtle, Bold. **Unsaved indicators:** Dirty Point, Border Glow, Mixed. A dirty glow replaces the generated button border only for the affected element.
- Import and export JSON theme presets. The separate sample strip in Customize Themes was intentionally removed; its live bar feedback remains.

### Storage and workflow recovery

- Server-backed group and appearance layout saved under the selected ComfyUI user profile, with browser fallback and offline edit recovery.
- Revision checking and explicit handling of conflicting changes from connected browsers; validated atomic server writes and backup of prior settings.
- **Layout Backup:** Export/import organization and appearance as JSON, separate from the workflow file contents.
- **Workflow Tab Recovery:** Save a list of currently open saved-workflow paths and restore available tabs later.
- **Save All Workflows:** Choose which modified or new open workflows to save through the native ComfyUI workflow store. Unchanged saved workflows are omitted.

## Installation

### ComfyUI Manager

1. Open **ComfyUI Manager** and search for **ComfyUI Tab Manager**.
2. Install the extension.
3. Restart ComfyUI and hard-refresh the browser (`Ctrl + F5`).

### Manual installation

Clone this repository into your ComfyUI `custom_nodes` directory:

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/RedysDump/ComfyUI-Tab-Manager.git
```

Alternatively, extract the downloadable release ZIP to create `ComfyUI/custom_nodes/ComfyUI-Tab-Manager/` with `__init__.py`, `server_storage.py`, and `web/` inside. Restart ComfyUI and hard-refresh the browser.

If an older copy exists under another folder name (for example `ComfyUI-ChromeTabGroups`), disable or remove the duplicate *after making a backup* so the extension is not loaded twice.

## How to use

| Action | How |
| --- | --- |
| Create a group | Click **+ Group** |
| Change the + Group button color | Right-click **+ Group** |
| Add a subgroup | Open the group menu → **Add Subgroup** |
| Customize a group | Open its menu → **Customize Group** |
| Collapse or expand a group | Click its chevron |
| Reorder groups or workflows | Drag to the intended position; drop into supported group targets |
| Move one item with the keyboard | Ctrl-click the tab/group, use Left/Right, Escape to exit |
| Customize a workflow tab | Workflow tab menu → **Customize Tab** |
| Customize global appearance | Open settings → **Customize Themes**; watch changes on the actual bar |
| Back up or import a layout | **Tab Manager Settings** → **Layout Backup** |
| Restore previously saved tabs | **Tab Manager Settings** → **Workflow Tab Recovery** |
| Save multiple new or changed workflows | **Workflow Tab Recovery** → **Save All Workflows** |
| Check server storage | **Tab Manager Settings** → **Server Tools** |

Deleting a group does not delete ComfyUI workflow files. Do not confuse a group action with ComfyUI's own workflow-file operations.

## Layout and workflow safety

Layout data is stored in the ComfyUI user directory, typically:

```text
ComfyUI/user/default/ComfyUI-Tab-Manager/settings.json
```

The exact location varies with your ComfyUI user profile. Group organization, appearance settings, and saved workflow path references can be exported, but **layout JSON does not include the contents of workflow JSON files**. Back up workflow files separately.

**Save Current Open Tabs for Restore** and **Restore Saved Workflow Tabs** work with paths of already saved workflows. They cannot recreate deleted workflow files or invent a path for an unsaved draft. **Save All Workflows** explicitly invokes ComfyUI's native workflow-saving behavior and follows native prompts. ComfyUI remains responsible for workflow content and canvas state.

Offline layout edits are retained locally until reconnection. When server revisions conflict, use the presented conflict-resolution actions rather than assuming the newest change silently wins.

## Compatibility and troubleshooting

ComfyUI frontend internals change between releases. Local automated frontend-bundle checks have covered 1.55.14, 1.55.18, and 1.59.0; these checks are not a blanket guarantee for all installed ComfyUI combinations. Keep your ComfyUI installation and the extension updated.

- **No + Group button?** Ensure ComfyUI's top workflow tab bar is enabled, restart ComfyUI, and hard-refresh the browser (`Ctrl + F5`).
- **Duplicate controls?** Check for multiple copies of Tab Manager in `custom_nodes`.
- **Layout looks different?** Confirm the selected ComfyUI server and user profile, then inspect **Layout Backup** and **Server Tools**.
- **Unsaved canvas changes?** Use ComfyUI's native save operations; tab organization is not a replacement for saving workflow files.
- **Uninstalling:** Stop ComfyUI, remove the extension directory, restart, and refresh. Your workflow JSON files remain managed by ComfyUI.

## Acknowledgements

Thanks to [@hulkx07](https://github.com/hulkx07) for raising the frontend compatibility issue and proposing a fix in [PR #3](https://github.com/RedysDump/ComfyUI-Tab-Manager/pull/3), and for suggesting the unsaved-workflow indicator in [PR #4](https://github.com/RedysDump/ComfyUI-Tab-Manager/pull/4). The configurable indicator system was developed separately; this credit does not imply PR #4 code was merged.

Thanks to [@thevegit01-sys](https://github.com/thevegit01-sys) for requesting workflow reordering within groups in [Issue #6](https://github.com/RedysDump/ComfyUI-Tab-Manager/issues/6).

## License

Released under the [MIT License](LICENSE).
