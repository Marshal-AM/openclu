import { type ChildProcess } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { SKILL_CAPTURE_ROOT, resolveVenvPython, spawnVenvPython } from "../../lib/spawn-util.js";

const ENV_FILE = resolve(SKILL_CAPTURE_ROOT, ".env");
const TUNNEL_SCRIPT = resolve(SKILL_CAPTURE_ROOT, "scripts/ngrok_tunnel.py");

let ngrokChild: ChildProcess | null = null;

function persistPublicUrl(publicUrl: string): void {
  const line = `ORCHESTRATOR_PUBLIC_URL=${publicUrl}`;
  if (!existsSync(ENV_FILE)) {
    writeFileSync(ENV_FILE, `${line}\n`, "utf8");
    return;
  }
  const lines = readFileSync(ENV_FILE, "utf8").split(/\r?\n/);
  let found = false;
  const out: string[] = [];
  for (const l of lines) {
    if (/^ORCHESTRATOR_PUBLIC_URL=/.test(l)) {
      out.push(line);
      found = true;
    } else {
      out.push(l);
    }
  }
  if (!found) out.push(line);
  writeFileSync(ENV_FILE, `${out.join("\n").replace(/\n+$/, "")}\n`, "utf8");
}

/** Spawn pyngrok daemon; resolves when first JSON line with public_url is printed. */
export function startNgrokTunnel(port: number): Promise<string | null> {
  if (process.env.NGROK_DISABLED === "1") {
    console.warn("NGROK_DISABLED=1 - skipping tunnel");
    return Promise.resolve(null);
  }
  if (!process.env.NGROK_AUTHTOKEN?.trim()) {
    console.warn(
      `NGROK_AUTHTOKEN not set in ${ENV_FILE} - no public URL (add token from ngrok dashboard)`,
    );
    return Promise.resolve(null);
  }

  return new Promise((resolvePromise) => {
    const child = spawnVenvPython(TUNNEL_SCRIPT, ["--port", String(port), "--daemon"], {
      env: process.env,
    });
    ngrokChild = child;

    let buf = "";
    let settled = false;
    const finish = (url: string | null) => {
      if (settled) return;
      settled = true;
      resolvePromise(url);
    };

    const handleChunk = (chunk: Buffer) => {
      buf += chunk.toString();
      for (const line of buf.split(/\r?\n/)) {
        const t = line.trim();
        if (!t.startsWith("{")) continue;
        try {
          const j = JSON.parse(t) as { public_url?: string; error?: string };
          if (j.public_url) {
            const url = j.public_url.replace(/\/$/, "");
            persistPublicUrl(url);
            finish(url);
            return;
          }
          if (j.error) {
            console.warn(`ngrok: ${j.error}`);
            finish(null);
            return;
          }
        } catch {
          /* wait for complete JSON line */
        }
      }
    };

    child.stdout?.on("data", handleChunk);
    child.stderr?.on("data", (d) => {
      const msg = d.toString().trim();
      if (msg) console.warn(`[ngrok] ${msg}`);
    });
    child.on("error", (err) => {
      console.warn(`ngrok process error: ${err.message}`);
      finish(null);
    });
    child.on("exit", (code) => {
      ngrokChild = null;
      if (!settled) finish(null);
      else if (code && code !== 0) console.warn(`ngrok process exited (${code})`);
    });

    setTimeout(() => {
      if (!settled) {
        console.warn("ngrok tunnel timed out after 45s");
        finish(null);
      }
    }, 45_000);
  });
}

export function stopNgrokTunnel(): void {
  if (ngrokChild && !ngrokChild.killed) {
    ngrokChild.kill("SIGTERM");
    ngrokChild = null;
  }
}
