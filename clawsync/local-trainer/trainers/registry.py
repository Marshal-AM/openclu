from __future__ import annotations

PRESET_MODELS = {
    "openai/clip-vit-base-patch32": "clip",
    "apple/mobilevit-small-224": "mobilevit",
    "google/vit-base-patch16-224": "vit",
    "google/vit-base-patch16-224-in21k": "vit",
}


def get_trainer_kind(model_id: str) -> str:
    if model_id in PRESET_MODELS:
        return PRESET_MODELS[model_id]
    lowered = model_id.lower()
    if "clip" in lowered:
        return "clip"
    if "mobilevit" in lowered:
        return "mobilevit"
    return "vit"


def resolve_model_path(model_id: str | None, local_dir: str | None) -> str:
    if local_dir:
        return local_dir
    if not model_id:
        raise ValueError("model_id or local model folder is required")
    return model_id
