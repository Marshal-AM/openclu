#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
ENV_FILE="$ROOT/.env"
# shellcheck disable=SC1091
[[ -f "$ENV_FILE" ]] && set -a && source "$ENV_FILE" && set +a

FRONTEND_URL="${FRONTEND_URL:-https://openclu-dashboard.vercel.app}"
ORCHESTRATOR_LOCAL="${ORCHESTRATOR_URL:-http://127.0.0.1:8790}"
ORCHESTRATOR_PORT="${ORCHESTRATOR_PORT:-8790}"

DEVICE_NAME="raspberry Raspbian GNU/Linux 13 (trixie)"
DEVICE_ID="$(echo -n "$DEVICE_NAME" | sha256sum | awk '{print $1}')"

if [[ -f "$ENV_FILE" ]] && grep -q '^DEVICE_SALT=' "$ENV_FILE"; then
  DEVICE_SALT="$(grep '^DEVICE_SALT=' "$ENV_FILE" | cut -d= -f2-)"
else
  DEVICE_SALT="$(openssl rand -hex 16 2>/dev/null || head -c 16 /dev/urandom | xxd -p)"
fi

WALLET_JSON="$(DEVICE_SALT="$DEVICE_SALT" DEVICE_ID="$DEVICE_ID" node "$ROOT/scripts/register-wallet.mjs")"
DEVICE_ADDRESS="$(echo "$WALLET_JSON" | node -e "console.log(JSON.parse(require('fs').readFileSync(0,'utf8')).address)")"
DEVICE_PRIVATE_KEY="$(echo "$WALLET_JSON" | node -e "console.log(JSON.parse(require('fs').readFileSync(0,'utf8')).privateKey)")"
REGISTRATION_TOKEN="$(node -e "console.log(require('crypto').randomUUID())")"

ORCHESTRATOR_PUBLIC="${ORCHESTRATOR_PUBLIC_URL:-}"
if curl -sf "${ORCHESTRATOR_LOCAL}/health" >/dev/null 2>&1; then
  HEALTH_JSON="$(curl -sf "${ORCHESTRATOR_LOCAL}/health")"
  ORCHESTRATOR_PUBLIC="$(echo "$HEALTH_JSON" | node -e "
    try {
      const j = JSON.parse(require('fs').readFileSync(0,'utf8'));
      if (j.publicUrl) console.log(String(j.publicUrl).replace(/\\/$/, ''));
    } catch (_) {}
  " 2>/dev/null || true)"
  if [[ -z "$ORCHESTRATOR_PUBLIC" ]]; then
    echo "Warning: orchestrator has no publicUrl — check NGROK_AUTHTOKEN and pyngrok in venv"
  fi
else
  echo "Warning: orchestrator not running at ${ORCHESTRATOR_LOCAL}"
  echo "  Start it: cd orchestrator && npm run start  (ngrok URL prints there)"
fi

touch "$ENV_FILE"
grep -v '^DEVICE_\|^REGISTRATION_TOKEN\|^FRONTEND_URL\|^ORCHESTRATOR_PUBLIC_URL=' "$ENV_FILE" > "$ENV_FILE.tmp" 2>/dev/null || true
mv "$ENV_FILE.tmp" "$ENV_FILE"
cat >> "$ENV_FILE" <<EOF
DEVICE_ID=$DEVICE_ID
DEVICE_NAME="$DEVICE_NAME"
DEVICE_SALT=$DEVICE_SALT
DEVICE_WALLET_ADDRESS=$DEVICE_ADDRESS
DEVICE_WALLET_PRIVATE_KEY=$DEVICE_PRIVATE_KEY
REGISTRATION_TOKEN=$REGISTRATION_TOKEN
FRONTEND_URL=$FRONTEND_URL
EOF
if [[ -n "$ORCHESTRATOR_PUBLIC" ]]; then
  echo "ORCHESTRATOR_PUBLIC_URL=$ORCHESTRATOR_PUBLIC" >> "$ENV_FILE"
fi

ORCH_PARAM=""
if [[ -n "$ORCHESTRATOR_PUBLIC" ]]; then
  ORCH_ENC="$(node -p "encodeURIComponent(process.argv[1])" "$ORCHESTRATOR_PUBLIC")"
  ORCH_PARAM="&orchestratorUrl=${ORCH_ENC}"
fi

DEVICE_ID_ENC="$(node -p "encodeURIComponent(process.argv[1])" "$DEVICE_ID")"
REGISTER_URL="${FRONTEND_URL}/register?token=${REGISTRATION_TOKEN}&address=${DEVICE_ADDRESS}&deviceName=$(node -p "encodeURIComponent(process.argv[1])" "$DEVICE_NAME")&deviceId=${DEVICE_ID_ENC}${ORCH_PARAM}"

echo ""
echo "=== Skill Capture Device Registration ==="
echo "Device:     $DEVICE_NAME"
echo "Device ID:  $DEVICE_ID"
echo "Address:    $DEVICE_ADDRESS"
if [[ -n "$ORCHESTRATOR_PUBLIC" ]]; then
  echo "Orchestrator (ngrok): $ORCHESTRATOR_PUBLIC"
fi
echo ""
echo "PRIVATE KEY (keep local, never commit):"
echo "$DEVICE_PRIVATE_KEY"
echo ""
echo "Fund this wallet on Story Aeneid + Braga GLM before first publish."
echo ""
PENDING_JSON="{\"registration_token\":\"$REGISTRATION_TOKEN\",\"device_id\":\"$DEVICE_ID\",\"device_name\":\"$DEVICE_NAME\",\"wallet_address\":\"$DEVICE_ADDRESS\""
if [[ -n "$ORCHESTRATOR_PUBLIC" ]]; then
  PENDING_JSON="${PENDING_JSON},\"orchestrator_url\":\"$ORCHESTRATOR_PUBLIC\""
fi
PENDING_JSON="${PENDING_JSON}}"

curl -sf -X POST "${FRONTEND_URL}/api/devices/pending" \
  -H "Content-Type: application/json" \
  -d "$PENDING_JSON" \
  2>/dev/null || echo "(Could not POST pending — ensure frontend is running and PORTAL_WALLET_PRIVATE_KEY is set in frontend/.env.local)"

echo "Scan this QR to register the device in your browser:"
if node "$ROOT/scripts/print-registration-qr.mjs" "$REGISTER_URL" 2>/dev/null; then
  :
else
  echo "(Install qrcode-terminal: npm install in skill-capture/)"
  echo "$REGISTER_URL"
fi
