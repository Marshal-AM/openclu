import { log } from "./logger.js";

/** Pinata pulls the exact block CID from these libp2p multiaddrs (publisher Helia). */
const PIN_BY_HASH_URL = "https://api.pinata.cloud/pinning/pinByHash";
/** @deprecated Do not use for CDR vault ciphertext — UnixFS CID != raw vault CID. */
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

/** True if publish-time Pinata pin-by-CID can run. */
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
    "Pinata credentials missing. Set PINATA_API_KEY + PINATA_SECRET_KEY in skill-capture/.env " +
    "(required for pin-by-CID; JWT/file upload cannot preserve CDR vault CIDs)."
  );
}

/** Prefer addresses Pinata cloud can dial (skip loopback). */
export function hostNodesForPinata(multiaddrs: string[]): string[] {
  const dialable = multiaddrs.filter(
    (a) => !a.includes("/ip4/127.0.0.1/") && !a.includes("/ip6/::1/"),
  );
  return dialable.length > 0 ? dialable : multiaddrs;
}

/**
 * Ask Pinata to pin an existing IPFS CID (CDR vault raw block) by fetching from local Helia.
 * This preserves the exact vault CID — pinFileToIPFS cannot.
 */
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
    throw new Error(
      "No Helia multiaddrs for Pinata pin-by-CID. Keep Helia running until publish completes.",
    );
  }

  const body = {
    hashToPin: opts.cid,
    pinataMetadata: {
      name: `${opts.skillName}-ciphertext`,
      keyvalues: { skill: opts.skillName, source: "skill-capture", vaultCid: opts.cid },
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
    throw new Error(
      `Pinata pin-by-CID returned ${pinned}, expected vault CID ${opts.cid}`,
    );
  }

  const gatewayBase = resolvePublicIpfsGateway();
  log.ok(`Pinata pinned vault CID: ${opts.cid}`);
  log.info(`Buyer fetch: ${gatewayUrlForCid(gatewayBase, opts.cid)}`);
  return { gatewayBase };
}

/** @deprecated Use pinVaultCidOnPinata for CDR ciphertext. */
async function uploadViaApiKeys(
  bytes: Uint8Array,
  skillName: string,
  apiKey: string,
  secretKey: string,
): Promise<string> {
  const filename = `${skillName}.cdr`;
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(bytes)], { type: "application/octet-stream" }), filename);
  form.append(
    "pinataMetadata",
    JSON.stringify({
      name: `${skillName}-ciphertext`,
      keyvalues: { skill: skillName, source: "skill-capture" },
    }),
  );
  form.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));

  const res = await fetch(PIN_FILE_API_URL, {
    method: "POST",
    headers: {
      pinata_api_key: apiKey,
      pinata_secret_api_key: secretKey,
    },
    body: form,
    signal: AbortSignal.timeout(Number(process.env.PINATA_UPLOAD_TIMEOUT_MS ?? "120000")),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pinata pinFileToIPFS failed (${res.status}): ${text.slice(0, 400)}`);
  }

  const json = (await res.json()) as { IpfsHash?: string };
  const cid = json.IpfsHash;
  if (!cid) throw new Error("Pinata pinFileToIPFS: response missing IpfsHash");
  log.info("Pinata upload: pinFileToIPFS (API key)");
  return cid;
}

/** @deprecated Use pinVaultCidOnPinata for CDR ciphertext. */
async function uploadViaJwt(bytes: Uint8Array, skillName: string, jwt: string): Promise<string> {
  const form = new FormData();
  form.append("network", "public");
  form.append("name", `${skillName}-ciphertext`);
  form.append(
    "file",
    new Blob([new Uint8Array(bytes)], { type: "application/octet-stream" }),
    `${skillName}.cdr`,
  );

  const res = await fetch(PINATA_V3_UPLOAD_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` },
    body: form,
    signal: AbortSignal.timeout(Number(process.env.PINATA_UPLOAD_TIMEOUT_MS ?? "120000")),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pinata v3 upload failed (${res.status}): ${text.slice(0, 400)}`);
  }

  const json = (await res.json()) as { data?: { cid?: string } };
  const cid = json.data?.cid;
  if (!cid) throw new Error("Pinata v3 upload: response missing data.cid");
  log.info("Pinata upload: v3 JWT");
  return cid;
}

/**
 * Legacy file upload — produces UnixFS CIDs that do not match CDR vault raw blocks.
 * @deprecated
 */
export async function uploadCiphertextToPinata(
  bytes: Uint8Array,
  skillName: string,
): Promise<{ cid: string; gatewayBase: string }> {
  if (!pinataApiKeysConfigured() && !pinataJwtConfigured()) {
    throw new Error(pinataCredentialError());
  }

  const apiKey = process.env.PINATA_API_KEY?.trim();
  const secretKey = process.env.PINATA_SECRET_KEY?.trim();
  const jwt = process.env.PINATA_JWT?.trim();

  const cid =
    apiKey && secretKey
      ? await uploadViaApiKeys(bytes, skillName, apiKey, secretKey)
      : jwt
        ? await uploadViaJwt(bytes, skillName, jwt)
        : (() => {
            throw new Error(pinataCredentialError());
          })();

  const gatewayBase = resolvePublicIpfsGateway();
  log.ok(`Pinata public pin: ${cid} (${bytes.length} bytes)`);
  log.info(`Buyer fetch: ${gatewayUrlForCid(gatewayBase, cid)}`);

  return { cid, gatewayBase };
}
