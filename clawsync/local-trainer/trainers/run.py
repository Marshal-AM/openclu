from __future__ import annotations

from pathlib import Path

import numpy as np

from trainers.clip_trainer import train_clip
from trainers.mobilevit_trainer import train_mobilevit
from trainers.registry import get_trainer_kind
from trainers.vit_trainer import train_vit


def run_training(
    model_path: str,
    frames: list[np.ndarray],
    labels: list[str],
    output_dir: Path,
    epochs: int,
    learning_rate: float,
    on_epoch,
):
    kind = get_trainer_kind(model_path)
    if kind == "clip":
        return train_clip(
            model_path, frames, labels, output_dir, epochs, learning_rate, on_epoch
        )
    if kind == "mobilevit":
        return train_mobilevit(
            model_path, frames, labels, output_dir, epochs, learning_rate, on_epoch
        )
    return train_vit(
        model_path, frames, labels, output_dir, epochs, learning_rate, on_epoch
    )
