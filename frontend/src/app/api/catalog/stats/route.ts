import { NextResponse } from "next/server";
import { createArkivTrace } from "@/lib/arkiv-trace";
import { getCatalogStats } from "@/lib/catalog";
import { getSessionWallet } from "@/lib/session";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const scope = (url.searchParams.get("scope") ?? "marketplace") as "marketplace" | "mine";
    const session = await getSessionWallet();
    const ownerAddress = url.searchParams.get("ownerAddress") ?? session ?? undefined;
    const request = { scope, ownerAddress: ownerAddress ?? null };
    const stats = await getCatalogStats(scope, ownerAddress ?? undefined);
    return NextResponse.json({
      ...stats,
      arkivTrace: createArkivTrace("stats", "GET /api/catalog/stats", request, stats, {
        transport: "skill-capture/arkiv catalog-query-cli",
        network: "braga-hoodi",
      }),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
