from __future__ import annotations

import cv2
import numpy as np


def extract_frames(video_path: str, sample_rate_sec: float = 1.0) -> list[np.ndarray]:
    """Sample video frames at roughly ``sample_rate_sec`` seconds apart."""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError(f"Could not open video: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    interval = max(1, int(fps * max(sample_rate_sec, 0.1)))
    frames: list[np.ndarray] = []
    count = 0

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
        if count % interval == 0:
            frames.append(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        count += 1

    cap.release()
    if not frames:
        raise ValueError("No frames extracted from video")
    return frames
