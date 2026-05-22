import { NextRequest, NextResponse } from "next/server";
import { getCatalogSkill, getCatalogSkillDetail } from "@/lib/catalog";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ skillName: string }> },
) {
  try {
    const { skillName } = await params;
    const view = req.nextUrl.searchParams.get("view");
    const listing =
      view === "cdr"
        ? await getCatalogSkill(skillName)
        : await getCatalogSkillDetail(skillName);
    return NextResponse.json(listing);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 404 },
    );
  }
}
