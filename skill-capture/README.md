# Skill Capture

Record screen + voice locally, extract `SKILL.md` with Groq, **encrypt on your machine**, register IP on Story, and publish catalog metadata to Supabase catalog — all signed with your **device wallet** (`skill-capture/.env`).

## Architecture

| Component | Where it runs | Responsibility |
|-----------|---------------|------------------|
| **CLI** (`cli/`) | Your machine | Capture, process, Story IP, local Helia, Supabase catalog (in-process) |
| **Orchestrator** (`orchestrator/`) | `http://127.0.0.1:8790` | UI job API: draft SKILL.md, spawn capture/distribute |
| **Frontend** (`../frontend/`) | `http://localhost:3000` | Register, login, contribute, purchase search |
| **CDR** (`cdr/`) | In-process from CLI | WASM encrypt + local `.helia-data` (no HTTP server required) |
| **Supabase catalog** (`db/`) | In-process from CLI | Braga `skillListing` + tags (`$owner` = device wallet) |

Raw audio and frames stay local. Ciphertext is pinned on local Helia. **No CDR or Supabase catalog HTTP servers** are required for the main flow.

## Prerequisites

- Python 3.10+ with `requirements.txt` (includes bundled **ffmpeg** via `imageio-ffmpeg` for training video)
- Node.js 22+
- `GROQ_API_KEY` in `skill-capture/.env`
- Device wallet from `register.sh` (fund on Story Aeneid + Supabase project)
- `PORTAL_WALLET_PRIVATE_KEY` in **`frontend/.env.local`** (Supabase catalog portal reads/writes for users + devices)

## Multi-user + deployed frontend (ngrok)

Each contributor runs **orchestrator on their PC** and tunnels it with **ngrok** during `register.sh`:

1. Terminal A: `cd orchestrator && npm run start` — prints **ngrok public URL** automatically (`NGROK_AUTHTOKEN` in `skill-capture/.env`, `pyngrok` in venv)
2. Add `NGROK_AUTHTOKEN` to `skill-capture/.env` ([ngrok dashboard](https://dashboard.ngrok.com/get-started/your-authtoken))
3. Run `.\register.ps1` — reads `publicUrl` from orchestrator `/health`, puts it in the QR link, saves to Supabase catalog on confirm
4. Set `FRONTEND_URL` in `skill-capture/.env` to your **Vercel** (or local) app URL before `register.ps1`
5. `register.ps1` POSTs pending registration to **`FRONTEND_URL/api/devices/pending`** (not the orchestrator)
6. In Contribute, choose a registered device; the UI proxies jobs to that device ngrok URL (`devices.orchestrator_url`)

Keep orchestrator + ngrok running while contributing. Portal wallet credentials live **only on the frontend** (local or Vercel) for Supabase catalog user/device storage.

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

`npm run setup` runs `pip install -r requirements.txt` (including **imageio-ffmpeg**, which provides ffmpeg for training video capture) and installs Node deps for `cdr`, `db`, `cli`, and `orchestrator`.

Manual alternative:

```powershell
pip install -r requirements.txt
cd cdr && copy .env.example .env && npm install
cd ..\db && npm install
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
4. Orchestrator auto-runs distribute (Story + Helia + Supabase catalog, device key).

### Edit, archive, and re-publish (Contribute UI)

| Action | What it does |
|--------|----------------|
| **Edit → Save metadata to Supabase catalog** | Updates `SKILL.md` on device, then `POST /api/v1/jobs/update-catalog` (Supabase catalog listing full-replace + new `listingVersion`, same CDR vault/CID). |
| **Re-record & republish** | New capture → distribute (new Story IP + vault + CID + Supabase catalog version). |
| **Re-encrypt** | Full `republish` / distribute without re-recording (new IP + vault). |
| **Archive** | Soft-delete: Supabase catalog `status: archived`, tags removed; hidden from marketplace browse. |

Ownership: Supabase catalog writes use the device wallet as **`$owner`** (only that wallet can update/archive). Reads can filter **`.createdBy(deviceWallet)`** for tamper-proof publisher attribution.

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

### Metadata-only Supabase catalog update (no re-encrypt)

After editing `skills/<slug>/SKILL.md`:

```powershell
cd skill-capture\db
npx tsx src/jobs/update-catalog.ts my-workflow
```

Or: `cd cdr && npm run index-catalog -- my-workflow`

## Env (`skill-capture/.env`)

Set by `register.sh` / `register.ps1`:

```env
DEVICE_WALLET_PRIVATE_KEY=...
DEVICE_WALLET_ADDRESS=...
GROQ_API_KEY=...
```

`cdr/.env` and `db/.env` are **not** used for contributor signing. RPC URLs may still be read from `cdr/.env` for Story.

## Legacy HTTP servers (optional, deprecated)

`npm run server` in `cdr/` and `db/` is no longer part of the default runbook. Use the CLI local pipeline instead.

## Purchase

Buyers use `cdr` purchase CLI; listings are discovered via the frontend **Purchase** tab (Supabase catalog public queries).
