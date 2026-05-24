from __future__ import annotations

from pathlib import Path

import numpy as np

from trainers.vit_trainer import train_vit


def train_mobilevit(
    model_path: str,
    frames: list[np.ndarray],
    labels: list[str],
    output_dir: Path,
    epochs: int,
    learning_rate: float,
    on_epoch,
):
    result = train_vit(
        model_path, frames, labels, output_dir, epochs, learning_rate, on_epoch
    )
    (output_dir / "trainer_kind.txt").write_text("mobilevit", encoding="utf-8")
    return result
