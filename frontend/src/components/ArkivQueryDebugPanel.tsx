"use client";

import type { ArkivQueryTrace } from "@/lib/arkiv-trace";

export function ArkivQueryDebugPanel({
  trace,
  className,
}: {
  trace: ArkivQueryTrace | null | undefined;
  className?: string;
}) {
  if (!trace) return null;

  return (
    <details
      className={[
        "group mt-4 rounded-md border border-dashed border-border/70 bg-muted/20 px-3 py-2",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <summary className="cursor-pointer list-none text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-emerald-500/70" aria-hidden />
          Arkiv · {trace.operation}
          <span className="font-normal normal-case tracking-normal text-muted-foreground/60">
            ({trace.source})
          </span>
        </span>
      </summary>
      <div className="mt-2 space-y-2 border-t border-border/40 pt-2">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
          <dt className="uppercase tracking-wide opacity-70">Queried</dt>
          <dd className="font-mono text-foreground/80">{trace.queriedAt}</dd>
          <dt className="uppercase tracking-wide opacity-70">Operation</dt>
          <dd className="font-mono text-foreground/80">{trace.operation}</dd>
          <dt className="uppercase tracking-wide opacity-70">Source</dt>
          <dd className="break-all font-mono text-foreground/80">{trace.source}</dd>
        </dl>
        {trace.meta && Object.keys(trace.meta).length > 0 ? (
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground/70">Meta</p>
            <pre className="max-h-32 overflow-auto rounded border border-border/50 bg-background/80 p-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
              {JSON.stringify(trace.meta, null, 2)}
            </pre>
          </div>
        ) : null}
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground/70">Request</p>
          <pre className="max-h-48 overflow-auto rounded border border-border/50 bg-background/80 p-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
            {JSON.stringify(trace.request, null, 2)}
          </pre>
        </div>
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground/70">Response</p>
          <pre className="max-h-64 overflow-auto rounded border border-border/50 bg-background/80 p-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
            {JSON.stringify(trace.response, null, 2)}
          </pre>
        </div>
      </div>
    </details>
  );
}
