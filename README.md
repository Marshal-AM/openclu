# OpenClu

**Record your expertise and monetize instantly as training data or agent skills — protected by [Story CDR](https://docs.story.foundation/developers/cdr-sdk) (Confidential Data Rails).**

[View CDR Integrations](#story-cdr-integration-map) · [View Track Integrations](#openclu--privacy--depin)

<p align="center">
<img width="200" height="200" alt="ChatGPT_Image_May_23__2026__02_30_41_PM-removebg-preview" src="https://github.com/user-attachments/assets/bf504203-4223-4d3a-8f63-cac887497751" />
</p>

OpenClu is a full-stack system for capturing real human activity on contributor-owned hardware, converting that activity into structured **ML training data** or **agent skills**, encrypting it with **Story CDR**, registering it as on-chain IP on **Story Protocol**, and licensing it to model trainers and AI agents. Contributors earn royalties when their data is used; buyers only receive plaintext after paying for a license and passing CDR's decrypt gate.

### Overview

OpenClu records voice, video, and activity data from a **Clu device** (currently a Raspberry Pi; target: dedicated wearable hardware), processes it locally into either a **training data bundle** (`TRAINING.md` + encoded video) or an **agent skill** (`SKILL.md` + context), encrypts the bundle on-device, and attaches **Story license terms** so decryption is impossible without payment.

| Layer | Role in OpenClu |
|-------|-----------------|
| **Story CDR** | Confidential Data Rails — encrypts training bundles and skill bundles on-device before publication. Decryption requires a valid Story license token; raw audio and video are never stored in plaintext on IPFS. |
| **Story Protocol** | Registers each bundle as on-chain IP on Aeneid testnet. License mints gate CDR vault access and route royalty payments to the contributor's device wallet. |

OpenClu is built as a deliberate hybrid of **DePIN** and **Privacy**.

**DePIN** — every contribution is grounded in physical, wallet-attributed hardware. Data originates from a real Clu device, signed by a device wallet key derived locally from the machine that never leaves it. Contributions cannot be injected or spoofed without the device key; the hardware *is* the provenance. Device wallets own the on-chain IP and receive royalty payments directly — no platform intermediary in the money path.

**Privacy** — raw audio and video are encrypted on-device before a single byte leaves the machine. Story CDR encrypts the bundle using WASM crypto with threshold key splitting, so no single party holds the decryption key. The ciphertext is pinned to IPFS publicly, but is gibberish without a valid license token. Access is gated, auditable, and revocable entirely on-chain — OpenClu and Pinata never see plaintext content.

---

## Important links

| Resource | URL |
|----------|-----|
| **Local setup (install + full flow)** | [SETUP.md](SETUP.md) |
| **Demo video** | [View Here](https://www.youtube.com/watch?v=WoEApEqow6I) |
| **Pitch deck** | [View Here](https://canva.link/4fjs5vqdg96xl1n) |
| **Live app (dashboard)** | [https://openclu-dashboard.vercel.app/login](https://openclu-dashboard.vercel.app/login) |
| **Live app (Landing page)** | [https://openclu.vercel.app](https://openclu.vercel.app) |
| **Story CDR SDK docs** | [docs.story.foundation/developers/cdr-sdk](https://docs.story.foundation/developers/cdr-sdk) |

---

## Table of contents

1. [Introduction](#introduction)
2. [Example: sitting and standing training data end-to-end](#example-sitting-and-standing-training-data-end-to-end)
3. [How it works](#how-it-works)
   - [Phase 1 — Device registration](#phase-1--device-registration)
   - [Phase 2 — Contribution](#phase-2--contribution)
     - [2.1 Training data contribution (video → TRAINING.md)](#21-training-data-contribution-camera--voice--ml-dataset)
     - [2.2 Skill contribution (screen + voice → SKILL.md)](#22-skill-contribution-screen--voice--agent-skill)
   - [Phase 3 — Buying, decrypting, and using training data & skills](#phase-3--buying-decrypting-and-using-training-data--skills)
4. [Story CDR integration map](#story-cdr-integration-map)
5. [Our vision](#our-vision)
6. [What we are currently working on](#what-we-are-currently-working-on)
7. [Conclusion](#conclusion)
8. [Setup & runbook](SETUP.md)

---

## Introduction

<!-- Replace with hardware photo when available -->
<p align="center">
<img width="660" height="586" alt="WhatsApp Image 2026-05-25 at 15 47 06" src="https://github.com/user-attachments/assets/6df0e7fd-65df-4ecf-9d3f-27f1d4f78dbf" />
</p>

OpenClu sits at the intersection of **physical activity capture** and **privacy-preserving encryption**.

A contributor wears or places a **Clu device** (today: a Raspberry Pi running the capture stack; tomorrow: a dedicated wearable) that records voice, video, screen, and spatial activity. That raw signal **never leaves the device unencrypted**.

On the contributor machine, a local pipeline:

1. **Captures** voice and video (or screen + voice for skills) — plaintext stays on disk until you publish.
2. **Structures** the output as either:
   - **Training data** — a `TRAINING.md` manifest plus encoded video (`video.b64`); or
   - **Agent skill** — a `SKILL.md` knowledge artifact plus transcript/annotations (Groq extraction on the skill path only).
3. **Registers IP** on **Story Protocol (Aeneid testnet)** — mints an IP asset and commercial license terms so royalties flow to the contributor's device wallet.
4. **Encrypts** the bundle with **Story [CDR](https://docs.story.foundation/developers/cdr-sdk)** — local AES encryption, then TDH2 threshold encryption of the key. A CDR vault is created with a **read condition** tied to the Story license token. Without that token, the bundle cannot be decrypted — not by OpenClu, not by Story validators alone, not by anyone who intercepts the ciphertext.

Buyers (model trainers via ClawSync **Train your AI**, standalone CLI, or custom pipelines; agent operators via ClawSync SyncBoard) browse the marketplace, purchase a Story license token, and run CDR decrypt locally. Only then do they receive plaintext video for model training or a `SKILL.md` for agent import.

**Why this matters:** Most ML datasets are scraped, unlabeled, and unattributed. OpenClu captures **real human activity** — sitting and standing transitions, craft motions, clinical gestures — with explicit consent and license-gated access. A model trainer licensing `sitting-standing-example` gets synchronized camera + audio footage they can frame-sample and label for activity recognition. Separately, a senior engineer's captured review sessions encode *how they actually review*. OpenClu turns both kinds of tacit knowledge into **licensable, privacy-protected assets**.

**Economics:** Story Protocol enforces license fees and royalty splits on-chain. CDR gates decryption behind a valid license token — payment and privacy are the same mechanism.

---

## Example: sitting and standing training data end-to-end

**Scenario:** Sam wants to publish egocentric video of a person **sitting down and standing up** so a model trainer can fine-tune an activity classifier. Sam registers a Clu device, records a short camera session, and publishes a bundle called `sitting-standing-example`.

### Contributor side

| Step | What happens | Stack |
|------|----------------|-------|
| 1 | Sam runs `register.sh` → device wallet derived, QR links to dashboard | [skill-capture/register.sh](skill-capture/register.sh), [skill-capture/scripts/register-wallet.mjs](skill-capture/scripts/register-wallet.mjs) |
| 2 | Sam confirms registration in browser; device linked to owner wallet | [frontend/src/app/api/devices/register/route.ts](frontend/src/app/api/devices/register/route.ts) |
| 3 | Sam enters title, description, and tags (`sitting`, `standing`) in the Contribute UI | Dashboard training-data form |
| 4 | Sam starts recording → `video_capture.py` records camera + mic until `q` | [skill-capture/video_capture.py](skill-capture/video_capture.py) |
| 5 | Raw WebM is base64-encoded as `video.b64`; `TRAINING.md` manifest written with `content_kind: trainingData` | Example bundle: [clawsync/data/purchased-training-data/sitting-standing-example-xfy61/TRAINING.md](clawsync/data/purchased-training-data/sitting-standing-example-xfy61/TRAINING.md) |
| 6 | Distribute job runs → Story IP mint + **CDR encrypt** | [skill-capture/cli/src/distribute-training.ts](skill-capture/cli/src/distribute-training.ts) → [encryptBundleToVault()](skill-capture/cdr/src/services/publish-service.ts) |

**What gets captured:** synchronized **camera video + microphone audio** of a human performing sit/stand transitions. Unlike the skill path, **no Groq processing** runs — the video is preserved as-is so frame-level labels and motion signal stay intact for training.

**Privacy on publish:** the device wallet registers Story IP, then CDR encrypts the zip bundle on-device. The vault's read condition requires a Story license token for Sam's `ipId`. Raw video never appears in plaintext outside Sam's Pi until a licensed buyer decrypts.

### Buyer side (model trainer wants activity footage)

| Step | What happens | Stack |
|------|----------------|-------|
| 1 | Trainer finds `sitting-standing-example` in the marketplace (dashboard or ClawSync **Train your AI**) | Dashboard / [clawsync/convex/trainingDataCatalogActions.ts](clawsync/convex/trainingDataCatalogActions.ts) |
| 2 | Trainer reads listing metadata — title, tags, mint fee, Story `ipId`, CDR `vaultUuid` | Catalog detail APIs |
| 3 | Buyer wallet mints Story license token | `storyClient.license.mintLicenseTokens()` via [purchase-from-listing.ts](clawsync/skill-marketplace/src/cdr/purchase-from-listing.ts) |
| 4 | CDR decrypts bundle using license token as read condition | [decrypt-with-logs.ts](clawsync/skill-marketplace/src/cdr/decrypt-with-logs.ts) |
| 5 | Decrypted `video.b64` saved locally; trainer loads it in **Train your AI** | [clawsync/convex/trainingDataPurchaseActions.ts](clawsync/convex/trainingDataPurchaseActions.ts) → [clawsync/local-trainer/](clawsync/local-trainer/) |

**How the data trains a model:**

1. **Purchase + decrypt** — the trainer receives `TRAINING.md`, `video.b64`, and a `purchase-receipt.json` audit trail under `clawsync/data/purchased-training-data/sitting-standing-example-xfy61/`.
2. **Frame extraction** — the local trainer decodes the WebM and samples frames (e.g. 1 fps). Labels like `sitting,standing` split frames across classes.
3. **Fine-tune** — a small vision model (CLIP, ViT, or MobileViT) trains on those labeled frames via PyTorch on the trainer's machine. Weights never leave local disk.
4. **Inference** — the fine-tuned classifier can distinguish sitting vs standing in new camera footage.

**Story transactions (buyer wallet signs):** deposit WIP → approve royalty module → `mintLicenseTokens` for Sam's `ipId`. Royalty flows to Sam's device wallet per on-chain license terms.

**Result:** The trainer holds licensed activity video and a model trained on it. Sam earns per license. Raw video stayed encrypted until the trainer paid and CDR authorized decrypt.

---

### Secondary example: code review skill for agents

OpenClu also supports a **skill path** for agent operators who want procedural knowledge rather than raw video. Alex, a staff engineer, records a 45-minute PR review (screen + voice) and publishes `alex-code-review`.

| Phase | Training data path (primary) | Skill path (secondary) |
|-------|------------------------------|------------------------|
| Capture | Camera + mic → `video.b64` | Screen + mic → frames + transcript |
| Processing | None (preserve raw video) | Groq Whisper + vision + LLM → `SKILL.md` |
| CDR encrypt | Same vault + license gate | Same vault + license gate |
| Buyer use | Fine-tune vision model on frames | Import `SKILL.md` into ClawSync agent context |

After the same Story license + CDR decrypt flow, Alex's buyer extracts `SKILL.md`, `transcript.json`, and frame annotations. ClawSync imports the skill via [`skillPurchaseImport.ts`](clawsync/convex/skillPurchaseImport.ts). See [Phase 2.2](#22-skill-contribution-screen--voice--agent-skill) and [Phase 3](#phase-3--buying-decrypting-and-using-training-data--skills).

---

### Story CDR — the encryption layer

| Property | How OpenClu delivers |
|----------|------------------------|
| **Encrypt before share** | Bundles are zipped and encrypted on the contributor Pi via [`encryptBundleToVault()`](skill-capture/cdr/src/services/publish-service.ts) using `@piplabs/cdr-sdk` WASM crypto — before any buyer interaction. |
| **License-gated decrypt** | CDR vault **read condition** requires a valid Story license token for the skill's `ipId` ([`LICENSE_READ_CONDITION`](skill-capture/cdr/src/constants.ts) + [`LICENSE_TOKEN`](skill-capture/cdr/src/constants.ts)). No token → no decrypt. |
| **Contributor-only write** | CDR vault **write condition** is the contributor's device wallet ([`OWNER_WRITE_CONDITION`](skill-capture/cdr/src/constants.ts)). Only the device that captured the data can create or update the vault. |
| **Threshold decryption** | The AES key is protected by TDH2 threshold encryption. Story CDR validators must cooperate to release partial decryptions; the buyer's client combines them locally ([`decrypt-with-logs.ts`](skill-capture/cdr/src/decrypt-with-logs.ts)). |

### Why the combination is novel

Most "AI marketplaces" centralize data in a vendor DB. Most "privacy" projects never ship a usable consumer loop. Most "DePIN" projects summarize telemetry to a dashboard and stop.

OpenClu connects DePIN and Privacy in one loop:

```
Device (DePIN) → CDR encrypt (Privacy) → catalog (Supabase) → model training / agent skill → royalty (Story)
```

The same device wallet signs **capture attribution** and **IP ownership**; the same license token gates **decryption** and **pays the contributor**.

**The privacy loop in detail:**

```
Device capture (plaintext local only)
  → Story IP registration (license terms on-chain)
  → CDR encrypt (AES + threshold key → vault)
  → Buyer pays Story (license token minted)
  → CDR threshold decrypt (validators + license check)
  → Plaintext on buyer's machine only
```


## How it works

<img width="1498" height="517" alt="Screenshot 2026-05-25 at 5 10 17 PM" src="https://github.com/user-attachments/assets/e05b53f2-6e87-48a4-a387-2961eb9f6638" />

### Architecture overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CONTRIBUTOR MACHINE (Clu / Pi)                       │
│  register.sh → orchestrator:8790 (+ ngrok) → capture.py / video_capture.py  │
│  → process.py (Groq, skill path) → cli/distribute.ts → Story IP + CDR       │
│  Signs with: DEVICE_WALLET_PRIVATE_KEY                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                    │ device registration            │ proxy /api/orch/*
                    ▼                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     FRONTEND (Next.js dashboard)                            │
│  Privy owner wallet │ marketplace browse │ job proxy to contributor Pi      │
└─────────────────────────────────────────────────────────────────────────────┘
                    │ marketplace-cli (subprocess)
                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     CLAWSYNC (agent platform + SyncBoard)                   │
│  Convex actions → purchase via Story + CDR decrypt                          │
│  Signs with: AGENT_PRIVATE_KEY (buyer)                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Tech stack by path:**

| Path | Stack |
|------|-------|
| [skill-capture/](skill-capture/) | Python 3.10+, Node 22+, Groq, PyAudio, mss, OpenCV |
| [skill-capture/cdr/](skill-capture/cdr/) | `@piplabs/cdr-sdk`, `@story-protocol/core-sdk`, viem |
| [skill-capture/orchestrator/](skill-capture/orchestrator/) | Express, tsx, ngrok (pyngrok) |
| [frontend/](frontend/) | Next.js 15, React 19, Privy, Tailwind 4 |
| [clawsync/](clawsync/) | React, Vite, Convex, `@convex-dev/agent` |
| [clawsync/skill-marketplace/](clawsync/skill-marketplace/) | Vendored CDR purchase + decrypt CLI |
| [landing/](landing/) | Next.js marketing site |

**End-to-end in one pass:** you record on your device → the device builds a bundle → Story registers it as on-chain IP → **CDR encrypts the bundle on-device** → a buyer pays Story for a license token → **CDR validators authorize threshold decrypt** → the buyer gets plaintext locally for model training or agent import.

---

### Phase 1 — Device registration

<img width="1140" height="525" alt="Screenshot 2026-05-25 at 4 17 36 PM" src="https://github.com/user-attachments/assets/a50384a0-5b24-4fed-bb64-df77ec7dc059" />

Before any recording, the contributor machine must be linked to a human account. Three things get bound together:

1. **Your login wallet (Privy)** — the wallet you connect in the browser. This is the *owner*: you see the dashboard, manage devices, and receive royalties.
2. **A device wallet (generated on the Pi)** — a separate crypto key derived locally from the machine ID. This wallet *signs* Story IP registration and CDR encryption. It never leaves the device as a private key in normal operation.
3. **An orchestrator URL (ngrok tunnel)** — the hosted dashboard lives on the internet; your Pi runs capture locally. ngrok exposes `http://127.0.0.1:8790` as a public HTTPS URL so the dashboard can start jobs on your machine.

**What happens step by step:**

1. You run [`skill-capture/register.sh`](skill-capture/register.sh) on the Pi. It derives the device wallet, waits for the local orchestrator to start, and writes keys plus a one-time registration token into `skill-capture/.env`.
2. The script calls the dashboard API (`POST /api/devices/pending`) with device metadata and the ngrok URL.
3. You scan a QR code or open a link in the browser, connect Privy, and confirm. The dashboard links *your* owner wallet to *the device's* wallet and orchestrator URL.
4. From then on, when you click "Record" in the dashboard, requests go through [`frontend/src/app/api/orch/[...path]/route.ts`](frontend/src/app/api/orch/[...path]/route.ts), which forwards jobs to the orchestrator on your Pi.

Nothing is encrypted in this phase — it is identity and routing setup only.

---

### Phase 2 — Contribution

<img width="872" height="483" alt="Screenshot 2026-05-25 at 5 21 07 PM" src="https://github.com/user-attachments/assets/6decee67-c0fa-4a7b-98d5-43759ba50418" />

This is the core loop: **capture → (optional process) → Story IP → CDR encrypt → publish listing**.

OpenClu supports two contribution paths. **Training data** (camera + voice → raw video bundle) is the primary path. **Agent skills** (screen + voice → structured `SKILL.md`) are secondary. Both share the same **Story IP registration and CDR encryption** after capture.

---

#### 2.1 Training data contribution (camera + voice → ML dataset)

Example: record a person **sitting and standing** so a model trainer can license the footage and fine-tune an activity classifier.

##### A. Draft metadata (before recording)

In the dashboard Contribute UI you enter a title, description, and tags (e.g. `sitting`, `standing`, `human-activity`). The orchestrator writes a [`TRAINING.md`](skill-capture/training-data/) manifest on the Pi with YAML frontmatter including `content_kind: trainingData`, triggers, and `recorded_at`.

##### B. Capture — what the device records

When you start a training capture job, the orchestrator runs [`video_capture.py`](skill-capture/video_capture.py) on the Pi:

1. **Camera** — OpenCV grabs egocentric or scene video at ~10 fps.
2. **Microphone** — PyAudio records voice and ambient audio at 44.1 kHz mono, muxed with video.
3. **Stop** — press `q` in the terminal or stop from the dashboard. The pipeline muxes frames + audio into **WebM**, then base64-encodes the result as `video.b64`.

Everything at this stage is **plaintext on your local disk only**, under `skill-capture/training-data/raw/<slug>/<timestamp>/`.

**Nothing has left your machine yet.** No encryption, no publication.

##### C. Bundle assembly — no cloud processing

Unlike the skill path, **no Groq step runs**. Video is kept as-is so trainers retain full frame timing, motion blur, and audio sync.

The finished **training bundle** lands in `skill-capture/training-data/<slug>/`:

| File | Contents |
|------|----------|
| `TRAINING.md` | Dataset manifest (title, tags, triggers, `content_kind: trainingData`) |
| `video.b64` | Base64-encoded WebM (camera + mic) |
| `video.meta.json` | Duration, mime type, byte size |

This bundle is still **plaintext locally**.

##### D. Register on-chain IP (Story Protocol)

When you publish, [`distribute-training.ts`](skill-capture/cli/src/distribute-training.ts) runs on the Pi using the **device wallet**, calling [`registerSkillIp()`](skill-capture/cdr/src/services/publish-service.ts):

1. IP metadata JSON (title, description, creator = device wallet) is prepared for Story.
2. An **SPG NFT** mints and an **IP Asset** registers on Aeneid with a **commercial remix license** — mint fee (default 1 IP) and royalty percentage to your device wallet.
3. You receive **`ipId`** and **`licenseTermsId`** — these become the license gate wired into the CDR vault read condition.

##### E. Encrypt with Story CDR

The training bundle directory is zipped ([`zip-bundle.ts`](skill-capture/cdr/src/zip-bundle.ts)). Then [`encryptBundleToVault()`](skill-capture/cdr/src/services/publish-service.ts) runs **on the Pi using WASM crypto**:

1. **Local AES encryption** — the zip bytes are encrypted with a fresh AES key. The result is ciphertext — meaningless without the key.
2. **Threshold encryption of the key** — the AES key and content pointer are encrypted using CDR's **TDH2 threshold scheme** against the network's DKG public key. No single party holds the full decryption key; Story validators must cooperate to release it.
3. **Access conditions are baked into the vault:**
   - **Write condition** — only your **device wallet** ([`OWNER_WRITE_CONDITION`](skill-capture/cdr/src/constants.ts)).
   - **Read condition** — only a wallet holding a valid **Story license token** for this `ipId` ([`LICENSE_READ_CONDITION`](skill-capture/cdr/src/constants.ts) checks against [`LICENSE_TOKEN`](skill-capture/cdr/src/constants.ts)).
4. A **CDR vault** is allocated on-chain with a **`vaultUuid`**. The encrypted key material lives in the vault.

In plain terms: **the video zip is locked; only a licensed buyer can open it.**

A local **`cdr-manifest.json`** is written recording `vaultUuid`, `ipId`, license terms, mint fee, and CDR condition addresses — everything a buyer needs to pay Story and request decrypt.

##### F. Listing published

The dashboard marketplace receives the listing metadata (title, tags, mint fee, `vaultUuid`, Story `ipId`). **The encrypted bundle and vault pointer are what buyers need; the raw video is not exposed.**

---

#### 2.2 Skill contribution (screen + voice → agent skill)

The skill path targets **agent operators** who want distilled procedural knowledge rather than raw video.

##### A. Draft metadata (before recording)

In the Contribute UI you enter title, description, and tags. The orchestrator writes an initial [`SKILL.md`](skill-capture/skills/) with YAML frontmatter — the skeleton Groq fills after recording.

##### B. Capture — screen + voice

[`capture.py`](skill-capture/capture.py) runs on the Pi:

1. **Microphone** — PyAudio, 44.1 kHz mono PCM.
2. **Screen** — screenshot every 5 seconds as JPEG frames.
3. **Stop** — `q` or dashboard quit.

Raw files land under `skill-capture/skills/raw/<slug>/<timestamp>/`. **Plaintext local only** until distribute.

##### C. Processing — Groq extraction

[`process.py`](skill-capture/process.py) sends data to **Groq** (`GROQ_API_KEY` required):

1. **Transcribe** — Whisper → `transcript.json`.
2. **Annotate frames** — Llama vision → `frame_annotations.json`.
3. **Extract skill** — Llama → prose body merged into `SKILL.md`.

Finished bundle in `skill-capture/skills/<slug>/`: `SKILL.md`, transcript, annotations. Groq is the one cloud exposure **before encryption**.

##### D–F. Story IP, CDR encrypt, listing publish

Identical to the training data path ([sections 2.1 D–F](#d-register-on-chain-ip-story-protocol)), except [`distribute.ts`](skill-capture/cli/src/distribute.ts) zips the skill bundle instead of training files.

---

### Phase 3 — Buying, decrypting, and using training data & skills

<img width="872" height="483" alt="Screenshot 2026-05-25 at 5 21 30 PM" src="https://github.com/user-attachments/assets/da530d89-ebd9-4f72-bd68-e92fbedce14a" />

Buyers never contact your Pi directly. Whether they want **licensed video for model training** or a **skill for an agent**, the purchase rail is the same: **pay Story → CDR decrypt**. What differs is what they do with the plaintext after decrypt.

##### A. Discovery (no payment yet)

1. The buyer browses the marketplace in the dashboard or ClawSync SyncBoard (**Train your AI** tab or skill marketplace).
2. Results show **public metadata only**: title, description, tags, mint fee.
3. Selecting a listing loads the **CDR purchase context** — `vaultUuid`, Story `ipId`, license terms, mint fee. Still no plaintext video or skill body.

##### B. Purchase (Story Protocol — on-chain payment)

The buyer's wallet executes three Story transactions via [`purchase-from-listing.ts`](clawsync/skill-marketplace/src/cdr/purchase-from-listing.ts) (skills) or the training-data equivalent:

1. **Deposit** — wrap IP tokens into WIP to pay the license fee.
2. **Approve** — allow Story's Royalty Module to spend the WIP.
3. **Mint license token** — `mintLicenseTokens` for the listing's `ipId` and `licenseTermsId`. The buyer receives a **license token ID** proving payment. Royalty flows to the contributor's **device wallet**.

Without this token, CDR rejects the decrypt request.

##### C. Decryption (Story CDR — threshold unlock)

With the license token, the buyer's machine runs CDR decrypt via [`decrypt-with-logs.ts`](clawsync/skill-marketplace/src/cdr/decrypt-with-logs.ts):

1. **Read request on-chain** — submit a CDR read request for `vaultUuid` with the license token ID encoded as `accessAuxData`. The **LICENSE_READ_CONDITION** contract verifies the buyer holds a valid token for this `ipId`.
2. **Validator threshold decrypt** — Story CDR validators return partial decryptions until the threshold is met. The client combines them to recover the **AES key**.
3. **Local AES decrypt** — the encrypted zip bytes are decrypted **entirely on the buyer's machine**. Plaintext never passes through OpenClu servers.

A **`purchase-receipt.json`** records license token ID, vault UUID, CDR read tx hash, and buyer address for audit.

##### D. Use training data — fine-tune a model (primary path)

After decrypting training data (e.g. `sitting-standing-example`):

1. **Extract bundle** — `TRAINING.md`, `video.b64` land under `clawsync/data/purchased-training-data/<slug>/` ([`trainingDataPurchaseActions.ts`](clawsync/convex/trainingDataPurchaseActions.ts)).
2. **Decode video** — `video.b64` decodes to WebM. The trainer previews it or loads it into [local-trainer](clawsync/local-trainer/).
3. **Frame sampling + labeling** — extract frames at a configurable rate; labels like `sitting,standing` split frames across classes.
4. **Fine-tune** — a small vision model trains on labeled frames via PyTorch. Weights stay local.
5. **Inference** — the fine-tuned classifier predicts activity classes on new footage.

**Why trainers buy instead of scrape:** the footage is **consent-aligned** and **license-gated via CDR**. The contributor earns royalties; the trainer gets provenance for compliance.

Custom pipelines can run [`purchase-skill.ts`](skill-capture/cdr/src/purchase-skill.ts) or the marketplace CLI directly.

##### E. Use a skill — equip an agent (secondary path)

After decrypting a skill (e.g. `alex-code-review`):

1. **Extract bundle** — `SKILL.md`, `transcript.json`, `frame_annotations.json`.
2. **Import into agent runtime** — [`skillPurchaseImport.ts`](clawsync/convex/skillPurchaseImport.ts) attaches the skill to an agent's context.
3. **Runtime behavior** — the agent follows the contributor's recorded heuristics when triggers match.

The standalone CLI ([`purchase-skill.ts`](skill-capture/cdr/src/purchase-skill.ts)) runs purchase + decrypt without ClawSync.

##### F. Contributor dashboard

Owners see published training data and skills per registered device ([`contributions-from-catalog.ts`](frontend/src/lib/contributions-from-catalog.ts)).

---

### What is public vs private (summary)

| Data | Who can see it |
|------|----------------|
| Training/skill title, tags, description, mint fee | Anyone (marketplace browse) |
| Story `ipId`, CDR `vaultUuid` | Anyone (needed to initiate purchase) |
| Encrypted bundle (ciphertext) | Interceptable in theory, but **useless without license + CDR decrypt** |
| AES key + decrypt authorization | Hidden in CDR vault until license token proves payment |
| Plaintext `video.b64`, `TRAINING.md`, `SKILL.md` | **License holder only**, after CDR decrypt on their machine |
| Raw capture during recording | **Contributor only**, on Pi local disk until publish |
| Groq processing (skill path only) | Groq during processing step only, **before encryption** |

---

## Story CDR integration map

Every path that touches encryption or decryption goes through `@piplabs/cdr-sdk`. Below is every integration point in the repo, grouped by role.

### Contributor device — encrypt on publish

| Step | File | Function / entry point |
|------|------|------------------------|
| Skill distribute pipeline | [skill-capture/cli/src/distribute.ts](skill-capture/cli/src/distribute.ts) | `distributeSkill()` — orchestrates Story IP + CDR encrypt |
| Training distribute pipeline | [skill-capture/cli/src/distribute-training.ts](skill-capture/cli/src/distribute-training.ts) | `distributeTraining()` — same for training bundles |
| Story IP registration | [skill-capture/cdr/src/services/publish-service.ts](skill-capture/cdr/src/services/publish-service.ts) | `registerSkillIp()` |
| CDR encrypt + vault create | [skill-capture/cdr/src/services/publish-service.ts](skill-capture/cdr/src/services/publish-service.ts) | `encryptBundleToVault()` |
| Bundle zip | [skill-capture/cdr/src/zip-bundle.ts](skill-capture/cdr/src/zip-bundle.ts) | `zipSkillBundle()`, `readBundleZip()` |
| CDR client + WASM init | [skill-capture/cdr/src/client.ts](skill-capture/cdr/src/client.ts) | `createClientsFromPrivateKey()`, `ensureWasm()` |
| Condition contract addresses | [skill-capture/cdr/src/constants.ts](skill-capture/cdr/src/constants.ts) | `OWNER_WRITE_CONDITION`, `LICENSE_READ_CONDITION`, `LICENSE_TOKEN` |
| Node WASM polyfill | [skill-capture/cdr/src/polyfill.ts](skill-capture/cdr/src/polyfill.ts) | Required before CDR SDK in Node |
| Distribute logging | [skill-capture/cli/src/distribute-log.ts](skill-capture/cli/src/distribute-log.ts) | `printCdrEncrypt()`, `printStoryPublish()` |
| Standalone publish CLI | [skill-capture/cdr/src/publish-skill.ts](skill-capture/cdr/src/publish-skill.ts) | Publish without full distribute wrapper |
| E2E publish smoke test | [skill-capture/cdr/src/e2e-full-flow.ts](skill-capture/cdr/src/e2e-full-flow.ts) | Full Story + CDR flow test |
| E2E training publish + purchase | [skill-capture/scripts/e2e-training-publish-purchase.ts](skill-capture/scripts/e2e-training-publish-purchase.ts) | Training data round-trip |

### Buyer — pay Story, CDR decrypt

| Step | File | Function / entry point |
|------|------|------------------------|
| Purchase + decrypt (skills) | [clawsync/skill-marketplace/src/cdr/purchase-from-listing.ts](clawsync/skill-marketplace/src/cdr/purchase-from-listing.ts) | `purchaseSkillFromListing()` |
| CDR threshold decrypt | [clawsync/skill-marketplace/src/cdr/decrypt-with-logs.ts](clawsync/skill-marketplace/src/cdr/decrypt-with-logs.ts) | `downloadFileWithLogs()` |
| Standalone purchase CLI (device) | [skill-capture/cdr/src/purchase-skill.ts](skill-capture/cdr/src/purchase-skill.ts) | Purchase without ClawSync |
| Standalone purchase CLI (marketplace) | [clawsync/skill-marketplace/src/cdr/purchase-skill.ts](clawsync/skill-marketplace/src/cdr/purchase-skill.ts) | Vendored copy for ClawSync |
| Marketplace CLI router | [clawsync/skill-marketplace/src/cli/marketplace-cli.ts](clawsync/skill-marketplace/src/cli/marketplace-cli.ts) | `purchase`, `purchase-training`, `query` |
| CDR client (marketplace copy) | [clawsync/skill-marketplace/src/cdr/client.ts](clawsync/skill-marketplace/src/cdr/client.ts) | `createClientsFromPrivateKey()` |
| Condition constants (marketplace copy) | [clawsync/skill-marketplace/src/cdr/constants.ts](clawsync/skill-marketplace/src/cdr/constants.ts) | Same addresses as device copy |
| Unzip decrypted bundle | [clawsync/skill-marketplace/src/cdr/zip-bundle.ts](clawsync/skill-marketplace/src/cdr/zip-bundle.ts) | `unzipToDir()` |
| Device-side decrypt (dev/CLI) | [skill-capture/cdr/src/decrypt-with-logs.ts](skill-capture/cdr/src/decrypt-with-logs.ts) | `downloadFileWithLogs()` |

### ClawSync Convex — UI purchase actions

| Step | File | Function / entry point |
|------|------|------------------------|
| Skill purchase action | [clawsync/convex/skillPurchaseActions.ts](clawsync/convex/skillPurchaseActions.ts) | `purchaseSkill` → marketplace CLI |
| Training data purchase action | [clawsync/convex/trainingDataPurchaseActions.ts](clawsync/convex/trainingDataPurchaseActions.ts) | `purchaseTrainingData` → marketplace CLI |
| Import skill into agent | [clawsync/convex/skillPurchaseImport.ts](clawsync/convex/skillPurchaseImport.ts) | `importPurchasedSkill` |
| Agent marketplace purchase tool | [clawsync/convex/agent/marketplaceTools.ts](clawsync/convex/agent/marketplaceTools.ts) | `purchase_and_attach_skill` |
| Catalog snapshot for purchase | [clawsync/convex/lib/resolvePurchaseCatalog.ts](clawsync/convex/lib/resolvePurchaseCatalog.ts) | Avoids double-fetch before CDR |
| Marketplace CLI spawn helper | [clawsync/convex/lib/marketplaceCli.ts](clawsync/convex/lib/marketplaceCli.ts) | `runMarketplaceCli()` |
| Catalog snapshot purchase test | [clawsync/scripts/test-catalog-snapshot-purchase.ts](clawsync/scripts/test-catalog-snapshot-purchase.ts) | Snapshot → CDR purchase |

### Frontend — CDR listing context for purchase UI

| Step | File | Function / entry point |
|------|------|------------------------|
| CDR listing payload parser | [frontend/src/lib/supabase/db/catalog/cdr-listing.ts](frontend/src/lib/supabase/db/catalog/cdr-listing.ts) | Maps catalog row → vault UUID, ipId, fees |
| Catalog detail API | [frontend/src/app/api/catalog/[skillName]/route.ts](frontend/src/app/api/catalog/[skillName]/route.ts) | Returns purchase context to UI |

### Reference

| Resource | Location |
|----------|----------|
| In-repo CDR architecture notes | [skill-capture/cdr/docs/cdr.md](skill-capture/cdr/docs/cdr.md) |
| Official Story CDR SDK docs | [docs.story.foundation/developers/cdr-sdk](https://docs.story.foundation/developers/cdr-sdk) |

---

## Our vision

Today, OpenClu runs on a **Raspberry Pi** with microphone, camera, and screen capture — proof that the full loop (capture → CDR encrypt → Story license → buyer decrypt → model training or agent import) works on commodity edge hardware.

**The Clu device** we are building is a dedicated, comfortably wearable recorder — not a phone app, not a browser extension. It captures **spatial and activity data** at the source: voice, ambient audio, egocentric video, IMU motion, and contextual signals. A proprietary on-device stack will:

- **Pre-process locally** before any bytes leave silicon (VAD, scene detection, PII redaction hints).
- **Build rich knowledge graphs** from sessions — entities, relationships, decision points, skill primitives.
- **Emit training-grade datasets** with synchronized multimodal streams, provenance metadata, and consent scopes.

The economics stay the same: **device wallet owns the IP**, Story enforces licenses, **CDR encrypts so content stays private until paid**. Contributors wear Clu during their workday; training datasets and skills accumulate as a portfolio of licensable assets.

This is production-realistic with focused R&D:

- Custom PCB + sensor fusion (12–18 month hardware cycle with existing ODM partners).
- On-device TEE for key material (aligns with CDR's validator-side threshold model).
- Graph extraction models fine-tuned per vertical (language, clinical, craft).

OpenClu aims to become the **default venue where professionals monetize tacit knowledge** — with Story CDR as the privacy rail and Story Protocol as the royalty rail.

---

## What we are currently working on

1. **Hardening the Pi → dashboard path** — reliable ngrok registration, orchestrator job recovery, and contribution UX polish on [the live dashboard](https://openclu-dashboard.vercel.app/login).
2. **Training data marketplace loop** — end-to-end purchase → CDR decrypt → `local-trainer` fine-tune demo.
3. **Knowledge graph v2 extraction** — moving beyond flat `SKILL.md` to structured graph payloads, with agent-side graph traversal in ClawSync.

---

## Conclusion

OpenClu treats **human activity as the scarcest input in AI** — scarcer than parameters, scarcer than compute. We built a system where that activity is captured on device-origin hardware, **encrypted with Story CDR before it is shared**, registered as on-chain IP on Story Protocol, and licensed to the agents and models that need it.

**Story CDR** is the privacy layer: local AES encryption, threshold-protected keys, license-gated vault read conditions, and client-side decrypt. Combined with Story Protocol royalties, OpenClu delivers a credible standard for **AI training data and skill contributors** — where the people who do the work own the work, their content stays private until someone pays, and they get paid when machines learn from them.
