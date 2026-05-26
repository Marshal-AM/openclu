import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/orchestrator-cookies";

export function normalizeAddress(value: string): string {
  return value.trim().toLowerCase();
}

export async function getSessionWallet(): Promise<string | null> {
  const jar = await cookies();
  const wallet = jar.get(SESSION_COOKIE)?.value?.trim();
  return wallet ? normalizeAddress(wallet) : null;
}
