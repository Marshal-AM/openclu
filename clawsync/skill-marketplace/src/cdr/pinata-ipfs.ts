import { log } from "./logger.js";

const PIN_FILE_API_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";
const PIN_BY_HASH_URL = "https://api.pinata.cloud/pinning/pinByHash";
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
  return pinataApiKeysConfigured() || pinataJwtConfigured();
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

export function publicGatewayFetchInit(): RequestInit {
  return {
    headers: {
      Accept: "*/*",
      "User-Agent":
        process.env.IPFS_GATEWAY_USER_AGENT?.trim() ||
        "Mozilla/5.0 (compatible; clawsync/1.0)",
    },
  };
}

export async function fetchPublicGateway(
  url: string,
  timeoutMs = Number(process.env.PUBLIC_GATEWAY_VERIFY_TIMEOUT_MS ?? "60000"),
): Promise<Response> {
  return fetch(url, {
    ...publicGatewayFetchInit(),
    signal: AbortSignal.timeout(timeoutMs),
  });
}

function pinataCredentialError(): string {
  return (
    "Pinata credentials missing. Set PINATA_API_KEY + PINATA_SECRET_KEY in clawsync/.env " +
    "(preferred) or PINATA_JWT."
  );
}

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
      keyvalues: { skill: skillName, source: "clawsync" },
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

export async function uploadCiphertextToPinata(
  bytes: Uint8Array,
  skillName: string,
): Promise<{ cid: string; gatewayBase: string }> {
  if (!pinataConfigured()) throw new Error(pinataCredentialError());

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
  return { cid, gatewayBase };
}
