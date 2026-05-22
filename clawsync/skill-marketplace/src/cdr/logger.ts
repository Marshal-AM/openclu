const t0 = Date.now();

function stamp(): string {
  const s = ((Date.now() - t0) / 1000).toFixed(1);
  return `[+${s}s]`;
}

/** All progress logs go to stderr so stdout stays JSON-only for marketplace-cli. */
function writeStderr(line: string): void {
  console.error(line);
}

export const log = {
  info(msg: string) {
    writeStderr(`${stamp()} ${msg}`);
  },
  ok(msg: string) {
    writeStderr(`${stamp()} ✓ ${msg}`);
  },
  warn(msg: string) {
    writeStderr(`${stamp()} ⚠ ${msg}`);
  },
  err(msg: string) {
    writeStderr(`${stamp()} ✗ ${msg}`);
  },
  section(title: string) {
    writeStderr(`\n${stamp()} ── ${title} ${"─".repeat(Math.max(0, 50 - title.length))}`);
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
