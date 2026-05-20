import type { StorageProvider, UploadOptions } from "@piplabs/cdr-sdk";

/** POST encrypted bytes to a running CDR server's Helia node. */
export class RemoteHeliaStorage implements StorageProvider {
  constructor(private readonly baseUrl: string) {}

  private url(path: string) {
    return `${this.baseUrl.replace(/\/$/, "")}${path}`;
  }

  async upload(data: Uint8Array, _options?: UploadOptions): Promise<string> {
    const res = await fetch(this.url("/api/v1/storage/upload"), {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        Connection: "close",
      },
      body: Buffer.from(data),
      keepalive: false,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`CDR storage upload failed (${res.status}): ${text}`);
    }
    const json = (await res.json()) as { cid: string };
    if (!json.cid) throw new Error("CDR storage upload: missing cid");
    return json.cid;
  }

  async download(cid: string): Promise<Uint8Array> {
    const res = await fetch(this.url(`/api/v1/storage/download/${encodeURIComponent(cid)}`), {
      headers: { Connection: "close" },
      keepalive: false,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`CDR storage download failed (${res.status}): ${text}`);
    }
    return new Uint8Array(await res.arrayBuffer());
  }
}
