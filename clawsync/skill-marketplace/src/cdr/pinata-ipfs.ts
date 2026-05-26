import { log } from "./logger.js";

const PIN_BY_HASH_URL = "https://api.pinata.cloud/pinning/pinByHash";
const PIN_FILE_API_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";
const PINATA_V3_UPLOAD_URL = "https://uploads.pinata.cloud/v3/files";

const DEFAULT_BUYER_GATEWAY = "https://gateway.pinata.cloud/ipfs";

export function pinataApiKeysConfigured(): boolean {
  return Boolean(
    process.env.PINATA_API_KEY?.trim() && process.env.PINATA_SECRET_KEY?.trim(),
  );
}

export function pinataJwtConfigured(): boolean {
  return Boolean(process.env.PINATA_JWT?.trim());
}

export function pinataConfigured(): boolean {
  return pinataApiKeysConfigured();
}

export function resolvePublicIpfsGateway(): string {
  const custom =
    process.env.PINATA_BUYER_GATEWAY?.trim() ||
    process.env.PINATA_GATEWAY?.trim() ||
    process.env.IPFS_GATEWAY?.trim();
  if (!custom) return DEFAULT_BUYER_GATEWAY;
  let g = custom.replace(/\/$/, "");
  if (!/^https?:\/\//i.test(g)) g = `https://${g}`;
  if (!/\/ipfs$/i.test(g)) g = `${g}/ipfs`;
  return g;
}

export function gatewayUrlForCid(gatewayBase: string, cid: string): string {
  return `${gatewayBase.replace(/\/$/, "")}/${cid}`;
}

function pinataCredentialError(): string {
  return (
    "Pinata credentials missing. Set PINATA_API_KEY + PINATA_SECRET_KEY in clawsync/.env " +
    "(required for pin-by-CID)."
  );
}

export function hostNodesForPinata(multiaddrs: string[]): string[] {
  const dialable = multiaddrs.filter(
    (a) => !a.includes("/ip4/127.0.0.1/") && !a.includes("/ip6/::1/"),
  );
  return dialable.length > 0 ? dialable : multiaddrs;
}

export async function pinVaultCidOnPinata(opts: {
  cid: string;
  skillName: string;
  hostNodes: string[];
}): Promise<{ gatewayBase: string }> {
  const apiKey = process.env.PINATA_API_KEY?.trim();
  const secretKey = process.env.PINATA_SECRET_KEY?.trim();
  if (!apiKey || !secretKey) {
    throw new Error(pinataCredentialError());
  }

  const hostNodes = hostNodesForPinata(opts.hostNodes);
  if (!hostNodes.length) {
    throw new Error("No Helia multiaddrs for Pinata pin-by-CID.");
  }

  const body = {
    hashToPin: opts.cid,
    pinataMetadata: {
      name: `${opts.skillName}-ciphertext`,
      keyvalues: { skill: opts.skillName, source: "clawsync", vaultCid: opts.cid },
    },
    pinataOptions: { hostNodes },
  };

  log.info(`Pinata pin-by-CID: ${opts.cid} (${hostNodes.length} host node(s))`);
  const res = await fetch(PIN_BY_HASH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      pinata_api_key: apiKey,
      pinata_secret_api_key: secretKey,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(Number(process.env.PINATA_UPLOAD_TIMEOUT_MS ?? "120000")),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pinata pinByHash failed (${res.status}): ${text.slice(0, 500)}`);
  }

  const json = (await res.json()) as { IpfsHash?: string; ipfsHash?: string };
  const pinned = json.IpfsHash ?? json.ipfsHash ?? opts.cid;
  if (pinned !== opts.cid) {
    throw new Error(`Pinata pin-by-CID returned ${pinned}, expected ${opts.cid}`);
  }

  const gatewayBase = resolvePublicIpfsGateway();
  log.ok(`Pinata pinned vault CID: ${opts.cid}`);
  return { gatewayBase };
}

/** @deprecated Use pinVaultCidOnPinata for vault ciphertext. */
export async function uploadCiphertextToPinata(
  bytes: Uint8Array,
  skillName: string,
): Promise<{ cid: string; gatewayBase: string }> {
  throw new Error(
    "uploadCiphertextToPinata cannot preserve CDR vault CIDs. Use pinVaultCidOnPinata with local Helia host nodes.",
  );
}
