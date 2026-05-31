import "./polyfill.js";
import { HeliaProvider } from "@piplabs/cdr-sdk";
import { multiaddr } from "@multiformats/multiaddr";
import { FsBlockstore } from "blockstore-fs";
import { MemoryDatastore } from "datastore-core";
import { createHelia, type Helia } from "helia";
import { unixfs } from "@helia/unixfs";
import { CID } from "multiformats/cid";
import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { log } from "./logger.js";
import type { SkillCdrListing } from "../../db/src/catalog/cdr-listing.js";

const HELIA_DATA_DIR = resolve(process.cwd(), ".helia-data");
const IPFS_DOWNLOAD_TIMEOUT_MS = Number(process.env.IPFS_DOWNLOAD_TIMEOUT_MS ?? "120000");
const PEER_DIAL_TIMEOUT_MS = Number(process.env.PEER_DIAL_TIMEOUT_MS ?? "15000");

export interface HeliaPeerHints {
  helia_peer_id: string;
  helia_multiaddrs: string[];
}

let heliaInstance: Helia | null = null;
/** Single-flight boot — concurrent callers must share one libp2p start (crashes on Windows if doubled). */
let heliaBoot: Promise<Helia> | null = null;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function hasLocalPin(helia: Helia, cidStr: string): Promise<boolean> {
  try {
    const cid = CID.parse(cidStr);
    return await helia.pins.isPinned(cid);
  } catch {
    return false;
  }
}

export function getHeliaPeerHints(helia: Helia): HeliaPeerHints {
  const helia_peer_id = helia.libp2p.peerId.toString();
  const helia_multiaddrs = helia.libp2p.getMultiaddrs().map((a) => a.toString());
  return { helia_peer_id, helia_multiaddrs };
}

/** Stop Helia and delete the on-disk blockstore (blocks only — no LevelDB). */
export async function resetHeliaStore(): Promise<void> {
  if (heliaInstance) {
    log.info("Stopping Helia node...");
    await heliaInstance.stop();
    heliaInstance = null;
    heliaBoot = null;
    log.ok("Helia stopped");
  }
  rmSync(HELIA_DATA_DIR, { recursive: true, force: true });
  log.ok(`Deleted ${HELIA_DATA_DIR}`);
}

/** Await exactly one Helia/libp2p startup for this process. */
export function whenHeliaReady(): Promise<Helia> {
  if (heliaInstance) return Promise.resolve(heliaInstance);
  if (!heliaBoot) {
    heliaBoot = (async () => {
      log.info(`Opening Helia blockstore at ${HELIA_DATA_DIR}/blocks`);
      log.info("(First open ~30–90s on Windows while libp2p starts)");
      const t = Date.now();
      const helia = await openHeliaNode();
      heliaInstance = helia;
      log.ok(`Helia ready (${Date.now() - t}ms total)`);
      const hints = getHeliaPeerHints(helia);
      log.info(`Local peer id: ${hints.helia_peer_id}`);
      log.info(`Local multiaddrs: ${hints.helia_multiaddrs.join(", ") || "(none)"}`);
      return helia;
    })().catch((err) => {
      heliaBoot = null;
      heliaInstance = null;
      throw err;
    });
  }
  return heliaBoot;
}

export function isHeliaReady(): boolean {
  return heliaInstance !== null;
}

async function openHeliaNode(): Promise<Helia> {
  const blockPath = resolve(HELIA_DATA_DIR, "blocks");
  mkdirSync(blockPath, { recursive: true });

  log.info("  → opening FS blockstore (encrypted blobs)...");
  const blockstore = new FsBlockstore(blockPath);
  await blockstore.open();

  log.info("  → libp2p datastore: in-memory (avoids Windows LevelDB locks)");
  const datastore = new MemoryDatastore();

  log.info("  → starting libp2p / Helia...");
  return createHelia({ blockstore, datastore });
}

export async function getHeliaStorage(): Promise<{
  helia: Helia;
  storage: HeliaProvider;
}> {
  const had = heliaInstance !== null;
  const helia = await whenHeliaReady();
  if (had) log.info("Reusing Helia node in this process");
  const storage = new HeliaProvider({
    helia,
    unixfs: unixfs(helia),
    CID: (s: string) => CID.parse(s),
  });
  return { helia, storage };
}

