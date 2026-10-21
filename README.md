# ComfyUI Tab Manager

**Organize your open ComfyUI workflow tabs directly in the top tab bar.** Create color-coded groups and nested subgroups, collapse groups, and move workflows between groups without changing your workflow files.

**Version:** 1.0.0  
**Type:** Frontend extension for ComfyUI  
**Dependencies:** None beyond ComfyUI

## Features

- **Custom groups:** Create, rename, recolor, and delete groups with your own names.
- **Nested subgroups:** Organize groups inside other groups and expand or collapse each level.
- **Drag-and-drop workflows:** Move open workflow tabs into groups without closing them.
- **Reorder groups:** Drag a group to the left or right edge of another group to change their order.
- **Nest groups:** Drop a group onto the center of another group to turn it into a subgroup.
- **Top-level control:** Move subgroups back to the main tab bar.
- **Adaptive Ungrouped section:** Only shown when at least one open workflow is not assigned to a group.
- **Customizable + Group button:** Right-click **+ Group** to select a color or restore the default appearance.
- **Persistent layout:** Saves groups, names, colors, hierarchy, tab assignments, and collapsed states in browser local storage.
- **ComfyUI workflow actions:** Right-click a workflow tab to access native Rename, Duplicate, Bookmarks, Save, Save As, Export, Export (API), and Clear Workflow. **Close Tab**, **Close Tabs to Left**, **Close Tabs to Right**, and **Close Other Tabs** are hidden and blocked for safety in the grouped bar.
- **Move-to-group popup:** Click the small colored group icon on a workflow tab (or Shift+right-click) to assign it to a group. The **×** in its header only dismisses the popup.
- **Readable long titles:** Long workflow and group names are truncated visually and remain available in tooltips.
- **Native workflow controls:** Uses ComfyUI's original tab actions for switching and closing workflows, including unsaved-change confirmations. Middle-click any workflow tab to close that tab only.

## Compatibility

ComfyUI Tab Manager targets the **top workflow tab bar** of the modern ComfyUI frontend. It has been confirmed working with **ComfyUI Frontend 1.55.14**. Other frontend versions may change the tab bar structure and are not yet guaranteed to be compatible.

The extension does not add image-processing nodes and does not require Python packages beyond ComfyUI. It is independent of your GPU and image-generation model.

## Installation

### ComfyUI Manager / Registry

Once the package is available in the Comfy Registry, search for **ComfyUI Tab Manager** in ComfyUI Manager, install it, and restart ComfyUI.

### Manual installation

1. Stop ComfyUI.
2. Clone or download this repository into `ComfyUI/custom_nodes/ComfyUI-Tab-Manager/`.
3. Start ComfyUI again.
4. Refresh the browser using **Ctrl+F5**.
5. Use **+ Group** in the top workflow tab bar.

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/RedysDump/ComfyUI-Tab-Manager.git
```


Expected folder structure:

```text
ComfyUI/
└── custom_nodes/
    └── ComfyUI-Tab-Manager/
        ├── __init__.py
        ├── pyproject.toml
        ├── README.md
        ├── LICENSE
        └── web/
            ├── tab-manager.js
            └── tab-manager.css
```

## Usage

| Action | How |
| --- | --- |
| Create a group | Left-click **+ Group** |
| Customize the create button | Right-click **+ Group** |
| Reset the create button color | **+ Group** → right-click → **Reset to Default** |
| Rename or recolor a group | Right-click its group header |
| Create a nested group | Right-click a group → **Add Subgroup** |
| Expand or collapse a group | Left-click its header |
| Assign an open workflow | Drag the workflow tab onto a group |
| Reorder a group | Drag its header to the left/right edge of another group |
| Nest a group | Drag its header onto the center of another group |
| Return a subgroup to the top level | Right-click the subgroup → **Top Level** |
| Move a workflow to another group | Click the group icon on its tab → choose a group |
| Remove a workflow from its group | Click the group icon on its tab → **Ungrouped** |
| Open ComfyUI workflow actions | Right-click its tab normally |
| Open Move to Group by keyboard/mouse | Shift + right-click its tab |
| Dismiss the group menu | Click **×** in its top-right corner (does not close the tab) |
| Close one workflow tab | Click the **×** on its tab, or middle-click anywhere on the tab (ComfyUI handles unsaved-change warnings) |
| Delete a group | Right-click the group → **Delete** |

Deleting a group does **not** delete the underlying workflow files. Its nested groups are preserved and moved up one level.

## Data and privacy

Settings are stored locally in your browser using `localStorage` and are scoped to the ComfyUI website origin (host and port). They are not synchronized between browsers or browser profiles. Changing the host or clearing browser data can make the saved groups unavailable.

ComfyUI Tab Manager does not edit, rename, move, or delete workflow JSON files. It does not send group settings to an external service.

### Updating from earlier versions

The extension recognizes the local settings created by previous builds and imports them automatically when no configuration exists under the current storage key. Your existing groups, colors, ordering, nested groups, and workflow assignments should remain available. Remove the old `ComfyUI-ChromeTabGroups` extension folder before installing this renamed package to avoid duplicate frontend extensions.

## Troubleshooting

- **No + Group button:** Make sure ComfyUI is using the top tab bar, not the sidebar workflow view. Restart ComfyUI and use **Ctrl+F5**.
- **Old and new bars are conflicting:** Remove any previously installed version of the extension with a different folder name.
- **Missing groups:** Make sure you are accessing ComfyUI using the same browser profile, host, and port as before.
- **Need diagnostic information:** Open Developer Tools → Console and run `window.__comfyTabManagerDebug()`.
- **Uninstall:** Stop ComfyUI, remove the `ComfyUI-Tab-Manager` directory from `custom_nodes`, restart, and refresh the browser. Native tabs are restored.

## Development

The frontend is registered through `app.registerExtension`. `__init__.py` exposes the `web/` directory through `WEB_DIRECTORY`; no backend endpoints are required. The frontend detects native workflow tabs and delegates activation and closing to the original ComfyUI controls.

## License

MIT License. See [LICENSE](LICENSE).

**Safety:** Mass-close commands in native workflow context menus use the original ComfyUI tab order rather than the custom grouped layout and are therefore not available through Tab Manager. Use the individual tab **×** to close a workflow; the **×** in the grouping popup only dismisses that popup. Do not clear your browser site data if you need to preserve saved group assignments.

### Recovering previously closed workflows

Closing a workflow tab does not delete a previously saved workflow JSON. Reopen saved files from ComfyUI's **Workflows** sidebar, or check `ComfyUI/user/default/workflows` if you are using the standard user directory. Reopening a workflow with the same path restores its previous Tab Manager group assignment. Unsaved, never-saved workflows may not be recoverable, depending on your ComfyUI persistence settings and frontend version.
