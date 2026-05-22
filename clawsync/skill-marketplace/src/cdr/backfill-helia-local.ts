import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { FsBlockstore } from 'blockstore-fs';
import { CID } from 'multiformats/cid';

/** Read pinned block bytes directly from disk — never deletes or resets Helia stores. */
export async function tryDownloadFromLocalHeliaStores(cid: string): Promise<Uint8Array | null> {
  const candidates: string[] = [];
  if (process.env.CLAWSYNC_ROOT?.trim()) {
    candidates.push(resolve(process.env.CLAWSYNC_ROOT.trim(), 'data', '.helia-data', 'blocks'));
  }
  candidates.push(
    resolve(process.cwd(), 'data', '.helia-data', 'blocks'),
    resolve(process.cwd(), '..', 'skill-capture', 'cdr', '.helia-data', 'blocks'),
    resolve(process.cwd(), '..', '..', 'skill-capture', 'cdr', '.helia-data', 'blocks'),
  );

  let parsed: CID;
  try {
    parsed = CID.parse(cid);
  } catch {
    return null;
  }

  for (const blockPath of candidates) {
    if (!existsSync(blockPath)) continue;
    const bs = new FsBlockstore(blockPath);
    try {
      await bs.open();
      if (!(await bs.has(parsed))) {
        await bs.close();
        continue;
      }
      const block = await bs.get(parsed);
      await bs.close();
      if (block?.bytes?.length) return block.bytes;
    } catch {
      try {
        await bs.close();
      } catch {
        /* ignore */
      }
    }
  }
  return null;
}
