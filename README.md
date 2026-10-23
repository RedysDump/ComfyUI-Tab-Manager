# ComfyUI Tab Manager

<img width="1672" height="941" alt="ComfyUI Tab Manager showcase" src="https://github.com/user-attachments/assets/ed9b1f8e-fecc-4043-9fb4-0a860fff91ef" />

**A Chrome-style workflow tab organizer for ComfyUI.** Create color-coded groups, organize workflows into nested subgroups, and customize the appearance of your tabs—all directly in ComfyUI's top workflow bar.

### Showcase video

https://github.com/user-attachments/assets/cbbdbf18-35fa-4bd3-9bd3-ff8c88685d30

**Version:** 1.1.0  
**Type:** ComfyUI frontend extension with local server-backed settings  
**Dependencies:** ComfyUI; no additional Python packages required

## What's new in v1.1.0

- **Customize Theme:** Customize colors, typography, borders, spacing and more with a live preview and seven built-in themes: Classic, Minimal, Soft, Neon, Tropical, Ocean and Library.
- **Personalize groups and tabs:** Apply individual styles to a group or workflow tab, with per-setting inheritance from your global theme.
- **Flexible theme application:** Apply a theme to tabs, groups or both, while choosing whether to preserve or replace individual customizations.
- **Theme presets:** Save your own themes as JSON presets and import them whenever you like.
- **Layout import and export:** Save your entire tab organization as a JSON file and restore it later.
- **Shared layout storage:** Save groups and appearance settings in your ComfyUI user directory. The same layout can be used across browsers connected to the same ComfyUI server and user profile.
- **Restore saved tabs:** Optionally reopen previously saved workflow tabs when supported by your ComfyUI frontend.
- **Improved navigation:** Left, center or right tab alignment, scrolling, overflow navigation and automatic reveal of the active workflow.
- **Nested group highlighting:** The active workflow highlights its containing group and all parent groups, even across multiple nesting levels.
- **Refined interface:** More compact menus, improved group controls and a cleaner, consistent tab bar.

For a complete list of changes, see the [changelog](CHANGELOG.md).

## Features

- **Groups and subgroups:** Create, rename, recolor, reorder, nest, collapse and expand groups.
- **Drag and drop:** Organize open workflow tabs and move groups into or out of nested hierarchies.
- **Adaptive Ungrouped section:** Appears only when one or more open workflows aren't assigned to a group.
- **Custom + Group button:** Right-click **+ Group** to change its color.
- **Workflow controls:** Use the tab's **⋯** menu or **Shift + right-click** to move a workflow between groups. Standard ComfyUI workflow context-menu actions remain available.
- **Native tab behavior:** Click to switch workflows and use **×** or middle-click to close an individual tab.
- **Clear titles:** Long tab and group names are shortened visually, with full names available on hover.
- **Persistent organization:** Keep your groups, layout and customizations after restarting ComfyUI.

## Installation

### ComfyUI Manager

1. Open **ComfyUI Manager** and search for **ComfyUI Tab Manager**.
2. Install the extension.
3. Restart ComfyUI and refresh your browser (`Ctrl + F5`).

### Manual installation

Clone the repository into your ComfyUI `custom_nodes` directory:

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/RedysDump/ComfyUI-Tab-Manager.git
```

Restart ComfyUI, then refresh the browser (`Ctrl + F5`). The **+ Group** button and a settings gear will appear in the top workflow tab bar.

If you've installed an older version under a different folder name (such as `ComfyUI-ChromeTabGroups`), remove that older copy before starting ComfyUI to avoid loading the extension twice.

## How to use

| Action | How |
| --- | --- |
| Create a group | Click **+ Group** |
| Change the + Group button color | Right-click **+ Group** |
| Add a subgroup | Right-click a group → **Add Subgroup** |
| Edit a group | Right-click its header → **Customize Group** |
| Expand or collapse a group | Click the group header |
| Reorder or nest groups | Drag a group before, after or onto another group |
| Move a subgroup to the main bar | Group menu → **Top Level** |
| Move a workflow to another group | Hover over its tab → **⋯** → choose a group |
| Edit a workflow tab's appearance | Workflow tab menu → **Customize Tab** |
| Open the global Theme Studio | Settings gear → **Customize Theme** |
| Apply a theme | Choose whether to style tabs, groups or both |
| Save or load a custom theme | Theme Studio → **Save as JSON Preset** / **Import JSON** |
| Export/import your layout | Settings gear → **Layout Storage & Backup** |
| Restore saved workflow tabs | Settings gear → **Restore Saved Workflow Tabs** |

Deleting a group does **not** delete its workflow files. Nested subgroups are preserved and moved up one level.

## Layout storage and backups

Your layout is saved in the selected ComfyUI user directory, typically:

```text
ComfyUI/user/default/ComfyUI-Tab-Manager/settings.json
```

A previous settings backup is also retained on the server. Browser storage acts as a fallback if the server is temporarily unavailable.

Browsers connected to the **same ComfyUI server and user profile** can share the saved layout. If changes from different browsers conflict, the **Layout Storage & Backup** menu provides options to reload the server layout or apply the current layout to the server.

**Export Layout (.json)** saves your group structure, appearance settings and references to saved workflows. It does **not** include the actual workflow JSON files. Back up those workflow files separately.

Your tab layout is stored locally in your ComfyUI environment, not uploaded to a third-party service by this extension.

## Restoring workflow tabs

Use **Save Current Open Tabs for Restore** and **Restore Saved Workflow Tabs** from the settings gear to reopen previously saved workflow tabs. The extension uses ComfyUI's supported background-opening functionality where available. Workflows that can no longer be found are skipped.

This feature restores tab references, not deleted or unsaved workflow files.

## Compatibility and troubleshooting

ComfyUI Tab Manager is designed for the modern ComfyUI **top workflow tab bar**. The original release was confirmed with **ComfyUI Frontend 1.55.14**. Other frontend versions and extensions may affect compatibility.

- **Can't see + Group?** Enable the top workflow tab bar, restart ComfyUI and hard-refresh the browser (`Ctrl + F5`).
- **Duplicate tabs or buttons?** Check for duplicate installations inside `custom_nodes`.
- **Groups look outdated?** Confirm that you're connected to the expected ComfyUI server and user profile; check **Layout Storage & Backup**.
- **Storage conflict?** Choose to reload the saved server layout or apply your current layout through the storage menu.
- **Uninstalling:** Stop ComfyUI, remove `ComfyUI-Tab-Manager` from `custom_nodes`, then restart and refresh. Your original workflow files are unaffected.

The extension does not edit, rename, move or delete your workflow JSON files. Native ComfyUI tab operations remain in control of opening and closing workflows; mass-close actions are hidden in the grouped view for safety.

## License

Released under the [MIT License](LICENSE).
