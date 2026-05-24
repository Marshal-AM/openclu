# ClawSync Local Trainer

Local FastAPI server for fine-tuning small Hugging Face vision models on video frames. Used by the **Train your AI** tab in ClawSync SyncBoard.

## Architecture

```
Browser (Vite :5173)  →  HTTP  →  FastAPI (:8000)  →  PyTorch (CPU / CUDA / MPS)
```

Training data and weights stay on your machine. Nothing is sent to Convex.

## One-time setup (Windows)

```powershell
cd c:\Users\MSI\Desktop\openclu\clawsync\local-trainer
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Optional NVIDIA GPU (replace CPU torch):

```powershell
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu124
```

## Start the server

From the `clawsync` root:

```powershell
npm run trainer:dev
```

Or from `local-trainer`:

```powershell
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Verify: `http://127.0.0.1:8000/health`

## Download a model from Hugging Face

### Option 1 — automatic (recommended)

Pick a preset in the UI (e.g. `openai/clip-vit-base-patch32`). On first train, `transformers` downloads weights to:

`%USERPROFILE%\.cache\huggingface\hub`

### Option 2 — CLI pre-download

```powershell
pip install huggingface_hub
huggingface-cli download openai/clip-vit-base-patch32 --local-dir .\models\clip-vit-b32
```

In ClawSync, enable **Upload local model folder** and select `models\clip-vit-b32` (must contain `config.json`).

### Option 3 — CPU-friendly presets

| Model ID | Size | Notes |
|----------|------|--------|
| `openai/clip-vit-base-patch32` | ~350MB | Default demo |
| `apple/mobilevit-small-224` | ~20MB | Fastest on CPU |
| `google/vit-base-patch16-224` | ~330MB | Standard ViT |

Gated models: `huggingface-cli login`

## Train from ClawSync

1. `npx convex dev` and `npm run dev` (ClawSync frontend)
2. `npm run trainer:dev` (this server)
3. Open `http://localhost:5173/syncboard/train-ai`
4. Confirm **Trainer connected**
5. Choose model → upload `.mp4` / `.webm` / `.mov`
6. Set sample rate (1 = one frame per second), epochs (e.g. 3), labels
7. Click **Train** and watch progress
8. When done, run **Test inference** on an image

### Labels

- One label (e.g. `action`) automatically adds a second class `other` (frames split across both).
- Two or more comma-separated labels split frames evenly (e.g. `opening,clicking`).

## Output

Fine-tuned artifacts:

`clawsync/local-trainer/output/runs/<job_id>/`

- `labels.json`, `metrics.json`
- `trainer_kind.txt` (`clip`, `vit`, or `mobilevit`)
- Model weights (`model.pt` and/or Hugging Face layout)

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Device and PyTorch version |
| POST | `/train` | multipart: video, model_id, hyperparams |
| GET | `/train/progress?job_id=` | SSE progress stream |
| GET | `/train/{job_id}` | Job status |
| POST | `/infer` | multipart: job_id + image or video |

## Limitations (v1)

- Vision **classification** only (CLIP / ViT / MobileViT family)
- `.gguf` weights are not supported (llama.cpp format)
- Large multimodal models (LLaVA, Phi-3-vision) are not bundled — use the presets above

## Environment

ClawSync frontend optional env:

`VITE_LOCAL_TRAINER_URL=http://127.0.0.1:8000`

Dev proxy: requests to `/local-trainer/*` can be proxied via Vite (see `vite.config.ts`).
