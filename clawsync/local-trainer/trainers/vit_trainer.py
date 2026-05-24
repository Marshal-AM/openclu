from __future__ import annotations

from pathlib import Path

import numpy as np
import torch
from transformers import AutoImageProcessor, AutoModelForImageClassification

from device import get_device
from trainers.base import (
    TrainResult,
    prepare_data,
    run_training_loop,
    save_training_artifacts,
)


def train_vit(
    model_path: str,
    frames: list[np.ndarray],
    labels: list[str],
    output_dir: Path,
    epochs: int,
    learning_rate: float,
    on_epoch,
) -> TrainResult:
    device = get_device()
    processor = AutoImageProcessor.from_pretrained(model_path)
    model = AutoModelForImageClassification.from_pretrained(
        model_path,
        num_labels=len(labels),
        ignore_mismatched_sizes=True,
    )

    def transform(img):
        inputs = processor(images=img, return_tensors="pt")
        return inputs["pixel_values"].squeeze(0)

    loader, _ = prepare_data(frames, labels, transform)

    class VitWrapper(torch.nn.Module):
        def __init__(self, inner) -> None:
            super().__init__()
            self.inner = inner

        def forward(self, pixel_values: torch.Tensor):
            return self.inner(pixel_values=pixel_values)

    losses = run_training_loop(
        VitWrapper(model), loader, device, epochs, learning_rate, on_epoch
    )
    path = save_training_artifacts(output_dir, model, processor, labels, losses, model_path)
    (output_dir / "trainer_kind.txt").write_text("vit", encoding="utf-8")
    return TrainResult(output_path=path, labels=labels)
