# ComfyUI Tab Manager v1.2.0

This update brings expanded workflow organization, recovery tools, and appearance controls to ComfyUI Tab Manager while keeping ComfyUI responsible for workflow files and canvas state.

## Highlights

- Switch between the Tab Manager and native ComfyUI tabs with a safe fallback when workflow identity is ambiguous.
- Organize workflows with nested groups, direct drag-and-drop reordering between visible groups, centered insertion feedback, and keyboard Move mode.
- Save selected open workflows, including new empty drafts, through ComfyUI's native save flow. Restore saved tabs using stored path references.
- Choose Dirty Point, Border Glow, or Mixed unsaved indicators. A dirty glow replaces the generated global border only on the affected workflow or collapsed group.
- Customize tab and group colors independently, including accent, background, hover, group count, chevron, and indicator colors.
- Apply property-level group and tab appearances with optional, independent typography and design sharing for group descendants.
- Edit themes with live feedback on the actual tab bar. The separate sample strip was removed from Customize Themes; individual group and tab previews remain.
- Preserve offline edits and expose concurrent server changes for explicit conflict resolution.

## Workflow and layout safety

Layout storage and JSON exports contain organization, appearance settings, and saved workflow path references—not workflow JSON contents. Restore cannot recreate a deleted file or invent a saved path for an unsaved draft. Saving files remains a ComfyUI native operation.

The new Save All Workflows action lists open resources identified as modified or new and delegates saving to ComfyUI. Review the native save prompts and choose the workflows to save.

## Compatibility

The v1.1.1 release reported compatibility with legacy Frontend 1.55.x and newer Frontend 1.59.x implementations. The pre-release test suite passed 71 Python tests and 79 JavaScript/browser tests, with additional synthetic responsive visual coverage. Local frontend-bundle checks also covered 1.55.14, 1.55.18, and 1.59.0 through a Core 0.43.0 / Frontend 1.57.4 test host. These routed-bundle checks are not equivalent to three separate ComfyUI installations and do not establish a broad compatibility guarantee.

## Upgrade and installation

Install the extension once under the ComfyUI custom_nodes directory, restart ComfyUI, and hard-refresh the browser. Remove duplicate installations before starting. Back up your ComfyUI user directory before an update.

This update keeps the published package version history and adds optional theme fields through validation that retains legacy layout normalization. It does not automatically remove existing appearance values. Back up your ComfyUI user data before an important update.

## Known limitations

- Temporary workflow persistence across a full browser restart depends on ComfyUI preserving the workflow resource identity and browser session state.
- Server conflict handling preserves edits and reports the conflict; users must resolve competing changes explicitly.
- Host-specific browser DOM, native menus, native save dialogs, and all separately installed frontend versions still require manual coverage.

## Credits

Thanks to hulkx07 for proposing the unsaved-workflow indicator idea in [PR #4](https://github.com/RedysDump/ComfyUI-Tab-Manager/pull/4). The current dirty-indicator system has been extended separately; this acknowledgement does not claim that code from PR #4 was merged or directly reused.

Thanks to [@thevegit01-sys](https://github.com/thevegit01-sys) for requesting workflow reordering within groups in [Issue #6](https://github.com/RedysDump/ComfyUI-Tab-Manager/issues/6). Direct in-bar workflow reordering is included in v1.2.0.
