from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

import numpy as np
import torch
from PIL import Image
from torch.utils.data import DataLoader, Dataset

from device import get_device
from labels_util import assign_frame_labels


@dataclass
class TrainResult:
    output_path: str
    labels: list[str]


class FrameDataset(Dataset):
    def __init__(
        self,
        frames: list[np.ndarray],
        y: list[int],
        transform,
    ) -> None:
        self.frames = frames
        self.y = y
        self.transform = transform

    def __len__(self) -> int:
        return len(self.frames)

    def __getitem__(self, idx: int):
        img = Image.fromarray(self.frames[idx])
        tensor = self.transform(img)
        return tensor, torch.tensor(self.y[idx], dtype=torch.long)


def run_training_loop(
    model: torch.nn.Module,
    train_loader: DataLoader,
    device: str,
    epochs: int,
    learning_rate: float,
    on_epoch: Callable[[int, int, float], None],
) -> list[float]:
    model.to(device)
    model.train()
    optimizer = torch.optim.AdamW(model.parameters(), lr=learning_rate)
    criterion = torch.nn.CrossEntropyLoss()
    losses: list[float] = []

    for epoch in range(1, epochs + 1):
        epoch_loss = 0.0
        batches = 0
        for batch_x, batch_y in train_loader:
            batch_x = batch_x.to(device)
            batch_y = batch_y.to(device)
            optimizer.zero_grad()
            outputs = model(batch_x)
            if isinstance(outputs, torch.Tensor):
                logits = outputs
            elif hasattr(outputs, "logits"):
                logits = outputs.logits
            else:
                raise TypeError(f"Model returned unsupported type: {type(outputs)}")
            loss = criterion(logits, batch_y)
            loss.backward()
            optimizer.step()
            epoch_loss += float(loss.item())
            batches += 1
        avg = epoch_loss / max(batches, 1)
        losses.append(avg)
        on_epoch(epoch, epochs, avg)

    return losses


def save_training_artifacts(
    output_dir: Path,
    model: torch.nn.Module,
    processor,
    labels: list[str],
    losses: list[float],
    model_id: str,
) -> str:
    output_dir.mkdir(parents=True, exist_ok=True)
    if hasattr(model, "save_pretrained"):
        model.save_pretrained(output_dir)
    else:
        torch.save(model.state_dict(), output_dir / "model.pt")
    if processor is not None and hasattr(processor, "save_pretrained"):
        processor.save_pretrained(output_dir)
    meta = {
        "labels": labels,
        "losses": losses,
        "model_id": model_id,
    }
    (output_dir / "labels.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    (output_dir / "metrics.json").write_text(
        json.dumps({"final_loss": losses[-1] if losses else None}, indent=2),
        encoding="utf-8",
    )
    return str(output_dir.resolve())


def prepare_data(
    frames: list[np.ndarray],
    labels: list[str],
    transform,
    batch_size: int = 4,
) -> tuple[DataLoader, list[int]]:
    y = assign_frame_labels(len(frames), labels)
    dataset = FrameDataset(frames, y, transform)
    loader = DataLoader(dataset, batch_size=min(batch_size, len(dataset)), shuffle=True)
    return loader, y
