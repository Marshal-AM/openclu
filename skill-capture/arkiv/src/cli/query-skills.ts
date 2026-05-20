import "dotenv/config";
import type { ListingStatus } from "../lib/constants.js";
import { searchNaturalLanguage } from "../services/query-catalog.js";
import { failCli, parseArgs } from "./cli-utils.js";

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const query = positional.join(" ").trim();
  const tag = typeof flags.tag === "string" ? flags.tag : undefined;
  const status = typeof flags.status === "string" ? (flags.status as ListingStatus) : undefined;
  const listingKey = typeof flags["listing-key"] === "string" ? flags["listing-key"] : undefined;
  const since = typeof flags.since === "string" ? Date.parse(flags.since) : undefined;
  const until = typeof flags.until === "string" ? Date.parse(flags.until) : undefined;
  const minScore = typeof flags["min-score"] === "string" ? Number(flags["min-score"]) : 0;

  if (!query && !tag && !status && !listingKey) {
    console.error(
      'Usage: npm run query -- "<natural language>" [--tag cursor] [--status published] [--since ISO] [--until ISO] [--listing-key 0x...] [--min-score 0.1]',
    );
    process.exit(1);
  }

  try {
    const matches = await searchNaturalLanguage(query, {
      tag,
      status,
      since: Number.isFinite(since) ? since : undefined,
      until: Number.isFinite(until) ? until : undefined,
      listingKey: listingKey as `0x${string}` | undefined,
    });

    const filtered = matches.filter((m) => m.score >= minScore);
    const output = {
      query: query || null,
      filters: { tag, status, since, until, listingKey, minScore },
      matchCount: filtered.length,
      matches: filtered,
    };
    console.log(JSON.stringify(output, null, 2));
  } catch (e) {
    failCli(e);
  }
}

main();
