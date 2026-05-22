import {
  catalogQuery,
  catalogGetSkill,
  catalogGetSkillDetail,
  catalogStats,
} from "../catalog-read-bridge.js";

const cmd = process.argv[2];

/** Prefer env (set by Next.js catalog.ts) — avoids Windows argv quote-stripping. */
function parseJsonArg(): Record<string, unknown> {
  const fromEnv = process.env.SKILL_CAPTURE_CATALOG_JSON?.trim();
  if (fromEnv) return JSON.parse(fromEnv) as Record<string, unknown>;

  const raw = process.argv.slice(3).join(" ").trim() || "{}";
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    const fixed = raw.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)(\s*:)/g, '$1"$2"$3');
    return JSON.parse(fixed) as Record<string, unknown>;
  }
}

async function main() {
  if (cmd === "query") {
    const body = parseJsonArg();
    console.log(JSON.stringify(await catalogQuery(body)));
    return;
  }
  if (cmd === "get") {
    const slug = process.argv[3];
    if (!slug) {
      console.error(JSON.stringify({ error: "skill slug required" }));
      process.exit(1);
    }
    console.log(JSON.stringify(await catalogGetSkill(slug)));
    return;
  }
  if (cmd === "get-detail") {
    const slug = process.argv[3];
    if (!slug) {
      console.error(JSON.stringify({ error: "skill slug required" }));
      process.exit(1);
    }
    console.log(JSON.stringify(await catalogGetSkillDetail(slug)));
    return;
  }
  if (cmd === "stats") {
    const { scope, ownerAddress } = parseJsonArg() as {
      scope?: string;
      ownerAddress?: string;
    };
    console.log(JSON.stringify(await catalogStats(scope, ownerAddress)));
    return;
  }
  console.error("Usage: catalog-query-cli.ts query|get|stats <json-or-slug>");
  process.exit(1);
}

main().catch((e) => {
  console.error(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }));
  process.exit(1);
});
