# Skill Capture

Record screen + voice locally, extract `SKILL.md` with Groq, **encrypt on your machine**, register IP on Story, and publish catalog metadata to Arkiv — all signed with your **device wallet** (`skill-capture/.env`).

## Architecture

| Component | Where it runs | Responsibility |
|-----------|---------------|------------------|
| **CLI** (`cli/`) | Your machine | Capture, process, Story IP, local Helia, Arkiv catalog (in-process) |
| **Orchestrator** (`orchestrator/`) | `http://127.0.0.1:8790` | UI job API: draft SKILL.md, spawn capture/distribute |
| **Frontend** (`../frontend/`) | `http://localhost:3000` | Register, login, contribute, purchase search |
| **CDR** (`cdr/`) | In-process from CLI | WASM encrypt + local `.helia-data` (no HTTP server required) |
| **Arkiv** (`arkiv/`) | In-process from CLI | Braga `skillListing` + tags (`$owner` = device wallet) |

Raw audio and frames stay local. Ciphertext is pinned on local Helia. **No CDR or Arkiv HTTP servers** are required for the main flow.

## Prerequisites

- Python 3.10+ with `requirements.txt` (includes bundled **ffmpeg** via `imageio-ffmpeg` for training video)
- Node.js 22+
- `GROQ_API_KEY` in `skill-capture/.env`
- Device wallet from `register.sh` (fund on Story Aeneid + Braga GLM)
- Supabase project + `supabase/schema.sql` applied
- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in **`frontend/.env.local` only** (all DB access)

## Multi-user + deployed frontend (ngrok)

Each contributor runs **orchestrator on their PC** and tunnels it with **ngrok** during `register.sh`:

1. Terminal A: `cd orchestrator && npm run start` — prints **ngrok public URL** automatically (`NGROK_AUTHTOKEN` in `skill-capture/.env`, `pyngrok` in venv)
2. Add `NGROK_AUTHTOKEN` to `skill-capture/.env` ([ngrok dashboard](https://dashboard.ngrok.com/get-started/your-authtoken))
3. Run `.\register.ps1` — reads `publicUrl` from orchestrator `/health`, puts it in the QR link, saves to Supabase on confirm
4. Set `FRONTEND_URL` in `skill-capture/.env` to your **Vercel** (or local) app URL before `register.ps1`
5. `register.ps1` POSTs pending registration to **`FRONTEND_URL/api/devices/pending`** (not the orchestrator)
6. In Contribute, choose a registered device; the UI proxies jobs to that device ngrok URL (`devices.orchestrator_url`)

Keep orchestrator + ngrok running while contributing. Supabase credentials live **only on the frontend** (local or Vercel).

## First-time device setup

```powershell
cd skill-capture\orchestrator
npm run start
```

In another terminal:

```powershell
cd skill-capture
.\venv\Scripts\Activate.ps1
npm run setup
.\register.ps1   # or ./register.sh on Git Bash
```

Scan the QR / open the link → sign in with your owner wallet → confirm device registration.

## Setup (once)

```powershell
cd skill-capture
python -m venv venv
.\venv\Scripts\Activate.ps1
npm run setup

cd ..\frontend
copy .env.local.example .env.local
npm install
```

`npm run setup` runs `pip install -r requirements.txt` (including **imageio-ffmpeg**, which provides ffmpeg for training video capture) and installs Node deps for `cdr`, `arkiv`, `cli`, and `orchestrator`.

Manual alternative:

```powershell
pip install -r requirements.txt
cd cdr && copy .env.example .env && npm install
cd ..\arkiv && npm install
cd ..\cli && npm install
cd ..\orchestrator && npm install
```

## Run — 2 terminals (+ Python venv when capturing)

**Terminal 1 — Orchestrator**

```powershell
cd skill-capture\orchestrator
npm run start
```

**Terminal 2 — Frontend**

```powershell
cd frontend
npm run dev
```

**Contribute flow (browser)**

1. Sign in with your owner wallet.
2. **Contribute** → fill metadata → **Save draft** (writes `skills/<slug>/SKILL.md`).
3. **Start recording** → press **Q** in the terminal when done.
4. Orchestrator auto-runs distribute (Story + Helia + Arkiv, device key).

### Edit, archive, and re-publish (Contribute UI)

| Action | What it does |
|--------|----------------|
| **Edit → Save metadata to Arkiv** | Updates `SKILL.md` on device, then `POST /api/v1/jobs/update-catalog` (Arkiv listing full-replace + new `listingVersion`, same CDR vault/CID). |
| **Re-record & republish** | New capture → distribute (new Story IP + vault + CID + Arkiv version). |
| **Re-encrypt** | Full `republish` / distribute without re-recording (new IP + vault). |
| **Archive** | Soft-delete: Arkiv `status: archived`, tags removed; hidden from marketplace browse. |

Ownership: Arkiv writes use the device wallet as **`$owner`** (only that wallet can update/archive). Reads can filter **`.createdBy(deviceWallet)`** for tamper-proof publisher attribution.

Orchestrator: `GET /api/v1/skills/:slug/draft` loads metadata for the edit form.

### CLI only (no UI)

```powershell
cd skill-capture
.\venv\Scripts\Activate.ps1
# Ensure draft SKILL.md exists under skills/<name>/
cd cli
npm run skill -- my-workflow
```

### Distribute only

```powershell
cd skill-capture\cli
npm run distribute -- my-workflow
```

### Metadata-only Arkiv update (no re-encrypt)

After editing `skills/<slug>/SKILL.md`:

```powershell
cd skill-capture\arkiv
npx tsx src/jobs/update-catalog.ts my-workflow
```

Or: `cd cdr && npm run index-arkiv -- my-workflow`

## Env (`skill-capture/.env`)

Set by `register.sh` / `register.ps1`:

```env
DEVICE_WALLET_PRIVATE_KEY=...
DEVICE_WALLET_ADDRESS=...
GROQ_API_KEY=...
```

`cdr/.env` and `arkiv/.env` are **not** used for contributor signing. RPC URLs may still be read from `cdr/.env` for Story.

## Legacy HTTP servers (optional, deprecated)

`npm run server` in `cdr/` and `arkiv/` is no longer part of the default runbook. Use the CLI local pipeline instead.

## Purchase

Buyers use `cdr` purchase CLI; listings are discovered via the frontend **Purchase** tab (Arkiv public queries).
