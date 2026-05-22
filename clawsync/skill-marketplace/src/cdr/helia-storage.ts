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
import type { SkillCdrListing } from "../arkiv/lib/cdr-listing.js";
import { resolveHeliaDataDir } from "./repo-paths.js";

function heliaDataDir(): string {
  return resolveHeliaDataDir();
}
const IPFS_DOWNLOAD_TIMEOUT_MS = Number(process.env.IPFS_DOWNLOAD_TIMEOUT_MS ?? "120000");
const PEER_DIAL_TIMEOUT_MS = Number(process.env.PEER_DIAL_TIMEOUT_MS ?? "20000");
const HELIA_BOOT_TIMEOUT_MS = Number(process.env.HELIA_BOOT_TIMEOUT_MS ?? "120000");
const LOCAL_BLOCKSTORE_TRY_MS = Number(process.env.LOCAL_BLOCKSTORE_TRY_MS ?? "8000");

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

/** Stop in-process Helia without touching on-disk blocks. */
export async function stopHeliaInstance(): Promise<void> {
  if (heliaInstance) {
    log.info("Stopping Helia node...");
    await heliaInstance.stop();
    heliaInstance = null;
    heliaBoot = null;
    log.ok("Helia stopped");
  }
}

/** Stop Helia and delete the on-disk blockstore (blocks only — no LevelDB). */
export async function resetHeliaStore(): Promise<void> {
  await stopHeliaInstance();
  const dir = heliaDataDir();
  rmSync(dir, { recursive: true, force: true });
  log.ok(`Deleted ${dir}`);
}

/** Await exactly one Helia/libp2p startup for this process. */
export function whenHeliaReady(): Promise<Helia> {
  if (heliaInstance) return Promise.resolve(heliaInstance);
  if (!heliaBoot) {
    heliaBoot = (async () => {
      const dataDir = heliaDataDir();
      log.info(`Opening Helia blockstore at ${dataDir}/blocks`);
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
  const blockPath = resolve(heliaDataDir(), "blocks");
  mkdirSync(blockPath, { recursive: true });

  log.info("  → opening FS blockstore (encrypted blobs)...");
  const blockstore = new FsBlockstore(blockPath);
  await blockstore.open();

  log.info("  → libp2p datastore: in-memory (avoids Windows LevelDB locks)");
  const datastore = new MemoryDatastore();

      log.info("  → starting libp2p / Helia...");
      return Promise.race([
        createHelia({ blockstore, datastore }),
        sleep(HELIA_BOOT_TIMEOUT_MS).then(() => {
          throw new Error(`Helia/libp2p boot timed out after ${HELIA_BOOT_TIMEOUT_MS}ms`);
        }),
      ]);
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

/** Higher score = try first. Prefer public relay circuit paths from Arkiv ops.heliaMultiaddrs. */
function rankPublisherAddrs(addrs: string[]): string[] {
  const score = (a: string): number => {
    if (a.includes("bootstrap.libp2p")) return 0;
    if (a.includes("127.0.0.1") || a.includes("/ip6/::1")) return 5;
    if (/\/ip4\/(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(a)) return 15;
    if (a.includes("p2p-circuit")) return 90;
    if (a.includes("/quic") || a.includes("/tcp/")) return 60;
    return 40;
  };
  return [...addrs].sort((a, b) => score(b) - score(a));
}

function filterPublisherAddrs(addrs: string[], peerId: string): string[] {
  return addrs.filter((a) => {
    if (!a.includes(peerId)) return false;
    if (a.includes("bootstrap.libp2p")) return false;
    return true;
  });
}

export async function dialPublisherPeers(
  helia: Helia,
  listing: SkillCdrListing,
): Promise<void> {
  const peerId = listing.helia_peer_id;
  if (!peerId) {
    throw new Error(`Arkiv listing missing helia_peer_id for "${listing.skill_name}"`);
  }

  const addrs = rankPublisherAddrs(
    filterPublisherAddrs(listing.helia_multiaddrs ?? [], peerId),
  );
  if (!addrs.length) {
    throw new Error(
      `No dialable multiaddrs for publisher ${peerId} in Arkiv catalog ops.heliaMultiaddrs.`,
    );
  }

  log.info(
    `Dialing publisher ${peerId} (${addrs.length} addr(s), ${PEER_DIAL_TIMEOUT_MS}ms cap each; relay/circuit first)`,
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
    throw new Error(`Vault CID ${cid} != Arkiv catalog CID ${listing.cid}. Re-publish.`);
  }

  const t = Date.now();
  log.info(`Helia cat() for ${cid}`);

  try {
    const local = await Promise.race([
      storage.download(cid),
      sleep(LOCAL_BLOCKSTORE_TRY_MS).then(() => {
        throw new Error("local blockstore timeout");
      }),
    ]);
    log.ok(`Local blockstore: ${local.length} bytes (${Date.now() - t}ms)`);
    return local;
  } catch (e) {
    log.info(
      `Not in local blockstore (${e instanceof Error ? e.message : e}) — dial Arkiv publisher`,
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
