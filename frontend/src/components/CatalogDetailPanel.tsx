"use client";

type CatalogDetail = Record<string, unknown>;

function collectTags(detail: CatalogDetail, payload?: Record<string, unknown>): string[] {
  const fromPayload = Array.isArray(payload?.triggers) ? (payload.triggers as string[]) : [];
  const fromListing = Array.isArray(detail.tags) ? (detail.tags as string[]) : [];
  return [...new Set([...fromPayload, ...fromListing].filter(Boolean))];
}

export function CatalogDetailPanel({ detail }: { detail: CatalogDetail }) {
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
    </div>
  );
}

type ContributionMeta = {
  deviceName?: string | null;
  status?: string;
  kind?: string;
  catalogListingId?: string | null;
  catalogVersion?: number | null;
};

export function ContributionDraftPanel({
  title,
  description,
  contributionMeta,
}: {
  title: string | null;
  description: string | null;
  contributionMeta: ContributionMeta;
}) {
  return (
    <div className="flex flex-col gap-4 text-sm text-muted-foreground">
      {title ? <p className="m-0 text-base font-medium text-foreground">{title}</p> : null}
      {description ? <p className="m-0 leading-relaxed">{description}</p> : null}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        {contributionMeta.deviceName ? (
          <>
            <dt className="uppercase tracking-wide opacity-70">Device</dt>
            <dd>{contributionMeta.deviceName}</dd>
          </>
        ) : null}
        {contributionMeta.status ? (
          <>
            <dt className="uppercase tracking-wide opacity-70">Status</dt>
            <dd>{contributionMeta.status}</dd>
          </>
        ) : null}
        {contributionMeta.kind ? (
          <>
            <dt className="uppercase tracking-wide opacity-70">Kind</dt>
            <dd>{contributionMeta.kind}</dd>
          </>
        ) : null}
      </dl>
    </div>
  );
}
