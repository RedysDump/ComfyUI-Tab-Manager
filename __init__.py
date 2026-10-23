"""ComfyUI Tab Manager: color-coded workflow tabs with optional server-backed layout storage."""

from .server_storage import register_routes

WEB_DIRECTORY = "./web"
NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}

try:
    register_routes()
except ImportError as exc:
    # Standalone tests can import validation without ComfyUI installed.
    # In a real ComfyUI environment missing dependencies should be reported.
    print(f"[ComfyUI Tab Manager] Could not register persistence routes: {exc}")
