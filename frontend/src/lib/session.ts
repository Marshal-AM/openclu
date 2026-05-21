import { cookies } from "next/headers";
import { fetchOrchestratorUrlFromDb } from "@/lib/orchestrator-db";
import {
  ORCHESTRATOR_COOKIE,
  ORCHESTRATOR_COOKIE_OPTS,
  SESSION_COOKIE,
} from "@/lib/orchestrator-cookies";

export { SESSION_COOKIE, ORCHESTRATOR_COOKIE, ORCHESTRATOR_COOKIE_OPTS };
export { fetchOrchestratorUrlFromDb };

export async function getSessionWallet(): Promise<string | null> {
  const jar = await cookies();
  const v = jar.get(SESSION_COOKIE)?.value;
  return v?.toLowerCase() ?? null;
}

export async function getSessionOrchestratorUrl(): Promise<string | null> {
  const jar = await cookies();
  const v = jar.get(ORCHESTRATOR_COOKIE)?.value?.trim();
  if (!v) return null;
  return v.replace(/\/$/, "");
}

export type OrchestratorResolveResult =
  | { ok: true; url: string; source: "database" | "fallback" }
  | { ok: false; error: string; status: number };

/** Route Handlers only — reads DB and updates cookies(). */
export async function resolveOrchestratorUrlForRequest(): Promise<OrchestratorResolveResult> {
  const wallet = await getSessionWallet();

  if (wallet) {
    try {
      const url = await fetchOrchestratorUrlFromDb(wallet);
      const jar = await cookies();
      if (url) {
        jar.set(ORCHESTRATOR_COOKIE, url, ORCHESTRATOR_COOKIE_OPTS);
        return { ok: true, url, source: "database" };
      }
      return {
        ok: false,
        error:
          "No orchestrator_url for your device in Supabase. Re-run register.ps1 (orchestrator running), confirm registration, or update devices.orchestrator_url in the dashboard.",
        status: 403,
      };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
        status: 500,
      };
    }
  }

  const fallback = (process.env.ORCHESTRATOR_URL ?? "http://127.0.0.1:8790").replace(/\/$/, "");
  return { ok: true, url: fallback, source: "fallback" };
}
