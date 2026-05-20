import type { Hex } from "viem";
import { createArkivWalletClient } from "../lib/client.js";
import { listingExpiresIn } from "../lib/expiration.js";
import { wrapArkivError } from "../lib/errors.js";
import { fetchListings } from "./query-catalog.js";

export async function extendSkillListing(skillName: string): Promise<{ listingKey: string; txHash: string }> {
  const rows = await fetchListings({ skillSlug: skillName, limit: 1 });
  if (!rows.length) {
    throw new Error(`No Arkiv listing for skill "${skillName}"`);
  }
  const listingKey = rows[0].entityKey as Hex;
  const wallet = createArkivWalletClient();
  try {
    const { txHash } = await wallet.extendEntity({
      entityKey: listingKey,
      expiresIn: listingExpiresIn(),
    });
    return { listingKey, txHash };
  } catch (err) {
    throw wrapArkivError(err);
  }
}
