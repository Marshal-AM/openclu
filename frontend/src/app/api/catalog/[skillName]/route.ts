import { NextRequest, NextResponse } from "next/server";
import { getCatalogSkill, getCatalogSkillDetail } from "@/lib/catalog";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ skillName: string }> },
) {
  try {
    const { skillName } = await params;
    const view = req.nextUrl.searchParams.get("view");
    const ownerAddress = req.nextUrl.searchParams.get("ownerAddress") ?? undefined;
    const listingKey = req.nextUrl.searchParams.get("listingKey") ?? undefined;
    const kindParam = req.nextUrl.searchParams.get("kind");
    const kind: "skill" | "training" = kindParam === "training" ? "training" : "skill";
    const detailParams = { ownerAddress, listingKey, kind };
    const listing =
      view === "cdr"
        ? await getCatalogSkill(skillName)
        : await getCatalogSkillDetail(skillName, detailParams);
    return NextResponse.json(listing);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const status = message.includes("NOT_FOUND") || message.includes("No catalog") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
