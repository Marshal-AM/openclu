from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from transformers import (
    AutoImageProcessor,
    AutoModelForImageClassification,
    CLIPModel,
    CLIPProcessor,
)

from device import get_device
from trainers.clip_trainer import ClipClassifier


def _load_meta(run_dir: Path) -> dict:
    labels_path = run_dir / "labels.json"
    if not labels_path.exists():
        raise FileNotFoundError(f"Missing labels.json in {run_dir}")
    return json.loads(labels_path.read_text(encoding="utf-8"))


def predict_image(run_dir: str, image: Image.Image, top_k: int = 3) -> list[dict]:
    run_path = Path(run_dir)
    meta = _load_meta(run_path)
    labels: list[str] = meta["labels"]
    model_id: str = meta["model_id"]
    kind = (run_path / "trainer_kind.txt").read_text(encoding="utf-8").strip()
    device = get_device()

    if kind == "clip":
        processor = CLIPProcessor.from_pretrained(run_path)
        clip = CLIPModel.from_pretrained(model_id)
        model = ClipClassifier(clip, num_labels=len(labels))
        state = torch.load(run_path / "model.pt", map_location=device, weights_only=True)
        model.load_state_dict(state)
        model.to(device)
        model.eval()
        inputs = processor(images=image, return_tensors="pt")
        with torch.no_grad():
            logits = model(inputs["pixel_values"].to(device))
    else:
        processor = AutoImageProcessor.from_pretrained(run_path)
        model = AutoModelForImageClassification.from_pretrained(run_path)
        pt_path = run_path / "model.pt"
        if pt_path.exists():
            state = torch.load(pt_path, map_location=device, weights_only=True)
            model.load_state_dict(state, strict=False)
        model.to(device)
        model.eval()
        inputs = processor(images=image, return_tensors="pt")
        with torch.no_grad():
            out = model(inputs["pixel_values"].to(device))
            logits = out.logits

    probs = torch.softmax(logits, dim=-1)[0]
    k = min(top_k, len(labels))
    values, indices = torch.topk(probs, k)
    return [
        {"label": labels[int(i)], "score": float(v)}
        for v, i in zip(values.tolist(), indices.tolist())
    ]


def predict_video_frame(run_dir: str, frame: np.ndarray, top_k: int = 3) -> list[dict]:
    return predict_image(run_dir, Image.fromarray(frame), top_k=top_k)
