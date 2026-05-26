import {
  portalDeletePending,
  portalGetDevice,
  portalGetDeviceOrchestratorUrl,
  portalGetPending,
  portalGetUserAvatar,
  portalGetUserProfile,
  portalListDevices,
  portalTouchLogin,
  portalUpdateDevice,
  portalUpsertDevice,
  portalUpsertPending,
  portalUpsertUser,
  portalUpsertUserAvatar,
} from "../portal-db-bridge.js";

const cmd = process.argv[2];

function parseJsonArg(): Record<string, unknown> {
  const fromEnv = process.env.SKILL_CAPTURE_PORTAL_JSON?.trim();
  if (fromEnv) return JSON.parse(fromEnv) as Record<string, unknown>;

  const raw = process.argv.slice(3).join(" ").trim() || "{}";
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    const fixed = raw.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)(\s*:)/g, '$1"$2"$3');
    return JSON.parse(fixed) as Record<string, unknown>;
  }
}

async function main() {
  const body = parseJsonArg();

  switch (cmd) {
    case "list-devices":
      console.log(JSON.stringify(await portalListDevices(String(body.ownerWallet ?? ""))));
      return;
    case "get-device":
      console.log(
        JSON.stringify(
          await portalGetDevice(String(body.ownerWallet ?? ""), String(body.portalId ?? "")),
        ),
      );
      return;
    case "get-device-orchestrator-url":
      console.log(
        JSON.stringify(
          await portalGetDeviceOrchestratorUrl(
            String(body.ownerWallet ?? ""),
            String(body.portalId ?? ""),
          ),
        ),
      );
      return;
    case "get-user":
      console.log(JSON.stringify(await portalGetUserProfile(String(body.wallet ?? ""))));
      return;
    case "get-user-avatar":
      console.log(JSON.stringify(await portalGetUserAvatar(String(body.wallet ?? ""))));
      return;
    case "upsert-user":
      console.log(JSON.stringify(await portalUpsertUser(body as never)));
      return;
    case "upsert-user-avatar":
      console.log(
        JSON.stringify(
          await portalUpsertUserAvatar(String(body.wallet ?? ""), body.avatar as never),
        ),
      );
      return;
    case "touch-login":
      console.log(JSON.stringify(await portalTouchLogin(String(body.wallet ?? ""))));
      return;
    case "update-device":
      console.log(JSON.stringify(await portalUpdateDevice(body as never)));
      return;
    case "upsert-device":
      console.log(JSON.stringify(await portalUpsertDevice(body as never)));
      return;
    case "upsert-pending":
      console.log(JSON.stringify(await portalUpsertPending(body as never)));
      return;
    case "get-pending":
      console.log(JSON.stringify(await portalGetPending(String(body.registrationToken ?? ""))));
      return;
    case "delete-pending":
      console.log(JSON.stringify(await portalDeletePending(String(body.registrationToken ?? ""))));
      return;
    default:
      console.error(
        "Usage: portal-db-cli.ts list-devices|get-device|get-device-orchestrator-url|get-user|get-user-avatar|upsert-user|upsert-user-avatar|touch-login|upsert-device|update-device|upsert-pending|get-pending|delete-pending",
      );
      process.exit(1);
  }
}

main().catch((e) => {
  console.error(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }));
  process.exit(1);
});
