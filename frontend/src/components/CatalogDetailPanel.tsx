"use client";

import type { ArkivQueryTrace } from "@/lib/arkiv-trace";
import { ArkivQueryDebugPanel } from "@/components/ArkivQueryDebugPanel";

type CatalogDetail = Record<string, unknown>;

function collectTags(detail: CatalogDetail, payload?: Record<string, unknown>): string[] {
  const fromPayload = Array.isArray(payload?.triggers) ? (payload.triggers as string[]) : [];
  const fromListing = Array.isArray(detail.tags) ? (detail.tags as string[]) : [];
  return [...new Set([...fromPayload, ...fromListing].filter(Boolean))];
}

export function CatalogDetailPanel({
  detail,
  arkivTrace,
}: {
  detail: CatalogDetail;
  arkivTrace?: ArkivQueryTrace | null;
}) {
  const payload = detail.payload as Record<string, unknown> | undefined;
  const description = payload?.description ? String(payload.description) : "";
  const tags = collectTags(detail, payload);

  return (
    <div className="catalog-detail-panel flex flex-col gap-5">
      {description ? (
        <section>
          <h3 className="catalog-detail-section-heading mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Description
          </h3>
          <p className="catalog-detail-description m-0 text-base leading-relaxed text-foreground">{description}</p>
        </section>
      ) : null}

      {tags.length > 0 ? (
        <section>
          <h3 className="catalog-detail-section-heading mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Tags
          </h3>
          <ul className="catalog-detail-tag-list m-0 flex flex-wrap gap-2 p-0 list-none">
            {tags.map((tag) => (
              <li key={tag}>
                <span className="catalog-detail-tag-badge inline-flex rounded-full bg-secondary px-2 py-1 text-xs text-muted-foreground">
                  {tag}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ArkivQueryDebugPanel trace={arkivTrace} />
    </div>
  );
}

type ContributionMeta = {
  deviceName?: string | null;
  status?: string;
  arkivVersion?: number | null;
  listingKey?: string | null;
};

export function ContributionDraftPanel({
  title,
  description,
  contributionMeta,
}: {
  title?: string | null;
  description?: string | null;
  contributionMeta: ContributionMeta;
}) {
  return (
    <div className="catalog-detail-panel flex flex-col gap-5">
      <dl className="catalog-detail-meta-grid grid grid-cols-2 gap-3">
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Device</dt>
          <dd className="mt-1 text-sm text-foreground">{contributionMeta.deviceName ?? "Unavailable"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Status</dt>
          <dd className="mt-1 text-sm text-foreground">{contributionMeta.status ?? "Unavailable"}</dd>
        </div>
        {contributionMeta.arkivVersion != null ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Arkiv version</dt>
            <dd className="mt-1 text-sm text-foreground">{contributionMeta.arkivVersion}</dd>
          </div>
        ) : null}
        {contributionMeta.listingKey ? (
          <div className="col-span-2">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Listing key</dt>
            <dd className="mt-1 break-all font-mono text-xs text-foreground">{contributionMeta.listingKey}</dd>
          </div>
        ) : null}
        {title ? (
          <div className="col-span-2">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Title</dt>
            <dd className="mt-1 text-sm text-foreground">{title}</dd>
          </div>
        ) : null}
      </dl>

      {description ? (
        <section>
          <h3 className="catalog-detail-section-heading mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Description
          </h3>
          <p className="catalog-detail-description m-0 text-base leading-relaxed text-foreground">{description}</p>
        </section>
      ) : null}
    </div>
  );
}
