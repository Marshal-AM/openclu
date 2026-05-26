# OpenClu

**Record your expertise and monetize instantly as training data or agent skills — powered by [Arkiv](https://arkiv.network).**

<p align="center">
<img width="200" height="200" alt="ChatGPT_Image_May_23__2026__02_30_41_PM-removebg-preview" src="https://github.com/user-attachments/assets/bf504203-4223-4d3a-8f63-cac887497751" />
</p>

OpenClu is a full-stack system for capturing real human activity on contributor-owned hardware, converting that activity into structured **ML training data** or **agent skills**, encrypting and registering it on-chain, and licensing it to model trainers and AI agents. Contributors earn royalties when their data is used; model trainers get consent-aligned, high-signal activity video instead of scraped noise; agents get practitioner-grade procedural knowledge.

### Overview

OpenClu records voice, video, and activity data from a **Clu device** (currently a Raspberry Pi; target: dedicated wearable hardware), processes it locally into either a **training data bundle** (`TRAINING.md` + encoded video) or an **agent skill** (`SKILL.md` + context), and publishes it to a public marketplace. Contributors retain ownership via a device wallet; buyers license content through Story Protocol and decrypt via CDR.

The system spans three integration layers:

| Layer | Role in OpenClu |
|-------|-----------------|
| **[Arkiv Network](https://arkiv.network)** | Decentralized catalog and registry. Stores searchable `skillListing` and `trainingDataListing` entities, device registration (`portalDevice`), and user profiles. Provides `$owner` / `$creator` attribution on Braga testnet. |
| **Story CDR** | Confidential Data Rails — encrypts training bundles and skill bundles on-device before publication. Decryption requires a valid Story license token; raw audio and video are never stored in plaintext on Arkiv or IPFS. |
| **Story Protocol** | Registers each listing as on-chain IP on Aeneid testnet. License mints gate CDR vault access and route royalty payments to the contributor's device wallet. |

OpenClu is built as a **hybrid of the Arkiv builder themes** ([see `docs/themes.md`](docs/themes.md)): **DePIN** (device-origin capture with wallet-attributed telemetry), **Privacy** (CDR-encrypted payloads with license-gated access), and **AI** (structured skills and training datasets consumable by agents and models). Arkiv serves as the shared index that connects device capture, encrypted storage, and agent discovery without a centralized database.

---

## Important links

| Resource | URL |
|----------|-----|
| **Local setup (install + full flow)** | [SETUP.md](SETUP.md) |
| **Demo video** | Coming soon |
| **Pitch deck** | [View Here](https://canva.link/4fjs5vqdg96xl1n) |
| **Live app (dashboard)** | [https://openclu-dashboard.vercel.app/login](https://openclu-dashboard.vercel.app/login) |
| **Live app (Landing page)** | [https://openclu.vercel.app](https://openclu.vercel.app) |

---

## Table of contents

1. [Introduction](#introduction)
2. [Example: sitting and standing training data end-to-end](#example-sitting-and-standing-training-data-end-to-end)
3. [OpenClu = AI + Privacy + DePIN](#openclu--ai--privacy--depin)
4. [How it works](#how-it-works)
   - [Phase 1 — Device registration](#phase-1--device-registration)
   - [Phase 2 — Contribution](#phase-2--contribution)
     - [2.1 Training data contribution (video → TRAINING.md)](#21-training-data-contribution-camera--voice--ml-dataset)
     - [2.2 Skill contribution (screen + voice → SKILL.md)](#22-skill-contribution-screen--voice--agent-skill)
   - [Phase 3 — Utility (model trainers & agents)](#phase-3--buying-decrypting-and-using-training-data--skills)
5. [How Arkiv powers OpenClu (feature matrix)](#how-arkiv-powers-openclu-feature-matrix)
6. [Our vision](#our-vision)
7. [What we are currently working on](#what-we-are-currently-working-on)
8. [Conclusion](#conclusion)
9. [Setup & runbook](SETUP.md)

---

## Introduction

<!-- Replace with hardware photo when available -->
<p align="center">
<img width="660" height="586" alt="WhatsApp Image 2026-05-25 at 15 47 06" src="https://github.com/user-attachments/assets/6df0e7fd-65df-4ecf-9d3f-27f1d4f78dbf" />
</p>

OpenClu sits at the intersection of **physical activity capture**, **privacy-preserving encryption**, and **on-chain data ownership**.

A contributor wears or places a **Clu device** (today: a Raspberry Pi running the capture stack; tomorrow: a dedicated wearable) that records voice, video, screen, and spatial activity. That raw signal never leaves the device unencrypted.

On the contributor machine, a local pipeline:

1. **Transcribes and understands** the recording (Groq: Whisper + vision + LLM extraction).
2. **Structures** the output as either:
   - **Training data** — a `TRAINING.md` manifest plus encoded video (`video.b64`), published as a `trainingDataListing` on Arkiv; or
   - **Agent skill** — a `SKILL.md` knowledge artifact plus transcript/annotations, published as a `skillListing` on Arkiv.
3. **Encrypts** the bundle with **Story [Confidential Data Rails (CDR)](https://docs.story.foundation/developers/cdr-sdk)** — threshold encryption keyed to Story license terms. Ciphertext is pinned to local Helia and public IPFS (Pinata).
4. **Registers IP** on **Story Protocol (Aeneid testnet)** — mints an IP asset and commercial license terms so royalties flow to the contributor's device wallet.
5. **Publishes catalog metadata** on **Arkiv Network (Braga testnet)** — searchable `skillListing` / `trainingDataListing` entities with tags, CIDs, vault UUIDs, and `$owner` attribution tied to the device wallet.

Buyers (model trainers via ClawSync **Train your AI**, standalone CLI, or custom pipelines; agent operators via ClawSync SyncBoard) discover listings on Arkiv, purchase a Story license token, decrypt via CDR, and either **fine-tune a vision model on licensed video** or **import a skill into an agent's runtime context**.

**Why this matters:** Most ML datasets are scraped, unlabeled, and unattributed. OpenClu captures **real human activity** — sitting and standing transitions, craft motions, clinical gestures — with explicit consent and on-chain provenance. A model trainer licensing `sitting-standing-example` gets synchronized camera + audio footage they can frame-sample and label for activity recognition, not a vague web clip. Separately, a senior engineer's captured review sessions encode *how they actually review* — what they skip, when they escalate, how they phrase feedback. OpenClu turns both kinds of tacit knowledge into **licensable, attributable assets**: contributors monetize expertise they already have; model trainers get high-signal training video; agent operators get skills grounded in real professional behavior.

**Economics:** Story Protocol enforces license fees and royalty splits on-chain. CDR gates decryption behind a valid license token. Arkiv provides tamper-proof discovery and `$creator` / `$owner` metadata so attribution cannot be spoofed.

---

## Example: sitting and standing training data end-to-end

**Scenario:** Sam wants to publish egocentric video of a person **sitting down and standing up** so a model trainer can fine-tune an activity classifier. Sam registers a Clu device, records a short camera session, and publishes a bundle called `sitting-standing-example`.

### Contributor side

| Step | What happens | Stack |
|------|----------------|-------|
| 1 | Sam runs `register.sh` → device wallet derived, QR links to dashboard | [skill-capture/register.sh](skill-capture/register.sh), [skill-capture/scripts/register-wallet.mjs](skill-capture/scripts/register-wallet.mjs) |
| 2 | Sam confirms registration in browser; `portalDevice` written to Arkiv | [frontend/src/app/api/devices/register/route.ts](frontend/src/app/api/devices/register/route.ts) |
| 3 | Sam enters title, description, and tags (`sitting`, `standing`) in the Contribute UI | Dashboard training-data form |
| 4 | Sam starts recording → `video_capture.py` records camera + mic until `q` | [skill-capture/video_capture.py](skill-capture/video_capture.py) |
| 5 | Raw WebM is base64-encoded as `video.b64`; `TRAINING.md` manifest written with `content_kind: trainingData` | Example bundle: [clawsync/data/purchased-training-data/sitting-standing-example-xfy61/TRAINING.md](clawsync/data/purchased-training-data/sitting-standing-example-xfy61/TRAINING.md) |
| 6 | Distribute job runs → Story IP mint + CDR encrypt + Arkiv publish as `trainingDataListing` | [skill-capture/cli/src/distribute-training.ts](skill-capture/cli/src/distribute-training.ts) |

**What gets captured:** synchronized **camera video + microphone audio** of a human performing sit/stand transitions. Unlike the skill path, **no Groq processing** runs — the video is preserved as-is so frame-level labels and motion signal stay intact for training.

**Story, CDR, and Arkiv** follow the same pipeline as skills (device wallet registers IP on Aeneid, CDR encrypts the zip bundle, ciphertext pins to Helia + Pinata, Arkiv stores a searchable `trainingDataListing` with vault UUID, CID, and Story `ipId`). Only the entity type and bundle contents differ (`TRAINING.md` + `video.b64` instead of `SKILL.md` + transcript).

### Buyer side (model trainer wants activity footage)

| Step | What happens | Stack |
|------|----------------|-------|
| 1 | Trainer searches Arkiv: `"sitting standing human activity"` | [skill-capture/arkiv/src/services/query-catalog.ts](skill-capture/arkiv/src/services/query-catalog.ts) → `searchTrainingNaturalLanguage()` |
| 2 | Selects `sitting-standing-example` → reads listing payload (CID, ipId, vault, fees) | `fetchTrainingCatalogDetail()` / ClawSync training catalog |
| 3 | Buyer wallet mints Story license token | `storyClient.license.mintLicenseTokens()` |
| 4 | CDR decrypts bundle using license token as read condition | [clawsync/skill-marketplace/src/cdr/purchase-from-listing.ts](clawsync/skill-marketplace/src/cdr/purchase-from-listing.ts) |
| 5 | Decrypted `video.b64` saved locally; trainer loads it in **Train your AI** | [clawsync/convex/trainingDataPurchaseActions.ts](clawsync/convex/trainingDataPurchaseActions.ts) → [clawsync/local-trainer/](clawsync/local-trainer/) |

**How the data trains a model:**

1. **Purchase + decrypt** — the trainer receives `TRAINING.md`, `video.b64`, and a `purchase-receipt.json` audit trail under `clawsync/data/purchased-training-data/sitting-standing-example-xfy61/`.
2. **Frame extraction** — the local trainer decodes the WebM and samples frames (e.g. 1 fps). Labels like `sitting,standing` split frames across classes.
3. **Fine-tune** — a small vision model (CLIP, ViT, or MobileViT) trains on those labeled frames via PyTorch on the trainer's machine. Weights never leave local disk.
4. **Inference** — the fine-tuned classifier can distinguish sitting vs standing in new camera footage — useful for ergonomics research, assistive robotics, or activity monitoring.

**Story transactions (buyer wallet signs):** deposit WIP → approve royalty module → `mintLicenseTokens` for Sam's `ipId`. Royalty flows to Sam's device wallet per on-chain license terms.

**Result:** The trainer holds licensed, attributable activity video and a model trained on it. Sam earns per license without exposing raw video publicly on Arkiv or IPFS.

---

### Secondary example: code review skill for agents

OpenClu also supports a **skill path** for agent operators who want procedural knowledge rather than raw video. Alex, a staff engineer, records a 45-minute PR review (screen + voice) and publishes `alex-code-review`.

| Phase | Training data path (primary) | Skill path (secondary) |
|-------|------------------------------|------------------------|
| Capture | Camera + mic → `video.b64` | Screen + mic → frames + transcript |
| Processing | None (preserve raw video) | Groq Whisper + vision + LLM → `SKILL.md` |
| Arkiv entity | `trainingDataListing` | `skillListing` |
| Buyer use | Fine-tune vision model on frames | Import `SKILL.md` into ClawSync agent context |

After the same Story license + CDR decrypt flow, Alex's buyer extracts `SKILL.md`, `transcript.json`, and frame annotations. ClawSync imports the skill via [`skillPurchaseImport.ts`](clawsync/convex/skillPurchaseImport.ts) — the agent's system prompt now encodes Alex's review heuristics (what to skip, when to escalate, how to phrase feedback). See [Phase 2.2](#22-skill-contribution-screen--voice--agent-skill) and [Phase 3](#phase-3--buying-decrypting-and-using-training-data--skills) for the full skill workflow.

---

## OpenClu = AI + Privacy + DePIN

OpenClu is a deliberate **hybrid of all three [Arkiv ETHNS Builder Challenge themes](./themes.md)**. We go deep on each — not a tag slapped on a CRUD app.

### AI — agents whose memory you actually own

| Requirement (themes.md) | How OpenClu delivers |
|-------------------------|----------------------|
| Memory on Arkiv, wallet-owned | Training data and skills are `trainingDataListing` / `skillListing` entities; `$owner` = contributor device wallet; `$creator` immutable |
| Portable across tools | Any client that reads Arkiv + Story + CDR can consume listings (frontend, ClawSync, MCP-style CLI) |
| Entity types | **Catalog:** `skillListing`, `trainingDataListing`, `skillTag`, `listingVersion`. **Portal:** `portalUser`, `portalDevice`, `deviceRegistrationPending` |
| Retrieval by tag / time | [skill-capture/arkiv/src/services/query-catalog.ts](skill-capture/arkiv/src/services/query-catalog.ts): `eq`, `and`, `gte`, `lte`, `desc` on typed attributes; NL search via `searchNaturalLanguage()` |
| Differentiated expiration | `listingExpiresIn()`, [skill-capture/arkiv/src/lib/portal-expiration.ts](skill-capture/arkiv/src/lib/portal-expiration.ts) — portal pending 24h TTL; listings extendable via `extendSkillListing()` |

**Components:** Groq extraction → structured `SKILL.md` / knowledge graph (roadmap); Arkiv payload stores triggers, tags, transcript refs; **local-trainer** fine-tunes vision models on purchased training video; ClawSync agents attach purchased skills as runtime memory.

### Privacy — confidential data on a public layer

| Requirement | How OpenClu delivers |
|-------------|----------------------|
| Encrypted payloads on public layer | Raw A/V never published; only CDR ciphertext CID on Arkiv |
| Access gated, revocable | Story license token required for CDR read condition; license terms on-chain |
| Auto-expiration | Arkiv `expiresIn` on entities; portal pending registration expires |
| Threat model honesty | Public metadata (title, tags, CID) is visible; content ciphertext is not |
| Audit trail | Arkiv `$creator` + Story tx hashes + `listingVersion` snapshots |

**Components:** **Story CDR** (`@piplabs/cdr-sdk`) WASM encrypt on device; threshold decrypt via Story validators; **Helia** local pin + **Pinata** public gateway for buyer fetch; Arkiv stores vault UUID + CID pointers only.

### DePIN — queryable device-origin data

| Requirement | How OpenClu delivers |
|-------------|----------------------|
| Device-attributed readings | `$creator` / `$owner` = device wallet; readings cannot be injected without device key |
| Real hardware path | Raspberry Pi + mic/camera today; wearable Clu device on roadmap |
| Time-scoped telemetry | `publishedAt`, `recordedAt` numeric attributes; contribution timeline in UI |
| Public query API | Arkiv Braga queries power marketplace browse, owner "mine" scope, stats |
| Operator sovereignty | Contributor holds device wallet; platform cannot republish without signature |

**Components:** Clu hardware / Pi runs orchestrator + capture; ngrok tunnels device API; **portalDevice** on Arkiv links device wallet → owner wallet → orchestrator URL; catalog queries filter by `ownedBy(deviceWallet)`.

### Why the combination is novel

Most "AI marketplaces" centralize data in a vendor DB. Most "privacy" projects never ship a usable consumer loop. Most "DePIN" projects summarize telemetry to a dashboard and stop.

OpenClu connects all three in one loop:

```
Device (DePIN) → encrypt (Privacy) → catalog (Arkiv) → model training / agent skill (AI) → royalty (Story)
```

The same Arkiv entity carries **public discovery metadata** and **private content pointers**; the same device wallet signs **capture attribution** and **IP ownership**; the same license token gates **decryption** and **pays the contributor**.

---

## How it works

<img width="1498" height="517" alt="Screenshot 2026-05-25 at 5 10 17 PM" src="https://github.com/user-attachments/assets/e05b53f2-6e87-48a4-a387-2961eb9f6638" />

### Architecture overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CONTRIBUTOR MACHINE (Clu / Pi)                       │
│  register.sh → orchestrator:8790 (+ ngrok) → capture.py / video_capture.py  │
│  → process.py (Groq) → cli/distribute.ts → Story IP + CDR + Helia + Arkiv   │
│  Signs with: DEVICE_WALLET_PRIVATE_KEY                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                    │ POST /api/devices/pending          │ proxy /api/orch/*
                    ▼                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     FRONTEND (Next.js dashboard)                            │
│  Privy owner wallet │ portal-db-cli → Arkiv portal entities                 │
│  catalog-query-cli → Arkiv catalog reads                                    │
│  Signs with: PORTAL_WALLET_PRIVATE_KEY (portal only)                        │
└─────────────────────────────────────────────────────────────────────────────┘
                    │ marketplace-cli (subprocess)
                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     CLAWSYNC (agent platform + SyncBoard)                   │
│  Convex actions → query / purchase training data & skills                   │
│  Signs with: AGENT_PRIVATE_KEY (buyer)                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Tech stack by path:**

| Path | Stack |
|------|-------|
| [skill-capture/](skill-capture/) | Python 3.10+, Node 22+, Groq, PyAudio, mss, OpenCV |
| [skill-capture/cdr/](skill-capture/cdr/) | `@piplabs/cdr-sdk`, `@story-protocol/core-sdk`, Helia 5, Pinata, viem |
| [skill-capture/arkiv/](skill-capture/arkiv/) | `@arkiv-network/sdk`, Braga chain, Zod |
| [skill-capture/orchestrator/](skill-capture/orchestrator/) | Express, tsx, ngrok (pyngrok) |
| [frontend/](frontend/) | Next.js 15, React 19, Privy, Tailwind 4 |
| [clawsync/](clawsync/) | React, Vite, Convex, `@convex-dev/agent` |
| [clawsync/skill-marketplace/](clawsync/skill-marketplace/) | Vendored CDR + Arkiv read/purchase CLI |
| [landing/](landing/) | Next.js marketing site |

**End-to-end in one pass:** you record activity on your device → the device builds a training bundle (or skill bundle) → Story registers it as on-chain IP → CDR encrypts the bundle and stores ciphertext on IPFS → Arkiv publishes a searchable listing with pointers (not plaintext) → a buyer finds the listing on Arkiv, pays Story for a license token → CDR validators authorize decrypt → the buyer gets licensed video for model training, or a plaintext skill for agent import.

---

### Phase 1 — Device registration

<img width="1140" height="525" alt="Screenshot 2026-05-25 at 4 17 36 PM" src="https://github.com/user-attachments/assets/a50384a0-5b24-4fed-bb64-df77ec7dc059" />

Before any recording, the contributor machine must be linked to a human account. Three things get bound together:

1. **Your login wallet (Privy)** — the wallet you connect in the browser. This is the *owner*: you see the dashboard, manage devices, and receive royalties.
2. **A device wallet (generated on the Pi)** — a separate crypto key derived locally from the machine ID. This wallet *signs* everything the device publishes: Story IP registration, CDR encryption, and Arkiv catalog ownership. It never leaves the device as a private key in normal operation.
3. **An orchestrator URL (ngrok tunnel)** — the hosted dashboard lives on the internet; your Pi runs the capture software locally. ngrok exposes `http://127.0.0.1:8790` as a public HTTPS URL so the dashboard can start jobs on your machine.

**What happens step by step:**

1. You run [`skill-capture/register.sh`](skill-capture/register.sh) on the Pi. It derives the device wallet, waits for the local orchestrator to start, and writes keys plus a one-time registration token into `skill-capture/.env`.
2. The script calls the dashboard API (`POST /api/devices/pending`). That creates a temporary **pending registration** row on **Arkiv** (project `openclu-portal-v1`) with the device wallet address, device name, and ngrok URL. Pending rows expire after ~24 hours.
3. You scan a QR code or open a link in the browser, connect Privy, and confirm. The dashboard checks that the pending row matches, then writes a permanent **`portalDevice`** entity on Arkiv linking *your* owner wallet to *the device's* wallet and orchestrator URL. The pending row is deleted.
4. Optionally you set a display name and avatar — stored as a **`portalUser`** entity on Arkiv.
5. From then on, when you click "Record" in the dashboard, requests go through [`frontend/src/app/api/orch/[...path]/route.ts`](frontend/src/app/api/orch/[...path]/route.ts), which looks up your device's ngrok URL from Arkiv and forwards the job to the orchestrator running on your Pi.

Nothing is encrypted in this phase — it is pure identity and routing setup.

---

### Phase 2 — Contribution

<img width="872" height="483" alt="Screenshot 2026-05-25 at 5 21 07 PM" src="https://github.com/user-attachments/assets/6decee67-c0fa-4a7b-98d5-43759ba50418" />

This is the core loop: **capture → (optional process) → encrypt → store pointers → publish catalog metadata**.

OpenClu supports two contribution paths. **Training data** (camera + voice → raw video bundle) is the primary path — it preserves full motion and audio signal for model fine-tuning. **Agent skills** (screen + voice → structured `SKILL.md`) are secondary — they distill a session into prose instructions for agents. Both share the same Story IP registration, CDR encryption, Helia/Pinata storage, and Arkiv publish machinery after capture.

---

#### 2.1 Training data contribution (camera + voice → ML dataset)

This is the main workflow. Example: record a person **sitting and standing** in front of the Clu camera so a model trainer can license the footage and fine-tune an activity classifier.

##### A. Draft metadata (before recording)

In the dashboard Contribute UI you enter a title, description, and tags (e.g. `sitting`, `standing`, `human-activity`). The orchestrator writes a [`TRAINING.md`](skill-capture/training-data/) manifest on the Pi with YAML frontmatter including `content_kind: trainingData`, triggers, and `recorded_at`.

##### B. Capture — what the device records

When you start a training capture job, the orchestrator runs [`video_capture.py`](skill-capture/video_capture.py) on the Pi:

1. **Camera** — OpenCV grabs egocentric or scene video at ~10 fps (platform-specific backends: AVFoundation on macOS, DShow on Windows).
2. **Microphone** — PyAudio records voice and ambient audio at 44.1 kHz mono, muxed with video.
3. **Stop** — press `q` in the terminal or stop from the dashboard. The pipeline muxes frames + audio into **WebM**, then base64-encodes the result as `video.b64`.

Everything at this stage is **plaintext on your local disk only**, under `skill-capture/training-data/raw/<slug>/<timestamp>/`:

- Raw WebM and intermediate frames
- `video.b64` — the encoded training payload

**Nothing has left your machine yet.** No encryption, no upload.

##### C. Bundle assembly — no cloud processing

Unlike the skill path, **no Groq step runs**. Video is kept as-is so trainers retain full frame timing, motion blur, and audio sync — critical for activity recognition, ergonomics studies, and robotics datasets.

The finished **training bundle** lands in `skill-capture/training-data/<slug>/`:

| File | Contents |
|------|----------|
| `TRAINING.md` | Dataset manifest (title, tags, triggers, `content_kind: trainingData`) |
| `video.b64` | Base64-encoded WebM (camera + mic) |
| `video.meta.json` | Duration, mime type, byte size |

This bundle is still **plaintext locally**. The only cloud touchpoint before encryption is optional metadata you typed in the dashboard.

##### D. Register on-chain IP (Story Protocol)

When you publish, [`distribute-training.ts`](skill-capture/cli/src/distribute-training.ts) runs on the Pi using the **device wallet**:

1. IP metadata JSON (title, description, creator = device wallet) uploads to **IPFS via local Helia**.
2. An **SPG NFT** mints and an **IP Asset** registers on Aeneid with a **commercial remix license** — mint fee (default 1 IP) and royalty percentage to your device wallet.
3. You receive **`ipId`** and **`licenseTermsId`** — the license gate for decryption later.

##### E. Package and encrypt (Story CDR)

The training bundle directory is zipped. **Story CDR** ([`@piplabs/cdr-sdk`](skill-capture/cdr/)) encrypts it **on the Pi using WASM crypto**:

1. **Local AES encryption** — zip bytes encrypted with a fresh AES key.
2. **Threshold encryption of the key** — TDH2 scheme against CDR validators; no single party holds the full key.
3. **Access conditions baked into the vault:**
   - **Write condition** — only your **device wallet** can create/update the vault.
   - **Read condition** — only a wallet holding a valid **Story license token** for this `ipId` can decrypt.
4. A **CDR vault** is allocated with a **`vaultUuid`**.

In plain terms: **the video zip is locked; only a licensed buyer can open it.**

##### F. Where the encrypted bytes are stored

1. **Local Helia on the Pi** — pins ciphertext; yields a **CID**.
2. **Public IPFS via Pinata** — same ciphertext re-pinned for global fetch. **Still encrypted** — the CID alone does not expose your video.

A **`cdr-manifest.json`** records `vaultUuid`, `cid`, `ipId`, license terms, mint fee, and gateway URL.

##### G. Publish catalog metadata (Arkiv)

[`publishTrainingCatalogToArkiv()`](skill-capture/arkiv/src/services/publish-training-catalog.ts) writes a **`trainingDataListing`** entity to **Arkiv** (Braga testnet), signed by the device wallet:

**What Arkiv stores (public, searchable):** title, description, tags, `contentKind: trainingData`, status, slug, version, **`purchase` block** (vault UUID, CID, `ipId`, fees), **`ops` block** (Helia peers, Story URLs, gateway).

**What Arkiv does *not* store:** raw video, plaintext `TRAINING.md` body, AES keys, or decrypted bundles.

Tag entities and version snapshots are written for search and history — same pattern as skills.

##### H. Lifecycle after publish

Update metadata, archive, extend TTL, or full re-publish — identical lifecycle to skill listings ([section 2.2 H](#h-lifecycle-after-publish-skill-path) mirrors this for skills).

---

#### 2.2 Skill contribution (screen + voice → agent skill)

The skill path targets **agent operators** who want distilled procedural knowledge rather than raw video. Example: a staff engineer records a PR review session; Groq extracts a `SKILL.md` the agent can follow at runtime.

##### A. Draft metadata (before recording)

In the Contribute UI you enter title, description, and tags. The orchestrator writes an initial [`SKILL.md`](skill-capture/skills/) with YAML frontmatter (name, description, triggers) — the skeleton Groq fills after recording.

##### B. Capture — screen + voice

[`capture.py`](skill-capture/capture.py) runs on the Pi:

1. **Microphone** — PyAudio, 44.1 kHz mono PCM.
2. **Screen** — `mss` screenshot every 5 seconds as JPEG frames.
3. **Stop** — `q` or dashboard quit.

Raw files land under `skill-capture/skills/raw/<slug>/<timestamp>/` (`audio.wav`, `frames/`, `frame_manifest.json`). **Plaintext local only** until distribute.

##### C. Processing — Groq extraction

[`process.py`](skill-capture/process.py) sends data to **Groq** (`GROQ_API_KEY` required):

1. **Transcribe** — Whisper → `transcript.json`.
2. **Annotate frames** — Llama vision → `frame_annotations.json`.
3. **Extract skill** — Llama → prose body merged into `SKILL.md`.

Finished bundle in `skill-capture/skills/<slug>/`: `SKILL.md`, transcript, annotations, optional `scripts/`. Groq is the one cloud exposure before encryption.

##### D–G. Story IP, CDR encrypt, IPFS storage, Arkiv publish

Identical to the training data path ([sections 2.1 D–G](#d-register-on-chain-ip-story-protocol)), except:

- [`distribute.ts`](skill-capture/cli/src/distribute.ts) zips the skill bundle instead of training files.
- [`publishCatalogToArkiv()`](skill-capture/arkiv/src/services/publish-catalog.ts) writes a **`skillListing`** entity (not `trainingDataListing`).

##### H. Lifecycle after publish (skill path)

- **Update metadata** — change title/tags; Arkiv re-indexed; same vault/CID reused.
- **Archive** — status `archived`; removed from browse.
- **Extend TTL** — Arkiv entity expiration extended.
- **Re-publish** — full distribute again (new Story IP, vault, version).

---

### Phase 3 — Buying, decrypting, and using training data & skills

<img width="872" height="483" alt="Screenshot 2026-05-25 at 5 21 30 PM" src="https://github.com/user-attachments/assets/da530d89-ebd9-4f72-bd68-e92fbedce14a" />

Buyers never contact your Pi directly. Whether they want **licensed video for model training** or a **skill for an agent**, the purchase rail is the same: read **Arkiv**, pay **Story**, decrypt via **CDR**. What differs is what they do with the plaintext after decrypt.

##### A. Discovery (Arkiv read — no payment yet)

1. The buyer searches Arkiv — by tags, filters, or natural language. Training queries use `searchTrainingNaturalLanguage()`; skill queries use `searchNaturalLanguage()` ([`query-catalog.ts`](skill-capture/arkiv/src/services/query-catalog.ts)). Available from the dashboard, ClawSync SyncBoard (**Train your AI** tab or skill marketplace), or CLI.
2. Results show **public metadata only**: title, description, tags, `contentKind` (training vs skill), mint fee, contributor device wallet.
3. Selecting a listing loads **`purchase` + `ops` blocks** — vault UUID, IPFS CID, Story `ipId`, gateway URL, Helia peer hints. Still no plaintext video or skill body.

##### B. Purchase (Story Protocol — on-chain payment)

The buyer's wallet executes three Story transactions ([`purchase-from-listing.ts`](clawsync/skill-marketplace/src/cdr/purchase-from-listing.ts) for skills; `purchase-training` for training data):

1. **Deposit** — wrap IP tokens into WIP to pay the license fee.
2. **Approve** — allow Story's Royalty Module to spend the WIP.
3. **Mint license token** — `mintLicenseTokens` for the listing's `ipId` and `licenseTermsId`. The buyer receives a **license token ID** proving payment. Royalty flows to the contributor's **device wallet**.

Without this token, CDR rejects the decrypt request.

##### C. Decryption (Story CDR — threshold unlock)

With the license token, the buyer's machine runs CDR decrypt ([`decrypt-with-logs.ts`](skill-capture/cdr/src/decrypt-with-logs.ts)):

1. **Read request on-chain** — CDR read request for `vaultUuid` with license token as `accessAuxData`; **LICENSE_READ_CONDITION** verifies payment.
2. **Validator threshold decrypt** — partial decryptions combine into the **AES key** and storage pointer.
3. **Download ciphertext** — encrypted zip fetched from **IPFS** (Pinata gateway and/or contributor Helia peer).
4. **Local AES decrypt** — zip bytes decrypted client-side. Plaintext never passes through Arkiv or a central server.

A **`purchase-receipt.json`** records license token ID, vault UUID, read tx hash, and buyer address for audit.

##### D. Use training data — fine-tune a model (primary path)

After decrypting a **`trainingDataListing`** (e.g. `sitting-standing-example`):

1. **Extract bundle** — `TRAINING.md`, `video.b64`, and metadata land under `clawsync/data/purchased-training-data/<slug>/` ([`trainingDataPurchaseActions.ts`](clawsync/convex/trainingDataPurchaseActions.ts)).
2. **Decode video** — `video.b64` decodes to WebM (camera + mic). The trainer previews it in SyncBoard or loads it into the local trainer.
3. **Frame sampling + labeling** — [local-trainer](clawsync/local-trainer/) extracts frames at a configurable rate (e.g. 1 fps). Labels like `sitting,standing` split frames across classes for supervised learning.
4. **Fine-tune** — a small vision model (CLIP, ViT, or MobileViT) trains on labeled frames via PyTorch on the trainer's CPU/GPU. Weights stay local under `local-trainer/output/runs/<job_id>/`.
5. **Inference** — the fine-tuned classifier predicts activity classes on new images or video — e.g. distinguish sitting vs standing for ergonomics, assistive robotics, or health monitoring.

**Why trainers buy instead of scrape:** the footage is **consent-aligned**, **wallet-attributed** on Arkiv, and **license-gated** via Story. The contributor earns royalties; the trainer gets provenance for compliance and model cards.

Custom pipelines can skip ClawSync entirely — run `purchase-training` from the marketplace CLI and feed decrypted video into any fine-tuning stack (PyTorch, Hugging Face, custom data loaders).

##### E. Use a skill — equip an agent (secondary path)

After decrypting a **`skillListing`** (e.g. `alex-code-review`):

1. **Extract bundle** — `SKILL.md`, `transcript.json`, `frame_annotations.json`, and optional scripts.
2. **Import into agent runtime** — in **ClawSync**, [`skillPurchaseImport.ts`](clawsync/convex/skillPurchaseImport.ts) attaches the skill to an agent's context. The agent's system prompt and tool instructions now encode the contributor's recorded heuristics.
3. **Runtime behavior** — when the agent faces a matching task (triggers like `code-review`, `typescript`), it follows the skill's procedural guidance: what to check first, when to escalate, how to phrase feedback — grounded in a real session, not generic LLM knowledge.
4. **Transcript + annotations as context** — the full speech transcript and screen annotations provide additional grounding the agent can reference during multi-step tasks.

The standalone CLI ([`purchase-skill.ts`](skill-capture/cdr/src/purchase-skill.ts)) runs purchase + decrypt without ClawSync — useful for importing skills into other agent frameworks that read `SKILL.md` files.

##### F. Contributor dashboard

Owners see published **training data and skills** by querying Arkiv per registered device wallet ([`contributions-from-arkiv.ts`](frontend/src/lib/contributions-from-arkiv.ts)). No centralized database — portal devices and catalog listings both live on Arkiv Braga.

---

### What is public vs private (summary)

| Data | Where it lives | Who can see it |
|------|----------------|----------------|
| Training/skill title, tags, description | Arkiv `trainingDataListing` / `skillListing` | Anyone (marketplace browse) |
| Vault UUID, IPFS CID, Story `ipId`, mint fee | Arkiv `purchase` block | Anyone |
| Encrypted training/skill zip | IPFS (Pinata + Helia) | Anyone can **download the blob**, but it is **encrypted gibberish** without a license |
| AES key + decrypt authorization | CDR vault on-chain | Hidden until license token proves payment |
| Plaintext `video.b64`, `TRAINING.md` | Trainer's disk **after** licensed decrypt | License holder only |
| Plaintext `SKILL.md`, transcript, screen frames | Agent operator's disk **after** licensed decrypt | License holder only |
| Raw capture during recording | Pi local disk (`training-data/raw/` or `skills/raw/`) | Contributor only, until distribute |
| Groq processing (skill path only) | Groq API (transcript + frames) | Groq during processing step only, before encryption |

---

## How Arkiv powers OpenClu (feature matrix)

OpenClu uses **two Arkiv project namespaces** (per [themes.md](./themes.md) `PROJECT_ATTRIBUTE` requirement):

| Project attribute value | Wallet | Entity types |
|-------------------------|--------|--------------|
| `skill-capture-ai-catalog-v1` | Device wallet | `skillListing`, `trainingDataListing`, `skillTag`, `listingVersion` |
| `openclu-portal-v1` | Portal wallet | `portalUser`, `portalDevice`, `deviceRegistrationPending` |

**Integration pattern:** Next.js and Convex spawn TSX CLI bridges; they do not embed `@arkiv-network/sdk` in the request hot path (`frontend/next.config.ts` externalizes the SDK).

### Catalog project (`skill-capture-ai-catalog-v1`)

| # | Feature | Arkiv capability | File | Key function / API |
|---|---------|------------------|------|-------------------|
| 1 | Project namespace isolation | `project` attribute on every entity/query | [skill-capture/arkiv/src/lib/constants.ts:1-4](skill-capture/arkiv/src/lib/constants.ts#L1-L4) | `PROJECT_ATTRIBUTE` |
| 2 | Skill listing entity type | `entityType: skillListing` | [skill-capture/arkiv/src/lib/constants.ts:6-7](skill-capture/arkiv/src/lib/constants.ts#L6-L7) | `ENTITY_TYPE.skillListing` |
| 3 | Training listing entity type | `entityType: trainingDataListing` | [skill-capture/arkiv/src/lib/constants.ts:8](skill-capture/arkiv/src/lib/constants.ts#L8) | `ENTITY_TYPE.trainingDataListing` |
| 4 | Search tag entity type | `entityType: skillTag` | [skill-capture/arkiv/src/lib/constants.ts:9](skill-capture/arkiv/src/lib/constants.ts#L9) | `ENTITY_TYPE.skillTag` |
| 5 | Version history entity type | `entityType: listingVersion` | [skill-capture/arkiv/src/lib/constants.ts:10](skill-capture/arkiv/src/lib/constants.ts#L10) | `ENTITY_TYPE.listingVersion` |
| 6 | Listing status index | string attr `status` | [skill-capture/arkiv/src/lib/constants.ts:13-17,25](skill-capture/arkiv/src/lib/constants.ts#L13-L25) | `ATTR.status`, `LISTING_STATUS` |
| 7 | Slug lookup | string attr `skillSlug` | [skill-capture/arkiv/src/lib/constants.ts:23](skill-capture/arkiv/src/lib/constants.ts#L23) | `ATTR.skillSlug` |
| 8 | Publish skill listing | `createEntity` / `updateEntity` | [skill-capture/arkiv/src/services/publish-catalog.ts:68+](skill-capture/arkiv/src/services/publish-catalog.ts#L68) | `publishCatalogToArkiv()` |
| 9 | Build listing payload | JSON payload + attributes | [skill-capture/arkiv/src/lib/build-listing.ts](skill-capture/arkiv/src/lib/build-listing.ts) | `buildListingPayload()` |
| 10 | Publish training listing | `createEntity` / `updateEntity` | [skill-capture/arkiv/src/services/publish-training-catalog.ts](skill-capture/arkiv/src/services/publish-training-catalog.ts) | `publishTrainingCatalogToArkiv()` |
| 11 | Training payload builder | `contentKind: trainingData` | [skill-capture/arkiv/src/lib/build-training-listing.ts](skill-capture/arkiv/src/lib/build-training-listing.ts) | `buildTrainingListingPayload()` |
| 12 | Tag entities on publish | `createEntity` (skillTag) | [skill-capture/arkiv/src/entities/tag.ts](skill-capture/arkiv/src/entities/tag.ts) | `buildTagCreate()` |
| 13 | Delete tags on re-publish | `mutateEntities` deletes | [skill-capture/arkiv/src/services/publish-catalog.ts:59-66](skill-capture/arkiv/src/services/publish-catalog.ts#L59-L66) | `deleteTagEntities()` |
| 14 | Version snapshot on publish | `createEntity` (listingVersion) | [skill-capture/arkiv/src/entities/version.ts](skill-capture/arkiv/src/entities/version.ts) | `buildVersionCreate()` |
| 15 | Next version number | numeric query | [skill-capture/arkiv/src/services/query-catalog.ts](skill-capture/arkiv/src/services/query-catalog.ts) | `getNextVersionNumber()` |
| 16 | Marketplace browse (published only) | `buildQuery` + filters | [skill-capture/arkiv/src/services/query-catalog.ts:41-49](skill-capture/arkiv/src/services/query-catalog.ts#L41-L49) | `normalizeListingFilters()`, `fetchListings()` |
| 17 | Owner "mine" scope | `.ownedBy(deviceWallet)` | [skill-capture/arkiv/src/services/query-catalog.ts:52-64](skill-capture/arkiv/src/services/query-catalog.ts#L52-L64) | `applyWalletScope()` |
| 18 | Creator attribution filter | `.createdBy(wallet)` | [skill-capture/arkiv/src/services/query-catalog.ts:56-57](skill-capture/arkiv/src/services/query-catalog.ts#L56-L57) | `applyWalletScope()` |
| 19 | Natural language search | Arkiv NL query | [skill-capture/arkiv/src/services/query-catalog.ts](skill-capture/arkiv/src/services/query-catalog.ts) | `searchNaturalLanguage()` |
| 20 | Training NL search | Arkiv NL query | [skill-capture/arkiv/src/services/query-catalog.ts](skill-capture/arkiv/src/services/query-catalog.ts) | `searchTrainingNaturalLanguage()` |
| 21 | Tag → listing lookup | join via tag entities | [skill-capture/arkiv/src/services/query-catalog.ts](skill-capture/arkiv/src/services/query-catalog.ts) | `listingKeysForTag()`, `fetchTagsForListing()` |
| 22 | Catalog stats | entity counts | [skill-capture/arkiv/src/services/query-catalog.ts](skill-capture/arkiv/src/services/query-catalog.ts) | `getCatalogStats()` |
| 23 | Listing detail for UI | fetch + parse payload | [skill-capture/arkiv/src/lib/catalog-detail.ts](skill-capture/arkiv/src/lib/catalog-detail.ts) | `fetchSkillCatalogDetail()` |
| 24 | Training listing detail | fetch + parse payload | [skill-capture/arkiv/src/lib/catalog-detail.ts](skill-capture/arkiv/src/lib/catalog-detail.ts) | `fetchTrainingCatalogDetail()` |
| 25 | CDR purchase context | map payload → vault/CID | [skill-capture/arkiv/src/lib/cdr-listing.ts](skill-capture/arkiv/src/lib/cdr-listing.ts) | `fetchSkillListingFromArkiv()` |
| 26 | Fetch by entity key | direct entity read | [skill-capture/arkiv/src/lib/cdr-listing.ts](skill-capture/arkiv/src/lib/cdr-listing.ts) | `fetchSkillListingByKey()` |
| 27 | Archive listing | `updateEntity` status + tag delete | [skill-capture/arkiv/src/services/archive-catalog.ts](skill-capture/arkiv/src/services/archive-catalog.ts) | `archiveSkillCatalog()` |
| 28 | Extend listing TTL | `extendEntity` | [skill-capture/arkiv/src/services/extend-catalog.ts](skill-capture/arkiv/src/services/extend-catalog.ts) | `extendSkillListing()` |
| 29 | Metadata-only re-index | update without re-encrypt | [skill-capture/arkiv/src/jobs/update-catalog.ts](skill-capture/arkiv/src/jobs/update-catalog.ts) | `indexSkillByName()` |
| 30 | CDR publish upsert | calls publish service | [skill-capture/cdr/src/arkiv-listing.ts](skill-capture/cdr/src/arkiv-listing.ts) | `upsertArkivCatalogListing()` |
| 31 | CDR re-index ops only | refresh ops/peer hints | [skill-capture/cdr/src/index-listing.ts](skill-capture/cdr/src/index-listing.ts) | `npm run index-arkiv` |
| 32 | Purchase CLI listing fetch | read before decrypt | [skill-capture/cdr/src/purchase-skill.ts:17+](skill-capture/cdr/src/purchase-skill.ts#L17) | `fetchSkillListingFromArkiv()` |
| 33 | Frontend catalog query API | subprocess bridge | [frontend/src/lib/catalog.ts:8+](frontend/src/lib/catalog.ts#L8) | `queryCatalog()` |
| 34 | Frontend catalog detail API | subprocess bridge | [frontend/src/app/api/catalog/[skillName]/route.ts](frontend/src/app/api/catalog/[skillName]/route.ts) | `getCatalogSkillDetail()` |
| 35 | Frontend catalog stats API | subprocess bridge | [frontend/src/app/api/catalog/stats/route.ts](frontend/src/app/api/catalog/stats/route.ts) | `getCatalogStats()` |
| 36 | Owner contributions merge | per-device mine queries | [frontend/src/lib/contributions-from-arkiv.ts:67-101](frontend/src/lib/contributions-from-arkiv.ts#L67-L101) | `listContributionsForOwner()` |
| 37 | Catalog read bridge | CLI stdin JSON | [skill-capture/arkiv/src/catalog-read-bridge.ts](skill-capture/arkiv/src/catalog-read-bridge.ts) | `catalogQuery()`, `catalogGetSkillDetail()` |
| 38 | Catalog query CLI | command router | [skill-capture/arkiv/src/cli/catalog-query-cli.ts](skill-capture/arkiv/src/cli/catalog-query-cli.ts) | `query`, `get`, `stats` |
| 39 | Device wallet Arkiv client | Braga wallet client | [skill-capture/arkiv/src/lib/client.ts](skill-capture/arkiv/src/lib/client.ts) | `createArkivWalletClient()` |
| 40 | Listing entity builder | create/update params | [skill-capture/arkiv/src/entities/listing.ts](skill-capture/arkiv/src/entities/listing.ts) | `buildListingCreate/Update()` |
| 41 | Training entity builder | create/update params | [skill-capture/arkiv/src/entities/training-listing.ts](skill-capture/arkiv/src/entities/training-listing.ts) | `buildTrainingListingCreate/Update()` |
| 42 | Listing expiration | `expiresIn` duration | [skill-capture/arkiv/src/lib/expiration.ts](skill-capture/arkiv/src/lib/expiration.ts) | `listingExpiresIn()` |
| 43 | Explorer links in logs | Braga explorer URLs | [skill-capture/arkiv/src/lib/explorer-links.ts](skill-capture/arkiv/src/lib/explorer-links.ts) | `arkivTxUrl()` |
| 44 | Orchestrator archive job | spawn arkiv job | [skill-capture/orchestrator/src/jobs.ts:277+](skill-capture/orchestrator/src/jobs.ts#L277) | `startArkivJob("archive-skill")` |
| 45 | Orchestrator update-catalog job | spawn arkiv job | [skill-capture/orchestrator/src/server.ts:182+](skill-capture/orchestrator/src/server.ts#L182) | `/api/v1/jobs/update-catalog` |
| 46 | CLI distribute in-process publish | direct import | [skill-capture/cli/src/distribute.ts:27+](skill-capture/cli/src/distribute.ts#L27) | `publishCatalogToArkiv()` |
| 47 | CLI distribute-training publish | direct import | [skill-capture/cli/src/distribute-training.ts](skill-capture/cli/src/distribute-training.ts) | `publishTrainingCatalogToArkiv()` |
| 48 | ClawSync marketplace query | vendored query-catalog | [clawsync/skill-marketplace/src/arkiv/](clawsync/skill-marketplace/src/arkiv/) | mirror of catalog module |
| 49 | ClawSync catalogActions | Convex → CLI | [clawsync/convex/catalogActions.ts:7+](clawsync/convex/catalogActions.ts#L7) | `runMarketplaceCli('query')` |
| 50 | ClawSync training catalog | Convex → CLI | [clawsync/convex/trainingDataCatalogActions.ts:7+](clawsync/convex/trainingDataCatalogActions.ts#L7) | `query-training` |
| 51 | ClawSync purchase w/ snapshot | avoid double fetch | [clawsync/convex/lib/resolvePurchaseCatalog.ts:46+](clawsync/convex/lib/resolvePurchaseCatalog.ts#L46) | `get-detail` fallback |
| 52 | Agent search tool | NL query in chat | [clawsync/convex/lib/marketplaceExecutions.ts:20+](clawsync/convex/lib/marketplaceExecutions.ts#L20) | `runMarketplaceCli('query')` |
| 53 | Agent purchase tool | purchase + attach | [clawsync/convex/agent/marketplaceTools.ts:15+](clawsync/convex/agent/marketplaceTools.ts#L15) | `purchase_and_attach_skill` |
| 54 | E2E verify script | smoke test | [test/verify-contributions-arkiv.mjs](test/verify-contributions-arkiv.mjs) | portal + catalog queries |
| 55 | Deprecated HTTP catalog server | legacy upsert | [skill-capture/arkiv/src/server.ts:1+](skill-capture/arkiv/src/server.ts#L1) | `/api/v1/catalog/upsert` |

### Portal project (`openclu-portal-v1`)

| # | Feature | Arkiv capability | File | Key function / API |
|---|---------|------------------|------|-------------------|
| 56 | Portal project namespace | `project` attribute | [skill-capture/arkiv/src/lib/portal-constants.ts:1-4](skill-capture/arkiv/src/lib/portal-constants.ts#L1-L4) | `PORTAL_PROJECT_ATTRIBUTE` |
| 57 | Pending registration entity | `deviceRegistrationPending` | [skill-capture/arkiv/src/lib/portal-constants.ts:9](skill-capture/arkiv/src/lib/portal-constants.ts#L9) | `PORTAL_ENTITY_TYPE.pendingRegistration` |
| 58 | Portal device entity | `portalDevice` | [skill-capture/arkiv/src/lib/portal-constants.ts:8](skill-capture/arkiv/src/lib/portal-constants.ts#L8) | `PORTAL_ENTITY_TYPE.device` |
| 59 | Portal user entity | `portalUser` | [skill-capture/arkiv/src/lib/portal-constants.ts:7](skill-capture/arkiv/src/lib/portal-constants.ts#L7) | `PORTAL_ENTITY_TYPE.user` |
| 60 | register.sh → pending | create pending entity | [frontend/src/app/api/devices/pending/route.ts](frontend/src/app/api/devices/pending/route.ts) | `upsertPendingRegistration()` |
| 61 | Browser register confirm | create device, delete pending | [frontend/src/app/api/devices/register/route.ts](frontend/src/app/api/devices/register/route.ts) | `upsertPortalDevice()`, `deletePendingRegistration()` |
| 62 | List owner devices | query by ownerWallet | [skill-capture/arkiv/src/services/query-portal.ts:54+](skill-capture/arkiv/src/services/query-portal.ts#L54) | `fetchPortalDevicesForOwner()` |
| 63 | Device by portal ID | query | [skill-capture/arkiv/src/services/query-portal.ts](skill-capture/arkiv/src/services/query-portal.ts) | `fetchPortalDeviceByPortalId()` |
| 64 | Device by device wallet | query | [skill-capture/arkiv/src/services/query-portal.ts](skill-capture/arkiv/src/services/query-portal.ts) | `fetchPortalDeviceByDeviceWallet()` |
| 65 | Pending by token | query | [skill-capture/arkiv/src/services/query-portal.ts](skill-capture/arkiv/src/services/query-portal.ts) | `fetchPendingRegistrationByToken()` |
| 66 | Pending by device wallet | query | [skill-capture/arkiv/src/services/query-portal.ts](skill-capture/arkiv/src/services/query-portal.ts) | `fetchPendingRegistrationByDeviceWallet()` |
| 67 | Upsert portal user profile | create/update | [skill-capture/arkiv/src/services/mutate-portal.ts:57+](skill-capture/arkiv/src/services/mutate-portal.ts#L57) | `upsertPortalUser()` |
| 68 | Upsert portal device | create/update | [skill-capture/arkiv/src/services/mutate-portal.ts](skill-capture/arkiv/src/services/mutate-portal.ts) | `upsertPortalDevice()` |
| 69 | Portal device → API row | serializer | [skill-capture/arkiv/src/services/mutate-portal.ts](skill-capture/arkiv/src/services/mutate-portal.ts) | `portalDeviceToApiRow()` |
| 70 | Portal pending → API row | serializer | [skill-capture/arkiv/src/services/mutate-portal.ts](skill-capture/arkiv/src/services/mutate-portal.ts) | `pendingToApiRow()` |
| 71 | Portal DB bridge | subprocess entry | [skill-capture/arkiv/src/portal-db-bridge.ts:1+](skill-capture/arkiv/src/portal-db-bridge.ts#L1) | 11 portal commands |
| 72 | Portal DB CLI | command router | [skill-capture/arkiv/src/cli/portal-db-cli.ts:31+](skill-capture/arkiv/src/cli/portal-db-cli.ts#L31) | stdin `SKILL_CAPTURE_PORTAL_JSON` |
| 73 | Frontend portal wrapper | spawn CLI | [frontend/src/lib/portal-db.ts:8+](frontend/src/lib/portal-db.ts#L8) | all portal functions |
| 74 | Orchestrator URL resolution | read device entity | [frontend/src/lib/session.ts](frontend/src/lib/session.ts) | `getPortalDeviceOrchestratorUrl()` |
| 75 | Orchestrator DB helper | list devices | [frontend/src/lib/orchestrator-db.ts:1+](frontend/src/lib/orchestrator-db.ts#L1) | `listDevicesForOwner()` |
| 76 | Profile GET/PUT API | portal user CRUD | [frontend/src/app/api/profile/route.ts](frontend/src/app/api/profile/route.ts) | `getPortalUserProfile()`, `upsertPortalUserProfile()` |
| 77 | Avatar upload API | portal user bytes | [frontend/src/app/api/profile/avatar/route.ts](frontend/src/app/api/profile/avatar/route.ts) | `upsertPortalUserAvatar()` |
| 78 | Portal wallet client | Braga signer | [skill-capture/arkiv/src/lib/portal-client.ts](skill-capture/arkiv/src/lib/portal-client.ts) | `createPortalWalletClient()` |
| 79 | Portal entity expiration | `expiresIn` on pending | [skill-capture/arkiv/src/lib/portal-expiration.ts](skill-capture/arkiv/src/lib/portal-expiration.ts) | TTL helpers |
| 80 | Portal entity builders | create/update params | [skill-capture/arkiv/src/entities/portal-device.ts](skill-capture/arkiv/src/entities/portal-device.ts) | `buildPortalDeviceCreate()`, etc. |
| 81 | Auth wallet route (no Arkiv) | intentional skip | [frontend/src/app/api/auth/wallet/route.ts:10](frontend/src/app/api/auth/wallet/route.ts#L10) | cookie only — no gas on login |
| 82 | `touchPortalLogin` (unused) | portal user touch | [frontend/src/lib/portal-db.ts](frontend/src/lib/portal-db.ts) | implemented, not wired to route |

**Arkiv is load-bearing:** Without Braga, OpenClu has no marketplace discovery, no owner-attributed device registry, no contribution dashboard, and no purchase metadata bridge to CDR/Story. The entire multi-user ngrok architecture assumes portal devices on Arkiv; the entire royalty loop assumes catalog listings on Arkiv point to CDR vaults and Story IP IDs.

---

## Our vision

Today, OpenClu runs on a **Raspberry Pi** with microphone, camera, and screen capture — proof that the full loop (capture → Groq → CDR → Story → Arkiv → agent purchase) works on commodity edge hardware.

**The Clu device** we are building is a dedicated, comfortably wearable recorder — not a phone app, not a browser extension. It captures **spatial and activity data** at the source: voice, ambient audio, egocentric video, IMU motion, and contextual signals (time, location class, session boundaries). A proprietary on-device stack will:

- **Pre-process locally** before any bytes leave silicon (VAD, scene detection, PII redaction hints).
- **Build rich knowledge graphs** from sessions — entities, relationships, decision points, skill primitives — rather than a single flat `SKILL.md` file. Agents traverse the graph at runtime.
- **Emit training-grade datasets** with synchronized multimodal streams, provenance metadata, and consent scopes — the kind of data ML teams currently cannot buy ethically at scale.

The economics stay the same: **device wallet owns the IP**, Story enforces licenses, CDR encrypts, Arkiv catalogs. Contributors wear Clu during their workday, week, or craft session; **training datasets and skills accumulate as a portfolio of licensable assets**. Model labs license video bundles with on-chain attribution; agent platforms plug into Arkiv for procedural skills.

This is production-realistic with focused R&D:

- Custom PCB + sensor fusion (12–18 month hardware cycle with existing ODM partners).
- On-device TEE for key material (aligns with CDR's validator-side threshold model).
- Graph extraction models fine-tuned per vertical (language, clinical, craft).
- Pinata/IPFS + Arkiv ops schema already supports multi-CID bundles and versioned listings.

OpenClu aims to become the **default venue where professionals monetize tacit knowledge** — the App Store for human skill, with Arkiv as the public index and Story as the royalty rail.

---

## What we are currently working on

1. **Hardening the Pi → dashboard path** — reliable ngrok registration, orchestrator job recovery, and contribution UX polish on [the live dashboard](https://openclu-dashboard.vercel.app/login).
2. **Training data marketplace loop** — end-to-end purchase → decrypt → `local-trainer` fine-tune demo for `trainingDataListing` entities on Arkiv.
3. **Knowledge graph v2 extraction** — moving beyond flat `SKILL.md` to structured graph payloads stored in Arkiv listing versions, with agent-side graph traversal in ClawSync.

---

## Conclusion

OpenClu treats **human activity as the scarcest input in AI** — scarcer than parameters, scarcer than compute. We built a system where that activity is captured on device-origin hardware, encrypted with Story CDR, indexed on Arkiv with wallet-owned attribution, and licensed to the agents and models that need it.

[Arkiv](https://arkiv.network) is not a storage afterthought in this architecture; it is the **discovery layer, portal registry, and tamper-proof catalog** that makes multi-device contributors, public marketplace browse, and owner dashboards possible without a centralized database. Combined with Story Protocol royalties and CDR confidentiality, OpenClu delivers a credible standard for **AI training data and skill contributors** — where the people who do the work own the work, and get paid when machines learn from them.
