import { NextResponse } from "next/server";
import { resolveOrchestratorUrlForRequest } from "@/lib/session";

async function proxy(req: Request, pathSegs: string[]) {
  const resolved = await resolveOrchestratorUrlForRequest();
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  const base = resolved.url;
  const path = pathSegs.join("/");
  const url = `${base}/api/v1/${path}${new URL(req.url).search}`;
  const init: RequestInit = {
    method: req.method,
    headers: { "Content-Type": "application/json" },
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.text();
  }
  try {
    const res = await fetch(url, init);
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        error: `Cannot reach device orchestrator at ${base}. Is orchestrator running and ngrok tunnel active? ${msg}`,
      },
      { status: 502 },
    );
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxy(req, path);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxy(req, path);
}
