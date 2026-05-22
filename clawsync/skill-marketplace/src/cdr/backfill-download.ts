const GATEWAY_TIMEOUT_MS = Number(process.env.IPFS_GATEWAY_TIMEOUT_MS ?? "20000");

const GATEWAYS = [
  process.env.IPFS_GATEWAY?.trim(),
  "https://ipfs.io/ipfs",
  "https://dweb.link/ipfs",
  "https://cloudflare-ipfs.com/ipfs",
  "https://gateway.pinata.cloud/ipfs",
].filter(Boolean) as string[];

export async function downloadViaGatewayForBackfill(cid: string): Promise<Uint8Array> {
  let last = 'no gateway';
  for (const base of GATEWAYS) {
    const url = `${base.replace(/\/$/, "")}/${cid}`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS) });
      if (!res.ok) {
        last = `HTTP ${res.status}`;
        continue;
      }
      return new Uint8Array(await res.arrayBuffer());
    } catch (e) {
      last = e instanceof Error ? e.message : String(e);
    }
  }
  throw new Error(last);
}
