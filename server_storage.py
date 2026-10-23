"""ComfyUI Tab Manager shared layout persistence.

Only group metadata is stored. No ComfyUI workflow contents are read or written.
The revision token prevents overwriting edits from another browser without consent.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import tempfile
import threading
from pathlib import Path
from typing import Any

_LOCK = threading.RLock()
_USER_ID = re.compile(r"^[a-zA-Z0-9_-]{1,64}$")
_MAX_BYTES = 1_048_576


class InvalidLayout(ValueError):
    pass


class StaleRevision(Exception):
    def __init__(self, current: dict):
        self.current = current


def storage_path(user_directory: str, user_id: str = "default") -> Path:
    """Use ComfyUI's configured user directory, never an arbitrary client path."""
    if not _USER_ID.fullmatch(user_id) or user_id.startswith("__"):
        raise InvalidLayout("Invalid ComfyUI user ID")
    return Path(user_directory) / user_id / "ComfyUI-Tab-Manager" / "settings.json"


# Whitelisted appearance properties. No raw CSS is accepted from browsers or JSON imports.
_THEME_COLORS = ("accent", "tabBg", "hoverBg", "panelBg", "text", "strokeColor", "textShadowColor")
_THEME_NUMBERS = {"radius": (0, 20), "gap": (0, 14), "height": (24, 42),
                  "groupTint": (0, 45), "hoverTint": (0, 65), "shadow": (0, 18),
                  "fontSize": (10, 22), "stroke": (0, 3), "textShadow": (0, 12),
                  "shadowOpacity": (0, 100), "textShadowOpacity": (0, 100),
                  "groupContentGap": (0, 24), "barHeight": (34, 88),
                  "widthPadding": (4, 28), "tabBgOpacity": (0, 100)}


def validate_theme(theme: Any) -> dict | None:
    if theme is None:
        return None
    if not isinstance(theme, dict):
        raise InvalidLayout("Invalid theme settings")
    old_required = {"accent", "tabBg", "hoverBg", "panelBg", "text", "outline",
                    "radius", "gap", "height", "groupTint", "hoverTint", "shadow", "fontSize"}
    expected = {*_THEME_COLORS, *_THEME_NUMBERS, "outline", "fontFamily", "fontWeight", "italic", "shadowEnabled", "textShadowEnabled", "tabAlignment"}
    if not old_required.issubset(theme) or set(theme) - expected:
        raise InvalidLayout("Unknown or missing theme setting")
    # Validate before deriving legacy toggle defaults: malformed JSON values must
    # raise InvalidLayout rather than escaping as a TypeError during comparison.
    for key in ("shadow", "textShadow"):
        value = theme.get(key, 0)
        lo, hi = _THEME_NUMBERS[key]
        if type(value) is not int or not lo <= value <= hi:
            raise InvalidLayout("Invalid theme dimension")
    theme = {"fontFamily": "inherit", "fontWeight": 600, "italic": False,
             "stroke": 0, "strokeColor": "#000000", "textShadow": 0, "textShadowColor": "#000000",
             "shadowOpacity": 40, "textShadowOpacity": 100,
             "groupContentGap": 6, "barHeight": 34, "widthPadding": 10, "tabBgOpacity": 100,
             "tabAlignment": "left", "shadowEnabled": theme.get("shadow", 0) > 0,
             "textShadowEnabled": theme.get("textShadow", 0) > 0, **theme}
    for key in _THEME_COLORS:
        if not isinstance(theme[key], str) or not re.fullmatch(r"#[0-9a-fA-F]{6}", theme[key]):
            raise InvalidLayout("Invalid theme color")
    for key, (lo, hi) in _THEME_NUMBERS.items():
        value = theme[key]
        if type(value) is not int or not lo <= value <= hi:
            raise InvalidLayout("Invalid theme dimension")
    # Legacy custom heights pass validation but never change the fixed 34px tab bar.
    theme["barHeight"] = 34
    if theme["tabAlignment"] not in ("left", "center", "right"):
        raise InvalidLayout("Invalid tab alignment")
    if theme["outline"] not in ("none", "subtle", "bold"):
        raise InvalidLayout("Invalid theme outline")
    if theme["fontFamily"] not in ("inherit", "Arial", "Verdana", "Tahoma", "Georgia", "monospace"):
        raise InvalidLayout("Invalid theme font family")
    if type(theme["fontWeight"]) is not int or theme["fontWeight"] not in (400, 500, 600, 700, 800):
        raise InvalidLayout("Invalid theme font weight")
    if type(theme["italic"]) is not bool:
        raise InvalidLayout("Invalid theme italic flag")
    for flag in ("shadowEnabled", "textShadowEnabled"):
        if type(theme[flag]) is not bool:
            raise InvalidLayout("Invalid shadow toggle")
    return theme


