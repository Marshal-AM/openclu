"use client";

import { XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type CatalogDetail = Record<string, unknown>;

export function CatalogDetailPanel({
  detail,
  onClose,
}: {
  detail: CatalogDetail;
  onClose?: () => void;
}) {
  const payload = detail.payload as Record<string, unknown> | undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Full Arkiv Catalog Entry</CardTitle>
        <CardDescription>Complete metadata, ownership, tags, and listing payload.</CardDescription>
        {onClose ? (
          <CardAction>
            <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close catalog detail">
              <XIcon />
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {payload ? (
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium">Metadata</h3>
              {detail.status != null ? <Badge variant="secondary">{String(detail.status)}</Badge> : null}
            </div>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Title</dt>
                <dd>{String(payload.title ?? "")}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Skill slug</dt>
                <dd className="font-mono text-xs">{String(payload.skillName ?? "")}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Description</dt>
                <dd>{String(payload.description ?? "")}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Triggers</dt>
                <dd className="font-mono text-xs">
                  {Array.isArray(payload.triggers) ? (payload.triggers as string[]).join(", ") : "Unavailable"}
                </dd>
              </div>
            </dl>
          </section>
        ) : null}

        <Separator />

        <section className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-2">
          {detail.entityKey != null ? (
            <p>
              Entity key: <span className="break-all font-mono text-foreground">{String(detail.entityKey)}</span>
            </p>
          ) : null}
          {detail.arkivVersion != null ? <p>Arkiv version: {String(detail.arkivVersion)}</p> : null}
          {detail.owner != null ? (
            <p>
              Owner: <span className="break-all font-mono text-foreground">{String(detail.owner)}</span>
            </p>
          ) : null}
          {detail.creator != null ? (
            <p>
              Creator: <span className="break-all font-mono text-foreground">{String(detail.creator)}</span>
            </p>
          ) : null}
          {Array.isArray(detail.tags) ? (
            <p className="sm:col-span-2">Tags: {(detail.tags as string[]).join(", ")}</p>
          ) : null}
        </section>

        <details className="group">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
            Raw JSON
          </summary>
          <pre className="mt-2 max-h-[32rem] overflow-auto rounded-lg border bg-muted/50 p-3 text-[11px] leading-relaxed">
            {JSON.stringify(
              {
                entityKey: detail.entityKey,
                status: detail.status,
                owner: detail.owner,
                creator: detail.creator,
                arkivVersion: detail.arkivVersion,
                tags: detail.tags,
                payload: detail.payload,
              },
              null,
              2,
            )}
          </pre>
        </details>
      </CardContent>
    </Card>
  );
}
