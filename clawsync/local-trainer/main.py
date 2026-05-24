from __future__ import annotations

import asyncio
import json
import tempfile
from pathlib import Path

import torch
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

from device import get_device
from frames import extract_frames
from inference import predict_image, predict_video_frame
from jobs import create_job, get_job, run_job_in_background, update_job
from labels_util import parse_labels
from trainers.registry import resolve_model_path
from trainers.run import run_training

ROOT = Path(__file__).resolve().parent
OUTPUT_ROOT = ROOT / "output" / "runs"
OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="ClawSync Local Trainer", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {
        "ok": True,
        "device": get_device(),
        "torch_version": torch.__version__,
    }


@app.post("/train")
async def start_train(
    video: UploadFile = File(...),
    model_id: str = Form("openai/clip-vit-base-patch32"),
    epochs: int = Form(3),
    learning_rate: float = Form(5e-5),
    sample_rate_sec: float = Form(1.0),
    labels: str = Form("action"),
    model_files: list[UploadFile] | None = File(None),
):
    label_list = parse_labels(labels)
    job_id = create_job(epochs, model_id, label_list)
    out_dir = OUTPUT_ROOT / job_id
    out_dir.mkdir(parents=True, exist_ok=True)

    video_path = out_dir / (video.filename or "input.mp4")
    video_bytes = await video.read()
    video_path.write_bytes(video_bytes)

    local_model_dir: str | None = None
    if model_files:
        model_dir = out_dir / "base_model"
        model_dir.mkdir(parents=True, exist_ok=True)
        for f in model_files:
            name = Path(f.filename or "file").name
            dest = model_dir / name
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(await f.read())
        if not (model_dir / "config.json").exists():
            raise HTTPException(
                status_code=400,
                detail="Uploaded model folder must include config.json",
            )
        local_model_dir = str(model_dir)

    try:
        frames = extract_frames(str(video_path), sample_rate_sec)
    except ValueError as exc:
        update_job(job_id, status="error", error=str(exc))
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    resolved = resolve_model_path(model_id if not local_model_dir else None, local_model_dir)

    def worker(_job):
        update_job(job_id, status="running", epoch=0)

        def on_epoch(epoch: int, total: int, loss: float) -> None:
            update_job(
                job_id,
                epoch=epoch,
                total_epochs=total,
                loss=loss,
                status="running",
            )

        result = run_training(
            resolved,
            frames,
            label_list,
            out_dir,
            epochs,
            learning_rate,
            on_epoch,
        )
        update_job(job_id, output_path=result.output_path, labels=result.labels)

    run_job_in_background(job_id, worker)

    return {"job_id": job_id}


@app.get("/train/progress")
async def train_progress(job_id: str):
    job = get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    async def event_generator():
        while True:
            j = get_job(job_id)
            if j is None:
                break
            payload = {
                "epoch": j.epoch,
                "total_epochs": j.total_epochs,
                "loss": j.loss,
                "status": j.status,
                "error": j.error,
                "output_path": j.output_path,
            }
            yield {"event": "progress", "data": json.dumps(payload)}
            if j.status in ("done", "error"):
                break
            await asyncio.sleep(0.5)

    return EventSourceResponse(event_generator())


@app.get("/train/{job_id}")
def train_status(job_id: str):
    job = get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "job_id": job.job_id,
        "status": job.status,
        "epoch": job.epoch,
        "total_epochs": job.total_epochs,
        "loss": job.loss,
        "output_path": job.output_path,
        "labels": job.labels,
        "error": job.error,
    }


@app.get("/train/{job_id}/metrics")
def train_metrics(job_id: str):
    job = get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    run_dir = Path(job.output_path) if job.output_path else OUTPUT_ROOT / job_id
    labels_file = run_dir / "labels.json"
    metrics_file = run_dir / "metrics.json"
    if not labels_file.exists():
        return {"ready": False, "labels": job.labels, "losses": [], "final_loss": None}
    labels_data = json.loads(labels_file.read_text(encoding="utf-8"))
    metrics_data = (
        json.loads(metrics_file.read_text(encoding="utf-8"))
        if metrics_file.exists()
        else {}
    )
    return {
        "ready": True,
        "labels": labels_data.get("labels", []),
        "losses": labels_data.get("losses", []),
        "final_loss": metrics_data.get("final_loss"),
        "model_id": labels_data.get("model_id"),
        "output_path": str(run_dir.resolve()),
    }


@app.post("/infer")
async def infer(
    job_id: str = Form(...),
    image: UploadFile | None = File(None),
    video: UploadFile | None = File(None),
):
    job = get_job(job_id)
    if job is None or not job.output_path:
        raise HTTPException(status_code=404, detail="Job not found or not finished")

    run_dir = job.output_path

    if image is not None:
        from PIL import Image as PILImage
        import io

        data = await image.read()
        pil = PILImage.open(io.BytesIO(data)).convert("RGB")
        preds = predict_image(run_dir, pil)
        return {"predictions": preds}

    if video is not None:
        with tempfile.TemporaryDirectory() as tmp:
            vpath = Path(tmp) / (video.filename or "clip.mp4")
            vpath.write_bytes(await video.read())
            frames = extract_frames(str(vpath), sample_rate_sec=1.0)
            preds = predict_video_frame(run_dir, frames[0])
            return {"predictions": preds, "frame_index": 0}

    raise HTTPException(status_code=400, detail="Provide image or video")
