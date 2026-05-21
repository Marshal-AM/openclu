import { NextResponse } from "next/server";
import { getCatalogSkill } from "@/lib/catalog";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ skillName: string }> },
) {
  try {
    const { skillName } = await params;
    const listing = await getCatalogSkill(skillName);
    return NextResponse.json(listing);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 404 },
    );
  }
}
