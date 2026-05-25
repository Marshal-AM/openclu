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
    const ownerAddress = req.nextUrl.searchParams.get("ownerAddress") ?? undefined;
    const listingKey = req.nextUrl.searchParams.get("listingKey") ?? undefined;
    const kindParam = req.nextUrl.searchParams.get("kind");
    const kind: "skill" | "training" = kindParam === "training" ? "training" : "skill";
    const operation = view === "cdr" ? "get" : "get-detail";
    const request = {
      skillName,
      view: view ?? "full",
      ownerAddress,
      listingKey,
      kind,
    };
    const detailParams = { ownerAddress, listingKey, kind };
    const listing =
      view === "cdr"
        ? await getCatalogSkill(skillName)
        : await getCatalogSkillDetail(skillName, detailParams);
    const qs = req.nextUrl.search;
    return NextResponse.json({
      ...listing,
      arkivTrace: createArkivTrace(
        operation,
        `GET /api/catalog/${skillName}${qs}`,
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
