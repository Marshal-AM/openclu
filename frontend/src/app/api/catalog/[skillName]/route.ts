import { NextRequest, NextResponse } from "next/server";
import { createArkivTrace } from "@/lib/arkiv-trace";
import { getCatalogSkill, getCatalogSkillDetail } from "@/lib/catalog";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ skillName: string }> },
) {
  try {
    const { skillName } = await params;
    const view = req.nextUrl.searchParams.get("view");
    const operation = view === "cdr" ? "get" : "get-detail";
    const request = { skillName, view: view ?? "full" };
    const listing =
      view === "cdr"
        ? await getCatalogSkill(skillName)
        : await getCatalogSkillDetail(skillName);
    return NextResponse.json({
      ...listing,
      arkivTrace: createArkivTrace(
        operation,
        `GET /api/catalog/${skillName}${view ? `?view=${view}` : ""}`,
        request,
        listing,
        { transport: "skill-capture/arkiv catalog-query-cli", network: "braga-hoodi" },
      ),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const status =
      message.includes("tsx missing") || message.includes("npm install") ? 503 : 404;
    return NextResponse.json({ error: message }, { status });
  }
}
