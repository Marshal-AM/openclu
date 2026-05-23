import { SESSION_COOKIE } from "@/lib/orchestrator-cookies";

export function getSessionWalletFromRequest(req: Request): string | null {
  const cookies = req.headers.get("cookie");
  if (!cookies) return null;
  const raw = cookies
    .split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith(`${SESSION_COOKIE}=`))
    ?.split("=")[1];
  return raw?.trim().toLowerCase() ?? null;
}
