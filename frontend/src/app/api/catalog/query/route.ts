import { NextResponse } from "next/server";
import { createArkivTrace } from "@/lib/arkiv-trace";
import { queryCatalog, type CatalogQueryBody } from "@/lib/catalog";
import { getSessionWallet } from "@/lib/session";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CatalogQueryBody;
    const session = await getSessionWallet();
    if (body.scope === "mine" && !body.ownerAddress && session) {
      body.ownerAddress = session;
    }
    const result = await queryCatalog(body);
    return NextResponse.json({
      ...result,
      arkivTrace: createArkivTrace("query", "POST /api/catalog/query", body, result, {
        transport: "skill-capture/arkiv catalog-query-cli",
        network: "braga-hoodi",
        resolvedFilters: (result as { filters?: unknown }).filters,
      }),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