# Individual appearance overrides are whitelisted: never store arbitrary CSS or HTML.
_DESIGN_NUMBERS = {"borderWidth": (0, 3), "radius": (0, 20), "backgroundOpacity": (0, 100), "shadow": (0, 18), "shadowOpacity": (0, 100)}
_APPEARANCE_COLORS = ("accent", "borderColor", "background", "text", "strokeColor", "textShadowColor")
_APPEARANCE_FONTS = ("inherit", "Arial", "Verdana", "Tahoma", "Georgia", "monospace")
_APPEARANCE_KEYS = {*_APPEARANCE_COLORS, *_DESIGN_NUMBERS, "fontFamily", "fontSize", "fontWeight", "italic", "stroke", "textShadow", "preserveClassicSurface"}


def validate_appearance_map(value: Any, *, group_ids: set[str] | None = None) -> dict:
    if value is None:
        return {}
    if not isinstance(value, dict) or len(value) > 40000:
        raise InvalidLayout("Invalid appearance collection")
    result = {}
    for identity, appearance in value.items():
        if not isinstance(identity, str) or not 1 <= len(identity) <= 2048:
            raise InvalidLayout("Invalid appearance identity")
        if group_ids is not None and identity not in group_ids:
            raise InvalidLayout("Appearance references missing group")
        if not isinstance(appearance, dict) or set(appearance) - _APPEARANCE_KEYS:
            raise InvalidLayout("Invalid individual appearance")
        for key, v in appearance.items():
            if key in _DESIGN_NUMBERS and (type(v) is not int or not _DESIGN_NUMBERS[key][0] <= v <= _DESIGN_NUMBERS[key][1]):
                raise InvalidLayout("Invalid element design value")
            if key == "preserveClassicSurface" and (not isinstance(v, str) or not re.fullmatch(r"#[0-9a-fA-F]{6}", v) or group_ids is not None):
                raise InvalidLayout("Invalid Classic tab surface flag")
            if key in _APPEARANCE_COLORS and (not isinstance(v, str) or not re.fullmatch(r"#[0-9a-fA-F]{6}", v)):
                raise InvalidLayout("Invalid appearance color")
            if key == "fontSize" and (type(v) is not int or not 10 <= v <= 22):
                raise InvalidLayout("Invalid appearance font size")
            if key == "fontWeight" and (type(v) is not int or v not in (400, 500, 600, 700, 800)):
                raise InvalidLayout("Invalid font weight")
            if key == "fontFamily" and v not in _APPEARANCE_FONTS:
                raise InvalidLayout("Invalid font family")
            if key == "italic" and type(v) is not bool:
                raise InvalidLayout("Invalid italic flag")
            if key == "stroke" and (type(v) is not int or not 0 <= v <= 3):
                raise InvalidLayout("Invalid legacy outline width")
            if key == "textShadow" and (type(v) is not int or not 0 <= v <= 12):
                raise InvalidLayout("Invalid text shadow")
        if appearance:
            result[identity] = appearance
    return result

