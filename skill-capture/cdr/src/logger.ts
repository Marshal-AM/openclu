const t0 = Date.now();

function stamp(): string {
  const s = ((Date.now() - t0) / 1000).toFixed(1);
  return `[+${s}s]`;
}

export const log = {
  info(msg: string) {
    console.log(`${stamp()} ${msg}`);
  },
  ok(msg: string) {
    console.log(`${stamp()} ✓ ${msg}`);
  },
  warn(msg: string) {
    console.warn(`${stamp()} ⚠ ${msg}`);
  },
  err(msg: string) {
    console.error(`${stamp()} ✗ ${msg}`);
  },
  section(title: string) {
    console.log(`\n${stamp()} ── ${title} ${"─".repeat(Math.max(0, 50 - title.length))}`);
  },
};

export async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  log.info(`START: ${label}`);
  const start = Date.now();
  try {
    const result = await fn();
    log.ok(`DONE: ${label} (${Date.now() - start}ms)`);
    return result;
  } catch (e) {
    log.err(`FAIL: ${label} (${Date.now() - start}ms)`);
    throw e;
  }
}
