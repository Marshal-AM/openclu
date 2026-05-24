import {
  catalogQuery,
  catalogQueryTraining,
  catalogGetSkillDetail,
  catalogGetTrainingDetail,
  catalogStats,
  type CatalogQueryBody,
} from "../arkiv/catalog-read-bridge.js";

const cmd = process.argv[2];

function parseJsonArg(): Record<string, unknown> {
  const fromEnv = process.env.SKILL_MARKETPLACE_JSON?.trim();
  if (fromEnv) return JSON.parse(fromEnv) as Record<string, unknown>;
  const raw = process.argv.slice(3).join(" ").trim() || "{}";
  return JSON.parse(raw) as Record<string, unknown>;
}

async function main() {
  if (cmd === "query") {
    const body = parseJsonArg() as CatalogQueryBody;
    console.log(JSON.stringify(await catalogQuery(body)));
    return;
  }
  if (cmd === "get-detail") {
    const slug = process.argv[3];
    if (!slug) throw new Error("skill slug required");
    console.log(JSON.stringify(await catalogGetSkillDetail(slug)));
    return;
  }
  if (cmd === "stats") {
    const { scope, ownerAddress } = parseJsonArg() as {
      scope?: "marketplace" | "mine";
      ownerAddress?: string;
    };
    console.log(JSON.stringify(await catalogStats(scope ?? "marketplace", ownerAddress)));
    return;
  }
  if (cmd === "query-training") {
    const body = parseJsonArg() as CatalogQueryBody;
    console.log(JSON.stringify(await catalogQueryTraining(body)));
    return;
  }
  if (cmd === "get-training-detail") {
    const slug = process.argv[3];
    if (!slug) throw new Error("training slug required");
    console.log(JSON.stringify(await catalogGetTrainingDetail(slug)));
    return;
  }
  if (cmd === "purchase-training") {
    const { log } = await import("../cdr/logger.js");
    const { purchaseSkillFromListing } = await import("../cdr/purchase-from-listing.js");
    const { requireAgentPrivateKey } = await import("../arkiv/lib/agent-wallet.js");
    const { fetchTrainingListings } = await import("../arkiv/services/query-catalog.js");
    const { skillName, outputDir, catalogSnapshot } = parseJsonArg() as {
      skillName: string;
      outputDir: string;
      catalogSnapshot?: { entityKey: string; payload: unknown };
    };
    if (!skillName || !outputDir) {
      throw new Error("purchase-training requires skillName and outputDir");
    }
    log.section(`Purchase training data: ${skillName}`);
    const privateKey = requireAgentPrivateKey();
    let snapshot = catalogSnapshot;
    if (!snapshot) {
      const rows = await fetchTrainingListings({ skillSlug: skillName, limit: 1 });
      if (!rows.length) throw new Error(`No training listing for "${skillName}"`);
      snapshot = { entityKey: rows[0].entityKey, payload: rows[0].payload };
    }
    const result = await purchaseSkillFromListing({
      skillName,
      privateKey,
      outputDir,
      catalogSnapshot: snapshot,
    });
    console.log(JSON.stringify(result));
    return;
  }
  if (cmd === "purchase") {
    const { log } = await import("../cdr/logger.js");
    const { purchaseSkillFromListing } = await import("../cdr/purchase-from-listing.js");
    const { requireAgentPrivateKey } = await import("../arkiv/lib/agent-wallet.js");
    const { skillName, outputDir, catalogSnapshot } = parseJsonArg() as {
      skillName: string;
      outputDir: string;
      catalogSnapshot?: { entityKey: string; payload: unknown };
    };
    if (!skillName || !outputDir) {
      throw new Error("purchase requires skillName and outputDir");
    }
    log.section(`Purchase: ${skillName}`);
    log.info(`Output dir: ${outputDir}`);
    const privateKey = requireAgentPrivateKey();
    const result = await purchaseSkillFromListing({
      skillName,
      privateKey,
      outputDir,
      catalogSnapshot,
    });
    console.log(JSON.stringify(result));
    return;
  }
  if (cmd === "wallet-address") {
    const { getAgentBuyerAddress } = await import("../arkiv/lib/agent-wallet.js");
    console.log(
      JSON.stringify({
        configured: Boolean(process.env.AGENT_PRIVATE_KEY?.trim()),
        address: getAgentBuyerAddress(),
      }),
    );
    return;
  }
  console.error(
    "Usage: marketplace-cli.ts query|get-detail|stats|purchase|wallet-address <args>",
  );
  process.exit(1);
}

main().catch((e) => {
  console.error(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }));
  process.exit(1);
});
