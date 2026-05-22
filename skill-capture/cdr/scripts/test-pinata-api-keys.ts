/**
 * Verify Pinata API key + secret (uses pinata-ipfs.ts — same path as distribute/publish).
 *
 * Usage (from skill-capture/cdr):
 *   npm run test:pinata-api-keys
 */
import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  gatewayUrlForCid,
  pinataApiKeysConfigured,
  resolvePublicIpfsGateway,
  uploadCiphertextToPinata,
} from "../src/pinata-ipfs.js";

const CDR_DIR = dirname(fileURLToPath(import.meta.url));
const SKILL_CAPTURE_ROOT = resolve(CDR_DIR, "../..");

config({ path: resolve(SKILL_CAPTURE_ROOT, ".env") });
config({ path: resolve(CDR_DIR, ".env"), override: false });

async function fetchFromGateway(url: string): Promise<{ ok: boolean; status: number; bytes: number }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) return { ok: false, status: res.status, bytes: 0 };
  const buf = await res.arrayBuffer();
  return { ok: true, status: res.status, bytes: buf.byteLength };
}

async function main() {
  if (!pinataApiKeysConfigured()) {
    console.error("Set PINATA_API_KEY and PINATA_SECRET_KEY in skill-capture/.env");
    process.exit(1);
  }

  const gatewayBase = resolvePublicIpfsGateway();
  const payload = `skill-capture pinata test ${new Date().toISOString()}`;
  const bytes = new TextEncoder().encode(payload);

  console.log("── Pinata module test (uploadCiphertextToPinata) ──");
  console.log(`  Gateway: ${gatewayBase}\n`);

  const { cid } = await uploadCiphertextToPinata(bytes, "api-key-test");

  const urls = [
    { name: "Buyer gateway", url: gatewayUrlForCid(gatewayBase, cid) },
    { name: "ipfs.io", url: `https://ipfs.io/ipfs/${cid}` },
  ];

  let ok = false;
  for (const { name, url } of urls) {
    const r = await fetchFromGateway(url);
    if (r.ok) {
      console.log(`  OK ${name} — ${r.bytes} bytes`);
      ok = true;
    } else {
      console.log(`  FAIL ${name} — HTTP ${r.status}`);
    }
  }

  if (!ok) process.exit(1);
  console.log("\n── PASS ──");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
