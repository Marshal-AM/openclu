import type { SkillCdrListing } from "../../../../skill-capture/db/src/catalog/cdr-listing.js";
import {
  fetchPublicGateway,
  gatewayUrlForCid,
  resolvePublicIpfsGateway,
} from "./pinata-ipfs.js";
import { log, timed } from "./logger.js";

const GATEWAY_TIMEOUT_MS = Number(process.env.IPFS_GATEWAY_TIMEOUT_MS ?? "60000");

function gatewaysForListing(listing: SkillCdrListing): string[] {
  const bases: string[] = [];
  if (listing.ipfs_gateway_url?.trim()) {
    bases.push(listing.ipfs_gateway_url.trim());
  }
  const env =
    process.env.PINATA_BUYER_GATEWAY?.trim() ||
    process.env.PINATA_GATEWAY?.trim() ||
    process.env.IPFS_GATEWAY?.trim();
  if (env) bases.push(env);
  bases.push(resolvePublicIpfsGateway());
  bases.push("https://ipfs.io/ipfs", "https://dweb.link/ipfs");
  return [...new Set(bases.map((b) => b.replace(/\/$/, "")))];
}

async function fetchFromGateway(
  gatewayBase: string,
  cid: string,
  expectedBytes?: number,
): Promise<Uint8Array> {
  const url = gatewayUrlForCid(gatewayBase, cid);
  const res = await fetchPublicGateway(url, GATEWAY_TIMEOUT_MS);
  if (!res.ok) {
    throw new Error(`${url}: HTTP ${res.status}`);
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (expectedBytes && expectedBytes > 0) {
    const minBytes = Math.floor(expectedBytes * 0.95);
    if (bytes.length < minBytes) {
      throw new Error(
        `${url}: got ${bytes.length} bytes, expected at least ${minBytes} (catalog ${expectedBytes})`,
      );
    }
  }
  return bytes;
}

/**
 * Fetch encrypted bundle by catalog CID (public IPFS — Pinata pin at publish).
 */
export async function downloadCiphertext(
  listing: SkillCdrListing,
  cid: string,
): Promise<Uint8Array> {
  if (cid !== listing.cid) {
    throw new Error(`Vault CID ${cid} != catalog CID ${listing.cid}`);
  }

  const expectedBytes = listing.encrypted_size_bytes;

  let lastErr = "no gateway";
  for (const base of gatewaysForListing(listing)) {
    try {
      const bytes = await timed(`IPFS gateway (${base})`, () =>
        fetchFromGateway(base, cid, expectedBytes),
      );
      log.ok(`Downloaded ${bytes.length} bytes from ${base}`);
      return bytes;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      log.warn(`Gateway miss (${base}): ${lastErr}`);
    }
  }

  throw new Error(
    `Could not fetch CID ${cid} from public IPFS (${lastErr}). ` +
      `Re-publish or run: npm run repin-pinata -- ${listing.skill_name}`,
  );
}
