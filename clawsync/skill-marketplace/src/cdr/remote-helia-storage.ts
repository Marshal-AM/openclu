import type { StorageProvider, UploadOptions } from "@piplabs/cdr-sdk";
import type { SkillCdrListing } from "../arkiv/lib/cdr-listing.js";

/** HTTP client for a running `npm run cdr-storage` Helia node (no libp2p boot in purchase). */
export class RemoteHeliaStorage implements StorageProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly listing?: SkillCdrListing,
  ) {}

  private url(path: string): string {
    return `${this.baseUrl.replace(/\/$/, "")}${path}`;
  }

  async upload(data: Uint8Array, _options?: UploadOptions): Promise<string> {
    const res = await fetch(this.url("/api/v1/storage/upload"), {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: Buffer.from(data),
    });
    if (!res.ok) {
      throw new Error(`CDR storage upload failed (${res.status}): ${await res.text()}`);
    }
    const json = (await res.json()) as { cid: string };
    if (!json.cid) throw new Error("CDR storage upload: missing cid");
    return json.cid;
  }

  async download(cid: string): Promise<Uint8Array> {
    const cached = await fetch(
      this.url(`/api/v1/storage/download/${encodeURIComponent(cid)}`),
    );
    if (cached.ok) {
      return new Uint8Array(await cached.arrayBuffer());
    }

    if (this.listing) {
      const res = await fetch(this.url("/api/v1/storage/fetch"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cid, listing: this.listing }),
      });
      if (!res.ok) {
        throw new Error(`CDR storage fetch failed (${res.status}): ${await res.text()}`);
      }
      return new Uint8Array(await res.arrayBuffer());
    }

    throw new Error(
      `CDR storage download failed (${cached.status}): ${await cached.text()}`,
    );
  }
}
