/**
 * Smoke test for marketplace CLI bridge (run from clawsync: node scripts/test-marketplace-cli.mjs)
 */
import { runMarketplaceCli } from '../convex/lib/marketplaceCli.ts';

const wallet = await runMarketplaceCli('wallet-address');
console.log('wallet-address:', wallet);

const query = await runMarketplaceCli('query', {
  scope: 'marketplace',
  query: 'test',
  minScore: 0,
});
console.log('query matchCount:', query.matchCount);

console.log('OK');
