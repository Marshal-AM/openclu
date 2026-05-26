/**
 * Pin ciphertext to public IPFS (Pinata) and set Arkiv ops.ipfsGatewayUrl.
 * Resolves skillListing first, then trainingDataListing.
 *
 * Usage (from clawsync):
 *   npm run repin-pinata -- cursor-usage
 *   npm run repin-pinata -- sitting-standing-example-jtxri
 *
 * Requires PINATA_API_KEY + PINATA_SECRET_KEY in clawsync/.env.
 */
import { loadClawsyncDotEnv } from '../convex/lib/clawsyncDotenv.ts';
import { repinSkillToPublicIpfs } from '../skill-marketplace/src/cdr/repin-public-ipfs.ts';

loadClawsyncDotEnv();

const skillName = process.argv[2]?.trim();
if (!skillName) {
  console.error('Usage: npm run repin-pinata -- <skill-name>');
  process.exit(1);
}

repinSkillToPublicIpfs({ skillName })
  .then((r) => {
    console.log(`\nDone: ${skillName}`);
    console.log(`  CID: ${r.cid}`);
    console.log(`  Gateway: ${r.ipfsGatewayUrl}`);
    console.log(`  Listing: ${r.listingKind}`);
    console.log(`  Bytes pinned: ${r.bytes}`);
  })
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
