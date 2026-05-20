import "dotenv/config";
import { getCatalogStats } from "../services/query-catalog.js";
import { failCli } from "./cli-utils.js";

async function main() {
  try {
    const stats = await getCatalogStats();
    console.log(JSON.stringify(stats, null, 2));
  } catch (e) {
    failCli(e);
  }
}

main();
