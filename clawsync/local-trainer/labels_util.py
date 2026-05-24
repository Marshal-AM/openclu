from __future__ import annotations

import numpy as np


def parse_labels(raw: str) -> list[str]:
    labels = [part.strip() for part in raw.split(",") if part.strip()]
    if not labels:
        raise ValueError("At least one label is required")
    if len(labels) == 1:
        labels.append("other")
    return labels


def assign_frame_labels(num_frames: int, labels: list[str]) -> list[int]:
    """Assign class indices by splitting frames across labels."""
    if num_frames < len(labels):
        raise ValueError(
            f"Need at least {len(labels)} frames for {len(labels)} labels; got {num_frames}"
        )
    indices = np.array_split(np.arange(num_frames), len(labels))
    y: list[int] = [0] * num_frames
    for class_idx, frame_idxs in enumerate(indices):
        for fi in frame_idxs:
            y[int(fi)] = class_idx
    return y
