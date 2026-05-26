import { cookies } from "next/headers";
import { getPortalDeviceOrchestratorUrl } from "@/lib/portal-db";
import { SESSION_COOKIE, SESSION_COOKIE_OPTS } from "@/lib/orchestrator-cookies";

export { SESSION_COOKIE, SESSION_COOKIE_OPTS };

export function normalizeAddress(value: string): string {
  return value.trim().toLowerCase();
}

export async function getSessionWallet(): Promise<string | null> {
  const jar = await cookies();
  const wallet = jar.get(SESSION_COOKIE)?.value?.trim();
  return wallet ? normalizeAddress(wallet) : null;
}

export async function fetchOwnedDeviceOrchestratorUrl(
  ownerWallet: string,
  deviceId: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string; status: number }> {
  return getPortalDeviceOrchestratorUrl(ownerWallet, deviceId);
}
