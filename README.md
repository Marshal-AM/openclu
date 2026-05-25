# OpenClu

**Record your expertise and monetize instantly as skills or training data — powered by [Arkiv](https://arkiv.network).**

OpenClu is a full-stack system for capturing real human activity on contributor-owned hardware, converting that activity into structured **agent skills** or **ML training data**, encrypting and registering it on-chain, and licensing it to AI agents and model trainers. Contributors earn royalties when their data is used; agents get practitioner-grade knowledge instead of generic web scrape.

### Overview

OpenClu records voice, video, and activity data from a **Clu device** (currently a Raspberry Pi; target: dedicated wearable hardware), processes it locally into either an **agent skill** (`SKILL.md` + context) or a **training data bundle** (`TRAINING.md` + encoded video), and publishes it to a public marketplace. Contributors retain ownership via a device wallet; buyers license content through Story Protocol and decrypt via CDR.

The system spans three integration layers:

| Layer | Role in OpenClu |
|-------|-----------------|
| **[Arkiv Network](https://arkiv.network)** | Decentralized catalog and registry. Stores searchable `skillListing` and `trainingDataListing` entities, device registration (`portalDevice`), and user profiles. Provides `$owner` / `$creator` attribution on Braga testnet. |
| **Story CDR** | Confidential Data Rails — encrypts skill bundles on-device before publication. Decryption requires a valid Story license token; raw audio and video are never stored in plaintext on Arkiv or IPFS. |
| **Story Protocol** | Registers each skill as on-chain IP on Aeneid testnet. License mints gate CDR vault access and route royalty payments to the contributor's device wallet. |

OpenClu is built as a **hybrid of the Arkiv builder themes** ([see `docs/themes.md`](docs/themes.md)): **DePIN** (device-origin capture with wallet-attributed telemetry), **Privacy** (CDR-encrypted payloads with license-gated access), and **AI** (structured skills and training datasets consumable by agents and models). Arkiv serves as the shared index that connects device capture, encrypted storage, and agent discovery without a centralized database.

---

## Important links

| Resource | URL |
|----------|-----|
| **Demo video** | Coming soon |
| **Pitch deck** | Coming soon |
| **Live app (dashboard)** | [https://openclu-dashboard.vercel.app/login](https://openclu-dashboard.vercel.app/login) |
| **Live app (Landing page)** | [https://openclu.vercel.app/login](https://openclu.vercel.app/login) |

---

## Table of contents

1. [Introduction](#introduction)
2. [Example: code review skill end-to-end](#example-code-review-skill-end-to-end)
3. [OpenClu = AI + Privacy + DePIN](#openclu--ai--privacy--depin)
4. [How it works](#how-it-works)
   - [Phase 1 — Device registration](#phase-1--device-registration)
   - [Phase 2 — Contribution](#phase-2--contribution)
     - [2.1 Skill contribution (screen + voice → SKILL.md)](#21-skill-contribution-screen--voice--skillmd)
     - [2.2 Training data contribution (video → TRAINING.md)](#22-training-data-contribution-video--trainingmd)
   - [Phase 3 — Utility (agents & model trainers)](#phase-3--utility-agents--model-trainers)
5. [How Arkiv powers OpenClu (feature matrix)](#how-arkiv-powers-openclu-feature-matrix)
6. [Our vision](#our-vision)
7. [What we are currently working on](#what-we-are-currently-working-on)
8. [Conclusion](#conclusion)
9. [Setup & runbook](#setup--runbook)

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
   - **Agent skill** — a `SKILL.md` knowledge artifact plus transcript/annotations, published as a `skillListing` on Arkiv; or
   - **Training data** — a `TRAINING.md` manifest plus encoded video (`video.b64`), published as a `trainingDataListing` on Arkiv.
3. **Encrypts** the bundle with **Story [Confidential Data Rails (CDR)](https://docs.story.foundation/developers/cdr-sdk)** — threshold encryption keyed to Story license terms. Ciphertext is pinned to local Helia and public IPFS (Pinata).
4. **Registers IP** on **Story Protocol (Aeneid testnet)** — mints an IP asset and commercial license terms so royalties flow to the contributor's device wallet.
5. **Publishes catalog metadata** on **Arkiv Network (Braga testnet)** — searchable `skillListing` / `trainingDataListing` entities with tags, CIDs, vault UUIDs, and `$owner` attribution tied to the device wallet.

Buyers (AI agents via ClawSync, or standalone CLI) discover listings on Arkiv, purchase a Story license token, decrypt via CDR, and import the skill into an agent or feed video into a training pipeline.

**Why this matters:** Generic LLMs know *about* code review; a senior engineer's captured review sessions encode *how they actually review* — what they skip, when they escalate, how they phrase feedback. OpenClu turns that tacit knowledge into a **licensable, attributable asset**. Contributors monetize expertise they already have; agent operators get skills grounded in real professional behavior; model trainers get consent-aligned, high-signal activity data instead of scraped noise.

**Economics:** Story Protocol enforces license fees and royalty splits on-chain. CDR gates decryption behind a valid license token. Arkiv provides tamper-proof discovery and `$creator` / `$owner` metadata so attribution cannot be spoofed.

---

## Example: code review skill end-to-end

**Scenario:** Alex is a staff engineer who reviews PRs daily. They register a Clu device, record a 45-minute review session (screen + voice), and publish a skill called `alex-code-review`.

### Contributor side

| Step | What happens | Stack |
|------|----------------|-------|
| 1 | Alex runs `register.sh` → device wallet derived, QR links to dashboard | [skill-capture/register.sh](skill-capture/register.sh), [skill-capture/scripts/register-wallet.mjs](skill-capture/scripts/register-wallet.mjs) |
| 2 | Alex confirms registration in browser; `portalDevice` written to Arkiv | [frontend/src/app/api/devices/register/route.ts](frontend/src/app/api/devices/register/route.ts) |
| 3 | Alex drafts metadata in Contribute UI → `SKILL.md` frontmatter saved | [skill-capture/orchestrator/src/skill-md.ts](skill-capture/orchestrator/src/skill-md.ts) |
| 4 | Alex starts recording → `capture.py` records mic + screen until `q` | [skill-capture/capture.py](skill-capture/capture.py) |
| 5 | `process.py` transcribes audio, annotates frames, extracts skill body via Groq | [skill-capture/process.py](skill-capture/process.py) |
| 6 | Distribute job runs → Story IP mint + CDR encrypt + Arkiv publish | [skill-capture/cli/src/distribute.ts](skill-capture/cli/src/distribute.ts) |

**Story transactions (contributor device wallet signs):**

1. Upload IP/NFT metadata JSON to Helia/IPFS.
2. `storyClient.ipAsset.registerIpAsset()` — mints SPG NFT, registers IP on Aeneid, attaches `PILFlavor.commercialRemix` license (rev share + mint fee, default 1 IP).
3. Returns `ipId`, `licenseTermsId`, `txHash` — stored in `cdr-manifest.json`.

**CDR (encrypt before publish):**

```typescript
// skill-capture/cdr/src/services/publish-service.ts
const writeConditionData = encodeAbiParameters([{ type: "address" }], [owner]);
const readConditionData = encodeAbiParameters(
  [{ type: "address" }, { type: "address" }],
  [LICENSE_TOKEN, ipId],
);
await client.uploader.uploadFile({ /* zip bundle */ });
```

Only wallets holding a Story license token for this `ipId` can threshold-decrypt.

**Arkiv publish:** `publishCatalogToArkiv()` creates/updates:

- Entity type `skillListing` (project `skill-capture-ai-catalog-v1`)
- Tags (`skillTag`) for search: e.g. `code-review`, `typescript`, `security`
- Version snapshot (`listingVersion`)
- Payload includes `purchase` (vault UUID, CID, ipId, fees) and `ops` (IPFS gateway, Story addresses)

### Buyer side (agent wants to review code)

| Step | What happens | Stack |
|------|----------------|-------|
| 1 | Agent operator searches Arkiv: `"code review typescript"` | [skill-capture/arkiv/src/services/query-catalog.ts](skill-capture/arkiv/src/services/query-catalog.ts) → `searchNaturalLanguage()` |
| 2 | Selects `alex-code-review` → reads listing payload (CID, ipId, vault, fees) | `fetchSkillCatalogDetail()` / ClawSync `catalogActions.getDetail` |
| 3 | Buyer wallet mints Story license token | `storyClient.license.mintLicenseTokens()` |
| 4 | CDR decrypts bundle using license token as read condition | [clawsync/skill-marketplace/src/cdr/purchase-from-listing.ts](clawsync/skill-marketplace/src/cdr/purchase-from-listing.ts) / [clawsync/skill-marketplace/src/cdr/decrypt-with-logs.ts](clawsync/skill-marketplace/src/cdr/decrypt-with-logs.ts) |
| 5 | Agent imports `SKILL.md` + context into ClawSync agent | `skillPurchaseImport.importPurchasedSkill` |

**Story transactions (buyer agent wallet signs):**

1. `wipClient.deposit()` — wrap IP for license payment.
2. `wipClient.approve()` — royalty module allowance.
3. `license.mintLicenseTokens({ licensorIpId, licenseTermsId, amount: 1 })` — pays mint fee; royalty routed per license terms to Alex's device wallet.

**Result:** The agent's system prompt / skill file now encodes Alex's review heuristics. Every purchase is attributable on-chain; Alex earns per license without exposing raw video/audio publicly.

---

## OpenClu = AI + Privacy + DePIN

OpenClu is a deliberate **hybrid of all three [Arkiv ETHNS Builder Challenge themes](./themes.md)**. We go deep on each — not a tag slapped on a CRUD app.

### AI — agents whose memory you actually own

| Requirement (themes.md) | How OpenClu delivers |
|-------------------------|----------------------|
| Memory on Arkiv, wallet-owned | Skills are `skillListing` entities; `$owner` = contributor device wallet; `$creator` immutable |
| Portable across tools | Any client that reads Arkiv + Story + CDR can consume listings (frontend, ClawSync, MCP-style CLI) |
| Entity types | **Catalog:** `skillListing`, `trainingDataListing`, `skillTag`, `listingVersion`. **Portal:** `portalUser`, `portalDevice`, `deviceRegistrationPending` |
| Retrieval by tag / time | [skill-capture/arkiv/src/services/query-catalog.ts](skill-capture/arkiv/src/services/query-catalog.ts): `eq`, `and`, `gte`, `lte`, `desc` on typed attributes; NL search via `searchNaturalLanguage()` |
| Differentiated expiration | `listingExpiresIn()`, [skill-capture/arkiv/src/lib/portal-expiration.ts](skill-capture/arkiv/src/lib/portal-expiration.ts) — portal pending 24h TTL; listings extendable via `extendSkillListing()` |

**Components:** Groq extraction → structured `SKILL.md` / knowledge graph (roadmap); Arkiv payload stores triggers, tags, transcript refs; ClawSync agents attach purchased skills as runtime memory.

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
Device (DePIN) → encrypt (Privacy) → catalog (Arkiv) → agent skill (AI) → royalty (Story)
```

The same Arkiv entity carries **public discovery metadata** and **private content pointers**; the same device wallet signs **capture attribution** and **IP ownership**; the same license token gates **decryption** and **pays the contributor**.

---

## How it works

> **Diagrams:** Three Excalidraw flows are planned for this section:
> 1. Device registration flow
> 2. Skill contribution + agent consumption flow
> 3. Training data contribution + model training flow
>
> Placeholder paths: `docs/diagrams/registration.excalidraw`, `docs/diagrams/skill-contribution.excalidraw`, `docs/diagrams/training-contribution.excalidraw`

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
│  Convex actions → query / purchase / import skills                          │
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

---

### Phase 1 — Device registration

Registration binds three identities:

1. **Owner wallet** (Privy) — human who owns devices and receives portal UI access.
2. **Device wallet** (deterministic local key) — signs Story IP, CDR encrypt, Arkiv catalog `$owner`.
3. **Orchestrator URL** (ngrok) — how the hosted dashboard proxies jobs to the contributor machine.

#### Step 1.1 — Local wallet + pending row

**Script:** `skill-capture/register.sh`

1. Load `skill-capture/.env`.
2. `DEVICE_ID` = SHA256(hostname).
3. `scripts/register-wallet.mjs` derives viem account: `sha256(salt:deviceId)`.
4. Poll orchestrator `GET http://127.0.0.1:8790/health` for `publicUrl` (ngrok).
5. Write `DEVICE_WALLET_*`, `REGISTRATION_TOKEN`, `FRONTEND_URL`, `ORCHESTRATOR_PUBLIC_URL` to `.env`.
6. `POST ${FRONTEND_URL}/api/devices/pending` with token, device metadata, orchestrator URL.

**API route:** `frontend/src/app/api/devices/pending/route.ts`

```typescript
await upsertPendingRegistration({ token, deviceWallet, deviceId, deviceName, orchestratorUrl });
```

**Arkiv mutation:** `skill-capture/arkiv/src/services/mutate-portal.ts` → `upsertPendingRegistration()`

- Entity type: `deviceRegistrationPending` (`PORTAL_ENTITY_TYPE.pendingRegistration`)
- Project attribute: `openclu-portal-v1` (`portal-constants.ts:1-4`)
- Attributes: `registrationToken`, `deviceWallet`, `deviceId`, `orchestratorUrl`, `expiresAt`
- TTL: `portal-expiration.ts` (~24h)

#### Step 1.2 — Browser confirmation

**Page:** `frontend/src/app/register/page.tsx`  
Query params: `?token=&address=&deviceName=&deviceId=&orchestratorUrl=`

User connects Privy wallet → `POST /api/devices/register`

**API route:** `frontend/src/app/api/devices/register/route.ts`

1. `getSessionWallet()` — owner must be logged in.
2. `getPendingRegistrationByToken(token)` — validate device wallet + orchestrator URL match pending row.
3. `upsertPortalDevice({ ownerWallet, deviceWallet, deviceId, deviceName, orchestratorUrl })`.
4. `deletePendingRegistration(token)`.

**Arkiv entities written:**

| Entity | File | Function |
|--------|------|----------|
| `portalDevice` | [skill-capture/arkiv/src/entities/portal-device.ts](skill-capture/arkiv/src/entities/portal-device.ts) | `buildPortalDeviceCreate()` |
| (delete pending) | [skill-capture/arkiv/src/services/mutate-portal.ts](skill-capture/arkiv/src/services/mutate-portal.ts) | `deletePendingRegistration()` |

**Portal bridge (frontend never calls SDK directly):**

```typescript
// frontend/src/lib/portal-db.ts
spawn("tsx", ["skill-capture/arkiv/src/cli/portal-db-cli.ts", command], {
  env: { ...process.env, SKILL_CAPTURE_PORTAL_JSON: JSON.stringify(payload) },
});
```

#### Step 1.3 — Profile (optional)

**Routes:** `frontend/src/app/api/profile/route.ts`, `avatar/route.ts`  
**Arkiv:** `upsertPortalUser()` → entity `portalUser` with display name, avatar bytes reference.

#### Step 1.4 — Device list for contribute

**Route:** `GET /api/devices` → `listDevicesForOwner(ownerWallet)`  
**Arkiv query:** `fetchPortalDevicesForOwner()` in `query-portal.ts`

#### Step 1.5 — Job proxy

**Route:** `frontend/src/app/api/orch/[...path]/route.ts`

Forwards to `{portalDevice.orchestratorUrl}/api/v1/{path}` with header `x-device-id`. Resolves orchestrator URL from Arkiv portal device record via `getPortalDeviceOrchestratorUrl()` (`frontend/src/lib/session.ts`).

---

### Phase 2 — Contribution

#### 2.1 Skill contribution (screen + voice → SKILL.md)

##### 2.1.1 Draft metadata

**UI:** `frontend/src/app/(app)/contribute/page.tsx`  
**Proxy:** `POST /api/orch/jobs/skill-md` → orchestrator `writeDraftSkillMd()`

Writes `skill-capture/skills/<slug>/SKILL.md` with YAML frontmatter (title, description, triggers, tags).

##### 2.1.2 Capture

**Orchestrator:** `POST /api/v1/jobs/capture` → `startCaptureJob()` (`orchestrator/src/jobs.ts`)

Spawns:

```bash
python capture.py <slug> --no-distribute
```

**`capture.py`:**

| Function | Output |
|----------|--------|
| `record_audio()` | WAV via PyAudio |
| `record_screen()` | PNG frames every 5s via `mss` |
| `wait_for_terminal_quit()` | Blocks until `q` (forwarded by [skill-capture/orchestrator/src/capture-quit-listener.ts](skill-capture/orchestrator/src/capture-quit-listener.ts)) |
| `save_outputs()` | `skills/raw/<slug>/<timestamp>/` |

##### 2.1.3 Process (Groq)

**`process.py`** (invoked from `capture.py`):

| Step | Model | Output |
|------|-------|--------|
| Transcribe | `whisper-large-v3` | `transcript.json` |
| Frame annotate | `llama-4-scout-17b-16e-instruct` | `frame_annotations.json` |
| Skill extract | `llama-3.3-70b-versatile` | `SKILL.md` body merged with user frontmatter |

Env: `GROQ_API_KEY` in `skill-capture/.env`.

##### 2.1.4 Distribute (Story + CDR + Helia + Arkiv)

UI auto-triggers when capture job succeeds: `POST /api/orch/jobs/{id}/distribute`

**Pipeline:** `skill-capture/cli/src/distribute.ts` → `distributeSkill()`

| # | Step | File | Function |
|---|------|------|----------|
| 1 | Load device signer | [skill-capture/arkiv/src/lib/device-wallet.ts](skill-capture/arkiv/src/lib/device-wallet.ts) | `loadDeviceAccount()` |
| 2 | Register Story IP | [skill-capture/cdr/src/services/publish-service.ts](skill-capture/cdr/src/services/publish-service.ts) | `registerSkillIp()` |
| 3 | Zip bundle | [skill-capture/cli/src/distribute.ts](skill-capture/cli/src/distribute.ts) | `readBundleZip()` |
| 4 | Boot Helia | [skill-capture/cdr/src/helia-storage.ts](skill-capture/cdr/src/helia-storage.ts) | `getHeliaStorage()` |
| 5 | CDR encrypt | [skill-capture/cdr/src/services/publish-service.ts](skill-capture/cdr/src/services/publish-service.ts) | `encryptBundleToVault()` |
| 6 | Pin public IPFS | [skill-capture/cdr/src/pinata-ipfs.ts](skill-capture/cdr/src/pinata-ipfs.ts) | `pinCiphertextToPublicIpfs()` |
| 7 | Local manifest | [skill-capture/cli/src/distribute.ts](skill-capture/cli/src/distribute.ts) | `writeLocalManifest()` → `cdr-manifest.json` |
| 8 | **Arkiv publish** | [skill-capture/arkiv/src/services/publish-catalog.ts](skill-capture/arkiv/src/services/publish-catalog.ts) | `publishCatalogToArkiv()` |

**Arkiv publish detail** (`publishCatalogToArkiv`, line 68+):

1. `buildListingPayload()` — merges `SKILL.md`, `cdr-manifest.json`, ops block (`build-listing.ts`).
2. Query existing listing by slug: `fetchListings({ skillSlug, scope: "mine" })`.
3. If exists: `updateEntity` on `skillListing`; else `createEntity`.
4. Delete + recreate `skillTag` entities for search tags (`deriveTags()` from frontmatter).
5. Create `listingVersion` snapshot with incremented version (`getNextVersionNumber()`).
6. Write `arkivListingKey`, `arkivStatus`, `arkivVersion` back to manifest + registry JSON.

**Entity attributes stamped** (`constants.ts`):

```typescript
export const PROJECT_ATTRIBUTE = {
  key: "project",
  value: "skill-capture-ai-catalog-v1",
};
export const ENTITY_TYPE = { skillListing: "skillListing", skillTag: "skillTag", ... };
```

Every query filters `eq("project", PROJECT_ATTRIBUTE.value)` — required by [Arkiv best practices](./themes.md).

##### 2.1.5 Lifecycle jobs (orchestrator)

| Job | Orchestrator route | Arkiv job | Effect |
|-----|-------------------|-----------|--------|
| Update metadata | `POST /jobs/update-catalog` | [skill-capture/arkiv/src/jobs/update-catalog.ts](skill-capture/arkiv/src/jobs/update-catalog.ts) | Re-index listing, same CDR vault |
| Archive | `POST /jobs/archive` | [skill-capture/arkiv/src/services/archive-catalog.ts](skill-capture/arkiv/src/services/archive-catalog.ts) | `status: archived`, tags deleted |
| Extend TTL | CLI `npm run extend` | [skill-capture/arkiv/src/services/extend-catalog.ts](skill-capture/arkiv/src/services/extend-catalog.ts) | `extendEntity` |
| Re-publish | distribute again | full pipeline | new IP + vault + version |

**Contributions UI:** `frontend/src/app/(app)/contributions/page.tsx` lists owner skills by querying Arkiv per registered device (`contributions-from-arkiv.ts`).

---

#### 2.2 Training data contribution (video → TRAINING.md)

Parallel path for **ML/AI model training** (not agent `SKILL.md`):

| Aspect | Skill | Training data |
|--------|-------|---------------|
| Metadata | `skills/<slug>/SKILL.md` | `training-data/<slug>/TRAINING.md` |
| Capture | `capture.py` (screen + mic) | [skill-capture/video_capture.py](skill-capture/video_capture.py) (camera + mic → webm → `video.b64`) |
| Groq | Yes (`process.py`) | No — raw video preserved |
| Distribute | `distributeSkill()` | `distributeTraining()` ([skill-capture/cli/src/distribute-training.ts](skill-capture/cli/src/distribute-training.ts)) |
| Arkiv entity | `skillListing` | `trainingDataListing` |
| Publish fn | `publishCatalogToArkiv()` | `publishTrainingCatalogToArkiv()` ([skill-capture/arkiv/src/services/publish-training-catalog.ts](skill-capture/arkiv/src/services/publish-training-catalog.ts)) |
| Payload builder | [skill-capture/arkiv/src/lib/build-listing.ts](skill-capture/arkiv/src/lib/build-listing.ts) | [skill-capture/arkiv/src/lib/build-training-listing.ts](skill-capture/arkiv/src/lib/build-training-listing.ts) (`contentKind: "trainingData"`) |

**UI:** Contribute page "Record training data" card → `startVideoCaptureJob` → `startDistributeTrainingJob`.

**Buyer utility:** ClawSync `SyncBoardPurchaseTrainingData.tsx` + `trainingDataPurchaseActions.purchaseTrainingData` → decrypt bundle → `clawsync/local-trainer/` (MobileViT fine-tuning on purchased video).

---

### Phase 3 — Utility (agents & model trainers)

#### 3.1 Browse / search (Arkiv read path)

**Frontend:**

```
POST /api/catalog/query
  → frontend/src/lib/catalog.ts::queryCatalog()
  → arkiv/src/cli/catalog-query-cli.ts
  → catalog-read-bridge.ts::catalogQuery()
  → query-catalog.ts::searchNaturalLanguage() | fetchListings()
```

**ClawSync SyncBoard:**

```
SyncBoardPurchaseSkills.tsx
  → convex/catalogActions.ts::query | getDetail
  → convex/lib/marketplaceCli.ts::runMarketplaceCli('query')
  → skill-marketplace/src/cli/marketplace-cli.ts
  → (vendored) query-catalog.ts
```

**Agent chat:**

```
marketplaceTools.ts → executeSearchArkivSkills
  → marketplace-cli query + get-detail fallback
```

Marketplace scope defaults to `status: published` (`query-catalog.ts:41-49`).

#### 3.2 Purchase & decrypt

**ClawSync purchase action:** `convex/skillPurchaseActions.ts` → `purchaseSkill`

**Core logic:** `clawsync/skill-marketplace/src/cdr/purchase-from-listing.ts`

1. Load listing from inline `catalogSnapshot` or live `fetchSkillListingFromArkiv()` (`arkiv/src/lib/cdr-listing.ts`).
2. Story: `wipClient.deposit` → `approve` → `license.mintLicenseTokens`.
3. CDR: `downloadFileWithLogs()` with license token in read condition aux data.
4. Unzip to `data/purchased-skills/<slug>/`.
5. Convex: `insertPurchased` + optional `importPurchasedSkill` to attach to agent.

**Standalone CLI:** `skill-capture/cdr/src/purchase-skill.ts` — same flow for developers without ClawSync.

#### 3.3 Owner contributions dashboard

```typescript
// frontend/src/lib/contributions-from-arkiv.ts:67-101
const devices = await listDevicesForOwner(ownerWallet); // Arkiv portalDevice
for (const device of devices) {
  queryCatalog({ scope: "mine", ownerAddress: device.wallet_address, full: true });
  queryCatalogTraining({ scope: "mine", ownerAddress: device.wallet_address, full: true });
}
```

No Supabase — portal devices and catalog listings both live on Arkiv Braga.

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

The economics stay the same: **device wallet owns the IP**, Story enforces licenses, CDR encrypts, Arkiv catalogs. Contributors wear Clu during their workday, week, or craft session; skills and datasets accumulate as a **portfolio of licensable assets**. Agent platforms plug into Arkiv; model labs license training bundles with on-chain attribution.

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
