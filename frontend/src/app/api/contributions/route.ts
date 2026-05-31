import { NextResponse } from "next/server";
import { getSessionWalletFromRequest } from "@/lib/auth-session";
import { listContributionsForOwner } from "@/lib/contributions-from-catalog";

export async function GET(req: Request) {
  try {
    const wallet = getSessionWalletFromRequest(req);
    if (!wallet) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { contributions, warnings } = await listContributionsForOwner(wallet);
    return NextResponse.json({
      contributions,
      ...(warnings.length > 0 ? { warnings } : {}),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
