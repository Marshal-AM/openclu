import { NextResponse } from "next/server";
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
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
