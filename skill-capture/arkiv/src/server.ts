import "dotenv/config";
import cors from "cors";
import express from "express";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Hex } from "viem";
import { buildOpsFromManifest } from "./lib/listing-ops.js";
import type { CdrManifest } from "./lib/types.js";
import { fetchSkillListingFromArkiv } from "./lib/cdr-listing.js";
import { getCreatorWallet } from "./lib/client.js";
import { publishCatalogToArkiv } from "./services/publish-catalog.js";
import { searchNaturalLanguage } from "./services/query-catalog.js";

const PORT = Number(process.env.ARKIV_SERVER_PORT ?? "8788");
const app = express();

app.use(cors());
app.use(express.json({ limit: "4mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "skill-capture-arkiv", port: PORT });
});

/** Full catalog upsert — references + SKILL.md text only (no encrypted bundle). */
app.post("/api/v1/catalog/upsert", async (req, res) => {
  try {
    const body = req.body as {
      skillName?: string;
      manifest?: CdrManifest & {
        heliaPeerId?: string;
        heliaMultiaddrs?: string[];
        encryptedSizeBytes?: number;
        readCondition?: string;
        writeCondition?: string;
        licenseToken?: string;
        storyApiUrl?: string;
        rpcUrl?: string;
        publisherAddress?: Hex;
      };
      bundleDir?: string;
      skillMd?: string;
    };

    if (!body.skillName || !body.manifest) {
      res.status(400).json({ error: "skillName and manifest required" });
      return;
    }

    const bundleDir =
      body.bundleDir ?? resolve(process.cwd(), "..", "skills", body.skillName);

    if (body.skillMd) {
      const skillPath = resolve(bundleDir, "SKILL.md");
      mkdirSync(bundleDir, { recursive: true });
      writeFileSync(skillPath, body.skillMd, "utf-8");
    }

    const ops = buildOpsFromManifest(body.manifest);
    const manifest = { ...body.manifest, skillName: body.skillName };
    const publisher = body.manifest.publisherAddress ?? getCreatorWallet();

    console.log(`[arkiv] Catalog upsert: ${body.skillName}…`);
    const result = await publishCatalogToArkiv({
      skillName: body.skillName,
      manifest,
      bundleDir,
      publisherAddress: publisher,
      ops,
    });

    console.log(`[arkiv] Listing key: ${result.listingKey} (v${result.version}, ${result.tagCount} tags)`);
    console.log(`[arkiv] Entities tx: ${result.txHash}`);
    if (result.listingTxHash) console.log(`[arkiv] Listing tx: ${result.listingTxHash}`);
    console.log(`[arkiv] Explorer: ${result.urls.entitiesTx}`);

    res.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: msg });
  }
});

app.get("/api/v1/catalog/:skillName", async (req, res) => {
  try {
    const listing = await fetchSkillListingFromArkiv(req.params.skillName);
    res.json(listing);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(404).json({ error: msg });
  }
});

app.post("/api/v1/catalog/query", async (req, res) => {
  try {
    const { query, tag } = req.body as { query?: string; tag?: string };
    const matches = await searchNaturalLanguage(query ?? "", tag ? { tag } : {});
    res.json({ matchCount: matches.length, matches });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: msg });
  }
});

app.listen(PORT, () => {
  console.log(`Arkiv server listening on http://127.0.0.1:${PORT}`);
});