function rankPublisherAddrs(addrs: string[]): string[] {
  const score = (a: string): number => {
    if (a.includes("127.0.0.1")) return 0;
    if (a.includes("/ip4/10.") || a.includes("/ip4/192.168.")) return 1;
    if (a.includes("/tcp/") && !a.includes("p2p-circuit")) return 2;
    return 9;
  };
  return [...addrs].sort((a, b) => score(a) - score(b));
}

function filterPublisherAddrs(addrs: string[], peerId: string): string[] {
  return addrs.filter((a) => {
    if (!a.includes(`/p2p/${peerId}`)) return false;
    if (a.includes("p2p-circuit") || a.includes("bootstrap.libp2p")) return false;
    return true;
  });
}

export async function dialPublisherPeers(
  helia: Helia,
  listing: SkillCdrListing,
): Promise<void> {
  const peerId = listing.helia_peer_id;
  if (!peerId) {
    throw new Error(`Catalog listing missing helia_peer_id for "${listing.skill_name}"`);
  }

  const addrs = rankPublisherAddrs(
    filterPublisherAddrs(listing.helia_multiaddrs ?? [], peerId),
  );
  if (!addrs.length) {
    throw new Error(
      `No direct multiaddrs for publisher ${peerId}. Re-publish.`,
    );
  }

  log.info(
    `Dialing publisher ${peerId} (${addrs.length} direct addr(s), ${PEER_DIAL_TIMEOUT_MS}ms cap each)`,
  );

  let connected = 0;
  const errors: string[] = [];

  for (const addr of addrs) {
    const t = Date.now();
    try {
      const ma = multiaddr(addr);
      const connection = await Promise.race([
        helia.libp2p.dial(ma),
        sleep(PEER_DIAL_TIMEOUT_MS).then(() => {
          throw new Error(`dial timeout after ${PEER_DIAL_TIMEOUT_MS}ms`);
        }),
      ]);
      connected++;
      log.ok(`dialed ${addr} (${Date.now() - t}ms, peer=${connection.remotePeer.toString()})`);
      break;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${addr}: ${msg}`);
      log.warn(`dial failed ${addr} (${Date.now() - t}ms): ${msg}`);
    }
  }

  if (connected === 0) {
    throw new Error(
      `Could not dial publisher for "${listing.skill_name}". Re-publish on this machine.\n` +
        errors.map((e) => `  - ${e}`).join("\n"),
    );
  }

  log.ok("Publisher peer connection ready");
}

export async function downloadFromIpfs(
  storage: HeliaProvider,
  helia: Helia,
  listing: SkillCdrListing,
  cid: string,
): Promise<Uint8Array> {
  if (cid !== listing.cid) {
    throw new Error(`Vault CID ${cid} != Catalog CID ${listing.cid}. Re-publish.`);
  }

  const t = Date.now();
  log.info(`Helia cat() for ${cid}`);

  // Publish wrote to cdr/.helia-data/blocks — try local FS store first
  try {
    const local = await Promise.race([
      storage.download(cid),
      sleep(20_000).then(() => {
        throw new Error("local blockstore timeout");
      }),
    ]);
    log.ok(`Local blockstore: ${local.length} bytes (${Date.now() - t}ms)`);
    return local;
  } catch (e) {
    log.info(
      `Not in local blockstore (${e instanceof Error ? e.message : e}) — dial contributor publisher`,
    );
  }

  await dialPublisherPeers(helia, listing);

  const bytes = await Promise.race([
    storage.download(cid),
    sleep(IPFS_DOWNLOAD_TIMEOUT_MS).then(() => {
      throw new Error(`Helia cat() timed out after ${IPFS_DOWNLOAD_TIMEOUT_MS}ms`);
    }),
  ]);

  log.ok(`Downloaded ${bytes.length} bytes (${Date.now() - t}ms)`);
  return bytes;
}

export async function uploadJsonToIpfs(
  obj: unknown,
  storageProvider?: import("@piplabs/cdr-sdk").StorageProvider,
): Promise<string> {
  const storage = storageProvider ?? (await getHeliaStorage()).storage;
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  return storage.upload(bytes, { pin: true });
}
