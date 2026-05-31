# skill-marketplace

Self-contained Supabase catalog read + CDR skill purchase for ClawSync. Vendored from skill-capture; no sibling-repo runtime dependency.

## Setup

From the **clawsync** root (recommended):

```bash
npm install
```

That installs this workspace via npm workspaces + `postinstall`. You do not need a separate `cd skill-marketplace` step unless install was skipped.

## CLI (used by Convex actions)

```bash
npx tsx src/cli/marketplace-cli.ts query '{"scope":"marketplace","query":"rust"}'
npx tsx src/cli/marketplace-cli.ts get-detail my-skill-slug
npx tsx src/cli/marketplace-cli.ts purchase '{"skillName":"my-skill","outputDir":"../data/purchased-skills"}'
```

Requires `AGENT_PRIVATE_KEY` in the environment for purchase and `mine` scope queries.
