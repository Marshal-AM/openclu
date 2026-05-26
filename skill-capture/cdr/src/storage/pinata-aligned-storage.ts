/**
 * CDR publish storage: Pinata pinFileToIPFS is the source of truth for the vault CID.
 * Free tier cannot pin-by-CID for raw bafkrei blocks; UnixFS addBytes often differs on large files.
 */
import type { StorageProvider, UploadOptions } from "@piplabs/cdr-sdk";
import { unixfs } from "@helia/unixfs";
import type { Helia } from "helia";
import { CID } from "multiformats/cid";
import {
  gatewayUrlForCid,
  resolvePublicIpfsGateway,
  uploadCiphertextToPinata,
} from "../pinata-ipfs.js";
import { log } from "../logger.js";

const PINATA_UNIXFS_OPTS = { cidVersion: 1 as const, rawLeaves: true };

function concatChunks(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

/** Process-local cache: vault CID → ciphertext bytes (until publish finishes). */
const uploadCache = new Map<string, Uint8Array>();

/**
 * Upload via Pinata first (returns public CID), cache bytes for download during publish.
 */
export function createPinataBackedStorage(helia: Helia, skillName: string): StorageProvider {
  const ufs = unixfs(helia);

  return {
    async upload(data: Uint8Array, _options?: UploadOptions): Promise<string> {
      log.info("Pinning ciphertext on Pinata (vault CID = Pinata CID)…");
      const pin = await uploadCiphertextToPinata(data, skillName);
      uploadCache.set(pin.cid, data);

      try {
        const local = await ufs.addBytes(data, PINATA_UNIXFS_OPTS);
        if (local.toString() === pin.cid) {
          await helia.pins.add(local);
          log.info("Local Helia UnixFS matches Pinata CID");
        }
      } catch {
        /* optional local copy */
      }

      return pin.cid;
    },

    async download(cidStr: string): Promise<Uint8Array> {
      const cached = uploadCache.get(cidStr);
      if (cached) return cached;

      try {
        const cid = CID.parse(cidStr);
        const chunks: Uint8Array[] = [];
        for await (const chunk of ufs.cat(cid)) {
          chunks.push(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk));
        }
        if (chunks.length) {
          const bytes = concatChunks(chunks);
          uploadCache.set(cidStr, bytes);
          return bytes;
        }
      } catch {
        /* fall through to gateway */
      }

      const url = gatewayUrlForCid(resolvePublicIpfsGateway(), cidStr);
      log.info(`Fetching ciphertext from gateway: ${url}`);
      const res = await fetch(url, {
        signal: AbortSignal.timeout(Number(process.env.PINATA_UPLOAD_TIMEOUT_MS ?? "120000")),
      });
      if (!res.ok) {
        throw new Error(`Gateway fetch failed (${res.status}) for ${cidStr}`);
      }
      const bytes = new Uint8Array(await res.arrayBuffer());
      uploadCache.set(cidStr, bytes);
      return bytes;
    },
  };
}

/** @deprecated Use createPinataBackedStorage */
export function createPinataAlignedStorage(helia: Helia, skillName: string): StorageProvider {
  return createPinataBackedStorage(helia, skillName);
}
