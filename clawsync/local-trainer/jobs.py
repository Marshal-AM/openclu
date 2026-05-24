from __future__ import annotations

import threading
import uuid
from dataclasses import dataclass, field
from typing import Any, Callable


@dataclass
class JobState:
    job_id: str
    status: str = "queued"
    epoch: int = 0
    total_epochs: int = 0
    loss: float | None = None
    message: str = ""
    output_path: str | None = None
    error: str | None = None
    labels: list[str] = field(default_factory=list)
    model_id: str = ""


_jobs: dict[str, JobState] = {}
_lock = threading.Lock()


def create_job(total_epochs: int, model_id: str, labels: list[str]) -> str:
    job_id = str(uuid.uuid4())[:8]
    with _lock:
        _jobs[job_id] = JobState(
            job_id=job_id,
            status="queued",
            total_epochs=total_epochs,
            model_id=model_id,
            labels=labels,
        )
    return job_id


def get_job(job_id: str) -> JobState | None:
    with _lock:
        return _jobs.get(job_id)


def update_job(job_id: str, **kwargs: Any) -> None:
    with _lock:
        job = _jobs.get(job_id)
        if job is None:
            return
        for key, value in kwargs.items():
            if hasattr(job, key):
                setattr(job, key, value)


def run_job_in_background(job_id: str, fn: Callable[[JobState], None]) -> None:
    def worker() -> None:
        job = get_job(job_id)
        if job is None:
            return
        try:
            update_job(job_id, status="running")
            fn(job)
            update_job(job_id, status="done")
        except Exception as exc:  # noqa: BLE001
            update_job(job_id, status="error", error=str(exc))

    thread = threading.Thread(target=worker, daemon=True)
    thread.start()