def validate_layout(state: Any) -> dict:
    if not isinstance(state, dict):
        raise InvalidLayout("Layout must be an object")
    groups = state.get("groups")
    assignments = state.get("assignments")
    ui = state.get("ui")
    if not isinstance(groups, list) or len(groups) > 2000:
        raise InvalidLayout("Invalid group collection")
    if not isinstance(assignments, dict) or len(assignments) > 40000:
        raise InvalidLayout("Invalid assignment collection")
    if not isinstance(ui, dict):
        raise InvalidLayout("Invalid UI settings")
    ids = set()
    for group in groups:
        if not isinstance(group, dict):
            raise InvalidLayout("Invalid group")
        gid, name, color, parent_id = (group.get("id"), group.get("name"), group.get("color"), group.get("parentId"))
        if not isinstance(gid, str) or not 1 <= len(gid) <= 160 or gid in ids:
            raise InvalidLayout("Invalid or duplicate group ID")
        if not isinstance(name, str) or not 1 <= len(name) <= 80:
            raise InvalidLayout("Invalid group name")
        if not isinstance(color, str) or not re.fullmatch(r"#[0-9a-fA-F]{6}", color):
            raise InvalidLayout("Invalid group color")
        if parent_id is not None and (not isinstance(parent_id, str) or len(parent_id) > 160):
            raise InvalidLayout("Invalid subgroup parent")
        if not isinstance(group.get("collapsed"), bool):
            raise InvalidLayout("Invalid collapsed flag")
        ids.add(gid)
    for group in groups:
        if group.get("parentId") is not None and group["parentId"] not in ids:
            raise InvalidLayout("Subgroup has a missing parent")
    graph = {g["id"]: g.get("parentId") for g in groups}
    for gid in graph:
        seen = set()
        current = gid
        while current is not None:
            if current in seen:
                raise InvalidLayout("Cyclic group nesting")
            seen.add(current)
            current = graph[current]
    for path, gid in assignments.items():
        if not isinstance(path, str) or len(path) > 2048 or not isinstance(gid, str) or gid not in ids:
            raise InvalidLayout("Invalid workflow assignment")
    color = ui.get("createButtonColor")
    if color is not None and (not isinstance(color, str) or not re.fullmatch(r"#[0-9a-fA-F]{6}", color)):
        raise InvalidLayout("Invalid create button color")
    theme = validate_theme(ui.get("theme"))
    scopes = ui.get("themeScopes")
    if scopes is None:
        # Migrate the old, shared theme to both scopes; leave the original untouched.
        scopes = {"tabs": theme, "groups": theme}
    if not isinstance(scopes, dict) or set(scopes) != {"tabs", "groups"}:
        raise InvalidLayout("Invalid theme scopes")
    scopes = {"tabs": validate_theme(scopes["tabs"]), "groups": validate_theme(scopes["groups"])}
    appearances = ui.get("appearances", {})
    if not isinstance(appearances, dict) or set(appearances) - {"tabs", "groups"}:
        raise InvalidLayout("Invalid appearance scopes")
    appearances = {
        "tabs": validate_appearance_map(appearances.get("tabs")),
        "groups": validate_appearance_map(appearances.get("groups"), group_ids=ids),
    }
    design_inherited = ui.get("inheritGroupDesign", {})
    if not isinstance(design_inherited, dict) or len(design_inherited) > 2000:
        raise InvalidLayout("Invalid design inheritance settings")
    for gid, enabled in design_inherited.items():
        if gid not in ids or type(enabled) is not bool:
            raise InvalidLayout("Invalid design inheritance setting")
    design_inherited = {gid: True for gid, enabled in design_inherited.items() if enabled}
    saved_presets = ui.get("customPresets", {})
    inherited = ui.get("inheritGroupAppearance", {})
    if not isinstance(inherited, dict) or len(inherited) > 2000:
        raise InvalidLayout("Invalid group inheritance settings")
    for gid, enabled in inherited.items():
        if gid not in ids or type(enabled) is not bool:
            raise InvalidLayout("Invalid group inheritance setting")
    inherited = {gid: True for gid, enabled in inherited.items() if enabled}
    if not isinstance(saved_presets, dict) or len(saved_presets) > 30:
        raise InvalidLayout("Invalid theme preset collection")
    forbidden_names = {"Classic", "Minimal", "Soft", "Neon", "Tropical", "Ocean", "Library", "Custom"}
    custom_presets = {}
    for name, preset in saved_presets.items():
        if not isinstance(name, str) or not 1 <= len(name.strip()) <= 48 or name in forbidden_names:
            raise InvalidLayout("Invalid custom preset name")
        custom_presets[name] = validate_theme(preset)
        if custom_presets[name] is None:
            raise InvalidLayout("Null custom preset")
    restore_paths = ui.get("restorePaths", [])
    if not isinstance(restore_paths, list) or len(restore_paths) > 300:
        raise InvalidLayout("Invalid restore workflow list")
    seen_restore = set()
    for path in restore_paths:
        if not isinstance(path, str) or not 10 < len(path) <= 2048 or not path.startswith("workflows/") or not path.endswith(".json"):
            raise InvalidLayout("Invalid restore workflow path")
        if any(p in (".", "..") for p in path.split("/")) or "\\" in path or any(ord(c) < 32 for c in path):
            raise InvalidLayout("Unsafe restore workflow path")
        if path in seen_restore:
            raise InvalidLayout("Duplicate restore workflow path")
        seen_restore.add(path)
    normalized = {
        "groups": [{"id": g["id"], "name": g["name"], "color": g["color"],
                    "collapsed": g["collapsed"], "parentId": g.get("parentId")} for g in groups],
        "assignments": assignments,
        "ui": {"createButtonColor": color, "restorePaths": restore_paths, "theme": theme, "themeScopes": scopes, "appearances": appearances, "customPresets": custom_presets, "inheritGroupAppearance": inherited, "inheritGroupDesign": design_inherited},
    }
    if len(json.dumps(normalized, ensure_ascii=False).encode("utf-8")) > _MAX_BYTES:
        raise InvalidLayout("Layout exceeds 1 MiB")
    return normalized


