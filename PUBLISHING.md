# Publishing ComfyUI Tab Manager

This checklist is for the maintainer. The extension is version **1.0.0**.

## Before publishing

1. Decide whether the MIT License in `LICENSE` matches the permissions you want to grant. If not, choose and apply an appropriate license consistently in `LICENSE`, `README.md`, and `pyproject.toml`.
2. Optionally replace the generic copyright holder in `LICENSE` with your own name or handle.
3. GitHub repository: https://github.com/RedysDump/ComfyUI-Tab-Manager (created).
4. GitHub links in `README.md` and `pyproject.toml` point to `RedysDump`.
5. Create a publisher at https://registry.comfy.org/ and replace `YOUR_REGISTRY_PUBLISHER_ID` in `pyproject.toml` with your **real** Publisher ID (shown after `@` in your Registry profile).
6. Check whether the unique Registry project name `comfyui-tab-manager` is available. Change it before the first publication if needed; the Registry project ID cannot be renamed afterward.
7. Verify installation, group creation, nested groups, drag-and-drop, persistence, and native tab closing on the ComfyUI frontend version you want to support.
8. Review the repository and staged changes for sensitive data or unnecessary local files. Never commit API keys or tokens.

## GitHub

Upload the **contents** of `ComfyUI-Tab-Manager/` to the root of the GitHub repository (not the outer ZIP folder). On the GitHub repository page, create a release tagged **v1.0.0**.

## Comfy Registry / ComfyUI Manager

See the official docs: https://docs.comfy.org/registry/publishing

1. Create a publishing API key for your Registry publisher.
2. In GitHub, open **Settings → Secrets and variables → Actions** and create the repository secret `REGISTRY_ACCESS_TOKEN` containing that key.
3. Open **Actions → Publish to Comfy Registry → Run workflow**. This project uses a manual trigger so a push does not automatically publish an unreviewed version.
4. Confirm the version appears in the Registry and is searchable/installable in ComfyUI Manager. Publishing can involve validation or indexing delays.

Alternatively, publish with `comfy node publish` from the repository root and provide the Registry key interactively.

## After publishing

- Test installation from ComfyUI Manager on a clean setup.
- When updating, increment `project.version` in `pyproject.toml` and `VERSION` in `web/tab-manager.js` together.
- Add release notes to `CHANGELOG.md` for each update.
- Keep the Registry Publisher ID and node package name stable after the initial publication.
