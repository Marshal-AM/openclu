"use client";

type CatalogDetail = Record<string, unknown>;

export function CatalogDetailPanel({
  detail,
  onClose,
}: {
  detail: CatalogDetail;
  onClose?: () => void;
}) {
  const payload = detail.payload as Record<string, unknown> | undefined;
  const purchaseView = detail.purchaseView as Record<string, unknown> | undefined;

  return (
    <div className="mt-6 space-y-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-zinc-200">Full Arkiv catalog entry</h3>
        {onClose && (
          <button
            type="button"
            className="text-xs text-zinc-500 hover:text-zinc-300"
            onClick={onClose}
          >
            Close
          </button>
        )}
      </div>

      {payload && (
        <section>
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-emerald-500/90">
            Metadata
          </h4>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-zinc-500">Title</dt>
              <dd>{String(payload.title ?? "")}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Skill slug</dt>
              <dd className="font-mono text-xs">{String(payload.skillName ?? "")}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-zinc-500">Description</dt>
              <dd>{String(payload.description ?? "")}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-zinc-500">Triggers</dt>
              <dd className="font-mono text-xs">
                {Array.isArray(payload.triggers)
                  ? (payload.triggers as string[]).join(", ")
                  : "—"}
              </dd>
            </div>
          </dl>
        </section>
      )}

      <section className="grid gap-2 text-xs text-zinc-400 sm:grid-cols-2">
        {detail.entityKey != null && (
          <p>
            <span className="text-zinc-500">Entity key:</span>{" "}
            <span className="font-mono break-all">{String(detail.entityKey)}</span>
          </p>
        )}
        {detail.status != null && (
          <p>
            <span className="text-zinc-500">Status:</span> {String(detail.status)}
          </p>
        )}
        {detail.arkivVersion != null && (
          <p>
            <span className="text-zinc-500">Arkiv version:</span> {String(detail.arkivVersion)}
          </p>
        )}
        {detail.owner != null && (
          <p>
            <span className="text-zinc-500">$owner:</span>{" "}
            <span className="font-mono break-all">{String(detail.owner)}</span>
          </p>
        )}
        {detail.creator != null && (
          <p>
            <span className="text-zinc-500">$creator:</span>{" "}
            <span className="font-mono break-all">{String(detail.creator)}</span>
          </p>
        )}
        {Array.isArray(detail.tags) && (
          <p className="sm:col-span-2">
            <span className="text-zinc-500">Tags:</span> {(detail.tags as string[]).join(", ")}
          </p>
        )}
      </section>

      <details className="group">
        <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-300">
          Raw JSON (full listing + purchase view)
        </summary>
        <pre className="mt-2 max-h-[32rem] overflow-auto rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-[11px] leading-relaxed">
          {JSON.stringify(
            {
              entityKey: detail.entityKey,
              status: detail.status,
              owner: detail.owner,
              creator: detail.creator,
              arkivVersion: detail.arkivVersion,
              tags: detail.tags,
              payload: detail.payload,
              purchaseView: detail.purchaseView ?? purchaseView,
            },
            null,
            2,
          )}
        </pre>
      </details>
    </div>
  );
}
