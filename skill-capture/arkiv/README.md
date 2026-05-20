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
| `npm run archive` | `npm run archive -- <skill-name>` |
| `npm run extend` | `npm run extend -- <skill-name>` |

## Listing payload (`ops`)

Each `skillListing` includes an `ops` block written at publish time:

| Field | Purpose |
|-------|---------|
| `heliaPeerId` / `heliaMultiaddrs` | Dial publisher Helia for encrypted blob |
| `encryptedSizeBytes` | Bundle size hint |
| `readConditionAddress` / `writeConditionAddress` / `licenseTokenAddress` | Story CDR contracts (Aeneid) |
| `storyApiUrl` / `rpcUrl` | Validator API + chain RPC |

Re-publish or `cd ..\cdr && npm run index-arkiv -- <skill>` to refresh peer hints after Helia restarts.

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
