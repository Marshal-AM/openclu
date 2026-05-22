import { hasLocalPin } from "./helia-storage.js";
import { getHeliaPeerHints, getHeliaStorage } from "./helia-storage.js";

const LOCAL_PIN_TIMEOUT_MS = Number(process.env.LOCAL_BLOCKSTORE_TRY_MS ?? "8000");

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function pinBytesToHelia(data: Uint8Array): Promise<{ cid: string }> {
  const { storage } = await getHeliaStorage();
  const cid = await storage.upload(data, { pin: true });
  return { cid };
}

/** Fast local-only read — returns null if CID not pinned (no long Helia cat hang). */
export async function tryDownloadBytesFromHeliaLocal(cid: string): Promise<Uint8Array | null> {
  const { helia, storage } = await getHeliaStorage();
  const pinned = await hasLocalPin(helia, cid);
  if (!pinned) return null;
  try {
    return await Promise.race([
      storage.download(cid),
      sleep(LOCAL_PIN_TIMEOUT_MS).then(() => {
        throw new Error("local blockstore timeout");
      }),
    ]);
  } catch {
    return null;
  }
}

export async function downloadBytesFromHelia(cid: string): Promise<Uint8Array> {
  const local = await tryDownloadBytesFromHeliaLocal(cid);
  if (local?.length) return local;
  throw new Error("CID not in local blockstore");
}

export async function getServerPeerHints() {
  const { helia } = await getHeliaStorage();
  return getHeliaPeerHints(helia);
}
