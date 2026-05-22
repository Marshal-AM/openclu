/**
 * @deprecated Use `npm run repin-pinata -- <skill>`.
 */
const skill = process.argv[2];
console.warn('backfill-registry is deprecated — forwarding to repin-pinata\n');
if (!skill || skill.startsWith('-')) {
  console.error('Usage: npm run repin-pinata -- <skill-name>');
  process.exit(1);
}
process.argv = [process.argv[0]!, process.argv[1]!, skill];
await import('./repin-skill-pinata.ts');
