"use client";

import { cn } from "@/lib/utils";
import { SkillMarkdownPreview } from "./SkillMarkdownPreview";

type ContributionListingCardProps = {
  title: string;
  description: string;
  status: string;
  deviceName?: string | null;
  version?: number | null;
  kind?: "skill" | "training";
  onClick: () => void;
};

export function ContributionListingCard({
  title,
  description,
  status,
  deviceName,
  version,
  kind,
  onClick,
}: ContributionListingCardProps) {
  const headerBadge =
    status === "published" && version != null ? `v${version}` : status;
  const kindLabel = kind === "training" ? "Training" : kind === "skill" ? "Skill" : null;

  return (
    <button
      type="button"
      className={cn(
        "catalog-listing-card",
        "flex min-h-full w-full flex-col overflow-hidden rounded-lg border border-border bg-card text-left text-card-foreground shadow-sm",
        "transition-all hover:-translate-y-px hover:shadow-md",
      )}
      onClick={onClick}
      aria-label={title}
    >
      <header className="catalog-listing-card-header flex items-start justify-between gap-3 px-4 pt-4">
        <h3 className="catalog-listing-card-title min-w-0 flex-1 text-base font-semibold leading-tight">
          {title}
        </h3>
        <span className="catalog-listing-card-price shrink-0 rounded-md border border-border bg-secondary px-2 py-1 text-sm font-bold tabular-nums">
          {headerBadge}
        </span>
      </header>

      <div className="catalog-listing-card-body px-4 py-3">
        <SkillMarkdownPreview content={description} variant="card" />
      </div>

      <footer className="catalog-listing-card-footer flex items-center justify-between gap-3 border-t border-border px-4 py-3 pb-4">
        <span className="catalog-listing-card-meta text-xs text-muted-foreground">
          {deviceName ?? "Unknown device"}
          {kindLabel ? ` · ${kindLabel}` : ""}
        </span>
        <span className="catalog-listing-card-meta text-xs capitalize text-muted-foreground">{status}</span>
      </footer>
    </button>
  );
}
