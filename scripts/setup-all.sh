#!/usr/bin/env bash
# Install all OpenClu local dependencies (skill-capture + clawsync).
# Run from the repository root: ./scripts/setup-all.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/skill-capture"

if [[ ! -d venv ]]; then
  echo "Creating Python venv in skill-capture/venv …"
  python3 -m venv venv
fi

# shellcheck disable=SC1091
source venv/bin/activate

echo "Installing skill-capture (Node + Python) …"
npm run setup

cd "$ROOT/clawsync"
echo "Installing clawsync (includes skill-marketplace via postinstall) …"
npm install

echo ""
echo "Done. Next steps:"
echo "  1. Copy skill-capture/.env.example → skill-capture/.env and fill keys"
echo "  2. Copy clawsync/.env.example → clawsync/.env"
echo "  3. See SETUP.md for orchestrator, registration, and ClawSync runbooks"
