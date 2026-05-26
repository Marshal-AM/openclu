# Skill Capture — Arkiv catalog (Phase 1)

Indexes CDR-published skills on [Arkiv Braga](https://braga.hoodi.arkiv.network/) for agent discovery and **purchase metadata** (no encrypted skill content in Arkiv).

CDR `purchase-skill.ts` loads listings via `fetchSkillListingFromArkiv()` — single source of truth for vault UUID, Story IP IDs, IPFS CID, and Helia peer hints.

## Setup

```powershell
cd skill-capture\arkiv
copy .env.example .env
# set WALLET_PRIVATE_KEY=
npm install
```

Fund the wallet with test GLM: [Braga faucet](https://braga.hoodi.arkiv.network/faucet/)

## Commands

| Script | Usage |
|--------|--------|
| `npm run index` | `npm run index -- <skill-name>` |
| `npm run query` | `npm run query -- "natural language" [--tag cursor] [--status published]` |
| `npm run stats` | Entity counts |
| `npm run archive` | `npm run archive -- <skill-name>` — soft-delete (`status: archived`) |
| `npm run extend` | `npm run extend -- <skill-name>` |
| `update-catalog` job | `npx tsx src/jobs/update-catalog.ts <skill-name>` — metadata-only re-index (bumps `arkivVersion`) |

## Creator lifecycle

- **Publish / update:** `publishCatalogToArkiv` — create or update `skillListing`, replace tags, append `listingVersion` snapshot.
- **Edit metadata:** change `SKILL.md`, run `update-catalog` (or UI **Save metadata to Arkiv**) — no new CDR encrypt.
- **Re-publish ciphertext:** CLI `distribute` or UI **Re-encrypt** / **Re-record** — new vault/CID; Arkiv version increments.
- **Delete:** `archive` — listing stays on-chain with `archived` status (not hard-deleted).

**`$owner`:** device wallet from `DEVICE_WALLET_PRIVATE_KEY` — required for all writes. **`$creator`:** immutable; use `.createdBy(address)` on queries for trusted publisher reads. Marketplace queries default to `status: published`.

## Portal entities (OpenClu dashboard)

User profiles, registered devices, and pending device registrations are stored on Arkiv under project `openclu-portal-v1` (override with `ARKIV_PORTAL_PROJECT_VALUE`).

| Entity type | Purpose |
|-------------|---------|
| `portalUser` | Owner wallet profile (display name, email, bio, avatar bytes) |
| `portalDevice` | Registered capture device + orchestrator ngrok URL |
| `deviceRegistrationPending` | Short-lived row from `register.sh` before browser confirm |

Writes use `PORTAL_WALLET_PRIVATE_KEY` (set in `frontend/.env.local` on Vercel/local). The OpenClu **frontend** reads/writes portal entities directly via `@arkiv-network/sdk` — no subprocess to this package.

**Legacy CLI:** `portal-db-cli.ts` in this repo mirrors the same schema for local debugging; production dashboard does not call it.

## Listing payload (`ops`)

Each `skillListing` includes an `ops` block written at publish time:

| Field | Purpose |
|-------|---------|
| `ipfsGatewayUrl` | **Primary:** Public IPFS gateway base (e.g. Pinata) where buyers fetch ciphertext by CID |
| `heliaPeerId` / `heliaMultiaddrs` | Legacy P2P fallback only (publisher machine must be online) |
| `encryptedSizeBytes` | Bundle size hint |
| `readConditionAddress` / `writeConditionAddress` / `licenseTokenAddress` | Story CDR contracts (Aeneid) |
| `storyApiUrl` / `rpcUrl` | Validator API + chain RPC |

**Distribute** (`cli` pipeline or `cdr` publish) pins ciphertext on public IPFS (Pinata API key + secret, DeepShare-style) and writes `ipfsGatewayUrl` into Arkiv. Re-publish or `cd ..\cdr && npm run index-arkiv -- <skill>` to refresh peer hints only (does not re-pin ciphertext).

## Example

```powershell
cd ..\cdr
npm run publish -- cursor-usage ..\skills\cursor-usage
cd ..\arkiv
npm run query -- "cursor IDE agent tasks" --tag cursor
cd ..\cdr
npm run purchase -- cursor-usage
npm run e2e
```
