import { getSupabaseAdmin } from "../client.js";
import { listingExpiresAt } from "../expiration.js";
import { wrapDbError } from "../errors.js";
import { fetchListings } from "./query.js";

export async function extendSkillListing(
  skillName: string,
): Promise<{ listingId: string; listingKey: string }> {
  const rows = await fetchListings({ skillSlug: skillName, limit: 1 });
  if (!rows.length) {
    throw new Error(`No catalog listing for skill "${skillName}"`);
  }
  const listingId = rows[0].listingId;
  try {
    const { error } = await getSupabaseAdmin()
      .from("catalog_listings")
      .update({ expires_at: listingExpiresAt(), updated_at: new Date().toISOString() })
      .eq("id", listingId);
    if (error) throw wrapDbError(error);
    return { listingId, listingKey: listingId };
  } catch (err) {
    throw wrapDbError(err);
  }
}
