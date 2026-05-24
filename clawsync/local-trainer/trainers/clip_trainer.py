from __future__ import annotations

from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from transformers import CLIPModel, CLIPProcessor

from device import get_device
from labels_util import assign_frame_labels
from trainers.base import (
    TrainResult,
    run_training_loop,
    save_training_artifacts,
)


def clip_image_embedding(clip_model: CLIPModel, pixel_values: torch.Tensor) -> torch.Tensor:
    """Vision embedding as a tensor (compatible with all transformers versions)."""
    vision_outputs = clip_model.vision_model(pixel_values=pixel_values)
    pooled = vision_outputs.pooler_output
    if pooled is None:
        pooled = vision_outputs.last_hidden_state[:, 0, :]
    return clip_model.visual_projection(pooled)


class ClipClassifier(nn.Module):
    def __init__(self, clip_model: CLIPModel, num_labels: int) -> None:
        super().__init__()
        self.clip = clip_model
        hidden = clip_model.config.projection_dim
        self.head = nn.Linear(hidden, num_labels)

    def forward(self, pixel_values: torch.Tensor) -> torch.Tensor:
        features = clip_image_embedding(self.clip, pixel_values)
        return self.head(features)


def train_clip(
    model_path: str,
    frames: list[np.ndarray],
    labels: list[str],
    output_dir: Path,
    epochs: int,
    learning_rate: float,
    on_epoch,
) -> TrainResult:
    device = get_device()
    processor = CLIPProcessor.from_pretrained(model_path)
    clip = CLIPModel.from_pretrained(model_path)
    model = ClipClassifier(clip, num_labels=len(labels))
    y = assign_frame_labels(len(frames), labels)

    class _Dataset(torch.utils.data.Dataset):
        def __len__(self):
            return len(frames)

        def __getitem__(self, idx):
            from PIL import Image

            img = Image.fromarray(frames[idx])
            inputs = processor(images=img, return_tensors="pt")
            return inputs["pixel_values"].squeeze(0), torch.tensor(y[idx], dtype=torch.long)

    loader = torch.utils.data.DataLoader(
        _Dataset(),
        batch_size=min(4, len(frames)),
        shuffle=True,
    )

    losses = run_training_loop(model, loader, device, epochs, learning_rate, on_epoch)
    path = save_training_artifacts(output_dir, model, processor, labels, losses, model_path)
    (output_dir / "trainer_kind.txt").write_text("clip", encoding="utf-8")
    return TrainResult(output_path=path, labels=labels)