def _revision(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def load_layout(path: Path) -> dict:
    with _LOCK:
        if not path.exists():
            return {"state": None, "revision": None}
        contents = path.read_bytes()
        if len(contents) > _MAX_BYTES:
            raise InvalidLayout("Saved layout exceeds size limit")
        state = validate_layout(json.loads(contents))
        return {"state": state, "revision": _revision(contents)}


def write_layout(path: Path, state: Any, expected_revision: str | None) -> dict:
    normalized = validate_layout(state)
    if expected_revision is not None and (not isinstance(expected_revision, str) or not re.fullmatch(r"[0-9a-f]{64}", expected_revision)):
        raise InvalidLayout("Invalid revision token")
    data = json.dumps(normalized, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    if len(data) > _MAX_BYTES:
        raise InvalidLayout("Layout exceeds 1 MiB")
    with _LOCK:
        current = load_layout(path)
        if current["revision"] != expected_revision:
            raise StaleRevision(current)
        path.parent.mkdir(parents=True, exist_ok=True)
        temp_path = None
        try:
            with tempfile.NamedTemporaryFile(mode="wb", dir=path.parent, prefix=".ctm-", suffix=".tmp", delete=False) as tmp:
                temp_path = Path(tmp.name)
                tmp.write(data)
                tmp.flush()
                os.fsync(tmp.fileno())
            if path.exists():
                shutil.copy2(path, path.with_name("settings.backup.json"))
            os.replace(temp_path, path)
            temp_path = None
        finally:
            if temp_path is not None:
                temp_path.unlink(missing_ok=True)
        return {"state": normalized, "revision": _revision(data)}


def register_routes() -> None:
    import asyncio
    from aiohttp import web
    import folder_paths
    from server import PromptServer

    routes = PromptServer.instance.routes

    def target(request):
        # ComfyUI may send an empty Comfy-User header when using its default profile.
        # Treat only a missing/blank header as "default"; other invalid IDs must
        # still be rejected by storage_path(), avoiding path traversal.
        user_id = (request.headers.get("Comfy-User") or "").strip() or "default"
        return storage_path(folder_paths.get_user_directory(), user_id)

    @routes.get("/comfy-tab-manager/state")
    async def get_state(request):
        try:
            result = await asyncio.to_thread(load_layout, target(request))
            return web.json_response(result, headers={"Cache-Control": "no-store"})
        except InvalidLayout as exc:
            return web.json_response({"error": str(exc)}, status=400)
        except (OSError, ValueError) as exc:
            return web.json_response({"error": "Could not read layout"}, status=500)

    @routes.post("/comfy-tab-manager/state")
    async def put_state(request):
        if request.content_length and request.content_length > _MAX_BYTES + 512:
            return web.json_response({"error": "Payload too large"}, status=413)
        try:
            # StreamReader.read(n) may return just one available network fragment.
            # Read through EOF while retaining the same strict request-size bound.
            raw = bytearray()
            while len(raw) <= _MAX_BYTES + 512:
                chunk = await request.content.read(min(65536, _MAX_BYTES + 513 - len(raw)))
                if not chunk:
                    break
                raw.extend(chunk)
            if len(raw) > _MAX_BYTES + 512:
                return web.json_response({"error": "Payload too large"}, status=413)
            body = json.loads(raw)
            if not isinstance(body, dict) or "revision" not in body:
                raise InvalidLayout("Missing revision")
            result = await asyncio.to_thread(write_layout, target(request), body.get("state"), body["revision"])
            return web.json_response(result, headers={"Cache-Control": "no-store"})
        except StaleRevision as exc:
            return web.json_response({"error": "Revision conflict", **exc.current}, status=409)
        except (InvalidLayout, ValueError, UnicodeDecodeError) as exc:
            return web.json_response({"error": str(exc)}, status=400)
        except OSError:
            return web.json_response({"error": "Could not save layout"}, status=500)
