import "./polyfill.js";
import "dotenv/config";
import cors from "cors";
import express, { type Request, type Response, type NextFunction } from "express";
import {
  readLocalRegistryBlob,
  writeLocalRegistryBlob,
} from "./blob-registry.js";
import {
  getServerPeerHints,
  pinBytesToHelia,
  tryDownloadBytesFromHeliaLocal,
} from "./storage-service.js";
import { isHeliaReady, whenHeliaReady } from "./helia-storage.js";
import type { SkillCdrListing } from "../arkiv/lib/cdr-listing.js";
import { getHeliaStorage, downloadFromIpfs } from "./helia-storage.js";
import type { HeliaProvider } from "@piplabs/cdr-sdk";

const PORT = Number(process.env.CDR_SERVER_PORT ?? "8787");
const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.use((req, _res, next) => {
  console.log(`[cdr] ${req.method} ${req.path}`);
  next();
});

function asyncRoute(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "clawsync-cdr-storage",
    port: PORT,
    heliaReady: isHeliaReady(),
    node: process.versions.node,
  });
});

/** Block API routes until Helia finished booting (prevents concurrent libp2p start). */
function requireHelia(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return asyncRoute(async (req, res, next) => {
    try {
      await whenHeliaReady();
      await fn(req, res, next);
    } catch (e) {
      next(e);
    }
  });
}

app.post(
  "/api/v1/storage/upload",
  express.raw({ type: "application/octet-stream", limit: "256mb" }),
  requireHelia(async (req, res) => {
    const data = req.body as Buffer;
    if (!data?.length) {
      res.status(400).json({ error: "Empty body" });
      return;
    }
    const { cid } = await pinBytesToHelia(new Uint8Array(data));
    res.json({ cid });
  }),
);

/** Marketplace ciphertext registry — buyers fetch here (no publisher Helia required). */
app.get("/api/v1/registry/:cid", async (req, res) => {
  const bytes = readLocalRegistryBlob(req.params.cid);
  if (!bytes?.length) {
    res.status(404).json({
      error: "Ciphertext not in registry. Publisher must re-publish or run backfill-registry.",
    });
    return;
  }
  res.setHeader("Content-Type", "application/octet-stream");
  res.send(Buffer.from(bytes));
});

app.put(
  "/api/v1/registry/:cid",
  express.raw({ type: "application/octet-stream", limit: "256mb" }),
  async (req, res) => {
    const data = req.body as Buffer;
    if (!data?.length) {
      res.status(400).json({ error: "Empty body" });
      return;
    }
    writeLocalRegistryBlob(req.params.cid, new Uint8Array(data));
    res.json({ ok: true, cid: req.params.cid, bytes: data.length });
  },
);

app.get(
  "/api/v1/storage/download/:cid",
  requireHelia(async (req, res) => {
    const registry = readLocalRegistryBlob(req.params.cid);
    if (registry?.length) {
      res.setHeader("Content-Type", "application/octet-stream");
      res.send(Buffer.from(registry));
      return;
    }
    const bytes = await tryDownloadBytesFromHeliaLocal(req.params.cid);
    if (!bytes?.length) {
      res.status(404).json({
        error: "CID not in registry or local blockstore; use POST /api/v1/storage/fetch",
      });
      return;
    }
    res.setHeader("Content-Type", "application/octet-stream");
    res.send(Buffer.from(bytes));
  }),
);

/** P2P fetch using Arkiv catalog listing (ops.heliaMultiaddrs) — Helia runs in this process only. */
app.post(
  "/api/v1/storage/fetch",
  requireHelia(async (req, res) => {
    const { cid, listing } = req.body as { cid?: string; listing?: SkillCdrListing };
    if (!cid || !listing?.helia_peer_id) {
      res.status(400).json({ error: "cid and listing (with helia_peer_id) required" });
      return;
    }
    const { helia, storage } = await getHeliaStorage();
    const bytes = await downloadFromIpfs(
      storage as HeliaProvider,
      helia,
      listing,
      cid,
    );
    res.setHeader("Content-Type", "application/octet-stream");
    res.send(Buffer.from(bytes));
  }),
);

app.get(
  "/api/v1/helia/peer-hints",
  requireHelia(async (_req, res) => {
    const hints = await getServerPeerHints();
    res.json({
      helia_peer_id: hints.helia_peer_id,
      helia_multiaddrs: hints.helia_multiaddrs,
    });
  }),
);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error("[cdr] request error:", err);
  if (!res.headersSent) res.status(500).json({ error: msg });
});

const nodeMajor = Number(process.versions.node.split(".")[0]);
if (nodeMajor < 20) {
  console.error(`Node ${process.versions.node} is too old — use Node 20+ (22+ recommended).`);
  process.exit(1);
}

process.on("unhandledRejection", (reason) => {
  console.error("[cdr] unhandledRejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[cdr] uncaughtException:", err);
});

async function main() {
  console.log(`[cdr] Booting Helia before accepting API traffic (Node ${process.versions.node})…`);
  if (nodeMajor < 22) {
    console.warn("[cdr] Node < 22: using Promise.withResolvers polyfill for Helia.");
  }
  await whenHeliaReady();
  console.log("[cdr] Helia boot complete — starting HTTP listener");

  const httpServer = app.listen(PORT, () => {
    console.log(`CDR server listening on http://127.0.0.1:${PORT}`);
    console.log("  GET  /health");
    console.log("  POST /api/v1/storage/upload");
    console.log("  GET  /api/v1/registry/:cid (marketplace ciphertext)");
    console.log("  PUT  /api/v1/registry/:cid");
    console.log("  GET  /api/v1/storage/download/:cid");
    console.log("  POST /api/v1/storage/fetch (catalog listing + cid)");
  });
  // Drop idle keep-alive sockets so long gaps (CLI capture) do not get ECONNRESET on reuse.
  httpServer.keepAliveTimeout = 5_000;
  httpServer.headersTimeout = 10_000;
}

main().catch((err) => {
  console.error("[cdr] fatal:", err);
  process.exit(1);
});
