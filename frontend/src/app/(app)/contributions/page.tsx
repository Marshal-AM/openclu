"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CatalogDetailPanel,
  ContributionDraftPanel,
} from "@/components/CatalogDetailPanel";
import { ContributionListingCard } from "@/components/skills/ContributionListingCard";
import { SkillModalDialog } from "@/components/skills/SkillModalDialog";
import { CatalogDetailSkeleton, SkillCardGridSkeleton } from "@/components/skills/skill-skeletons";
import { useOrchestratorJob } from "@/hooks/useOrchestratorJob";
import type { Contribution } from "@/lib/contributions-from-catalog";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

type MetadataForm = {
  skillSlug: string;
  title: string;
  description: string;
  triggers: string;
  extraTags: string;
  expertiseSource: string;
  recordedAt: string;
};

type DeviceSkill = {
  skillSlug: string;
  catalogListingId?: string;
  catalogVersion?: number;
};

type PublishSuccess = {
  slug: string;
  listingKey?: string;
  version?: number;
  message?: string;
};

type DraftPayload = {
  skillSlug: string;
  title: string;
  description: string;
  triggers: string[];
  extraTags: string[];
  expertiseSource?: string;
  recordedAt?: string;
  catalogListingId?: string;
  catalogVersion?: number;
  catalogStatus?: string;
};

const ORCH = "/api/orch";

function draftToForm(d: DraftPayload): MetadataForm {
  return {
    skillSlug: d.skillSlug,
    title: d.title,
    description: d.description,
    triggers: d.triggers.join("\n"),
    extraTags: d.extraTags.join(", "),
    expertiseSource: d.expertiseSource ?? "",
    recordedAt: d.recordedAt
      ? new Date(d.recordedAt).toISOString().slice(0, 16)
      : new Date().toISOString().slice(0, 16),
  };
}

function deviceHeaders(deviceId: string | null): HeadersInit {
  return deviceId ? { "x-device-id": deviceId } : {};
}

async function postSkillMd(
  form: MetadataForm,
  deviceId: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const slug = form.skillSlug.toLowerCase().replace(/\s+/g, "-");
  const triggers = form.triggers
    .split("\n")
    .map((t) => t.trim())
    .filter(Boolean);
  const extraTags = form.extraTags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const res = await fetch(`${ORCH}/jobs/skill-md`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...deviceHeaders(deviceId) },
    body: JSON.stringify({
      skillSlug: slug,
      title: form.title,
      description: form.description,
      triggers: triggers.length ? triggers : ["general"],
      extraTags,
      expertiseSource: form.expertiseSource || undefined,
      recordedAt: new Date().toISOString(),
    }),
  });

  const data = await res.json();
  if (!res.ok) return { ok: false, error: data.error ?? "Failed to save SKILL.md" };
  return { ok: true };
}

export default function ContributionsPage() {
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [selectedContribution, setSelectedContribution] = useState<Contribution | null>(null);
  const [catalogDetail, setCatalogDetail] = useState<Record<string, unknown> | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [publishSuccess, setPublishSuccess] = useState<PublishSuccess | null>(null);
  const [contributionsError, setContributionsError] = useState("");
  const [loading, setLoading] = useState(true);

  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<MetadataForm | null>(null);
  const [editDraftMeta, setEditDraftMeta] = useState<DraftPayload | null>(null);
  const [orchJobId, setOrchJobId] = useState<string | null>(null);
  const [captureJobId, setCaptureJobId] = useState<string | null>(null);
  const [distributeJobId, setDistributeJobId] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState("");

  const orchJobLabelRef = useRef("");
  const recaptureDistributeRequested = useRef(false);
  const distributeRequested = useRef(false);
  const editFormRef = useRef<MetadataForm | null>(null);
  const actionDeviceIdRef = useRef<string | null>(null);
  editFormRef.current = editForm;

  const actionDeviceId = selectedContribution?.device_id ?? actionDeviceIdRef.current;

  const loadContributions = useCallback(async () => {
    const res = await fetch("/api/contributions");
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setContributions((data.contributions ?? []) as Contribution[]);
      const warnings = (data as { warnings?: string[] }).warnings ?? [];
      setContributionsError(warnings.length > 0 ? warnings.join("; ") : "");
    } else {
      setContributions([]);
      setContributionsError(
        (data as { error?: string }).error ?? `Could not load contributions (${res.status})`,
      );
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      await loadContributions();
    } finally {
      setLoading(false);
    }
  }, [loadContributions]);

  function requireDeviceId(): string | null {
    const deviceId = selectedContribution?.device_id ?? actionDeviceIdRef.current;
    if (!deviceId) {
      setError("Contribution device is unavailable.");
      return null;
    }
    return deviceId;
  }

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    if (!publishSuccess) return;
    toast.success(publishSuccess.message ?? `Skill "${publishSuccess.slug}" updated successfully.`, {
      description:
        publishSuccess.version != null
          ? `Version ${publishSuccess.version}`
          : publishSuccess.listingKey,
    });
  }, [publishSuccess]);

  useEffect(() => {
    if (!contributionsError) return;
    toast.warning("Sync warning", { description: contributionsError });
  }, [contributionsError]);

  useEffect(() => {
    if (!error) return;
    toast.error("Action failed", { description: error });
  }, [error]);

  const { logs: orchLogs } = useOrchestratorJob(orchJobId, actionDeviceId, {
    onPublished: async (job) => {
      const slug = job.skillSlug;
      const pr = job.publishResult;
      const label = orchJobLabelRef.current;
      const deviceId = actionDeviceIdRef.current;
      orchJobLabelRef.current = "";
      setOrchJobId(null);
      setLogs([]);
      if (!deviceId) return;

      if (label === "update-catalog") {
        setPublishSuccess({
          slug,
          listingKey: pr?.catalogListingId,
          version: pr?.catalogVersion,
          message: `Catalog updated on Catalog (v${pr?.catalogVersion ?? "?"})`,
        });
        setEditingSlug(null);
        setEditForm(null);
        setEditDraftMeta(null);
        await loadContributions();
      } else if (label === "archive") {
        setPublishSuccess({
          slug,
          message: `"${slug}" removed from marketplace (archived on catalog)`,
        });
        setEditingSlug(null);
        setEditForm(null);
        setEditDraftMeta(null);
        await loadContributions();
      } else if (label === "republish") {
        setPublishSuccess({
          slug,
          listingKey: pr?.catalogListingId,
          version: pr?.catalogVersion,
          message: `Re-encrypted and listed on Catalog (v${pr?.catalogVersion ?? "?"})`,
        });
        setEditingSlug(null);
        setEditForm(null);
        setEditDraftMeta(null);
        await loadContributions();
      }
    },
    onFailed: (job) => {
      setError(job.error ?? `${orchJobLabelRef.current || "Job"} failed`);
      setLogs(job.logs ?? []);
      orchJobLabelRef.current = "";
      setOrchJobId(null);
    },
  });

  useEffect(() => {
    if (orchJobId && orchLogs.length > 0) setLogs(orchLogs);
  }, [orchJobId, orchLogs]);

  useEffect(() => {
    if (!captureJobId && !distributeJobId) return;

    const id = setInterval(async () => {
      const jobId = distributeJobId ?? captureJobId;
      const deviceId = actionDeviceIdRef.current;
      if (!jobId || !deviceId) return;

      const res = await fetch(`${ORCH}/jobs/${jobId}`, {
        headers: deviceHeaders(deviceId),
      });
      if (!res.ok) return;
      const job = await res.json();
      setLogs(job.logs ?? []);

      if (
        captureJobId &&
        !distributeJobId &&
        !distributeRequested.current &&
        job.exitCode === 0 &&
        job.status === "processing"
      ) {
        distributeRequested.current = true;
        const slug = editingSlug ?? "";
        const dRes = await fetch(`${ORCH}/jobs/${captureJobId}/distribute`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...deviceHeaders(deviceId) },
          body: JSON.stringify({ skillSlug: slug }),
        });
        const d = await dRes.json();
        if (dRes.ok && d.jobId) {
          setDistributeJobId(d.jobId);
          setCaptureJobId(null);
          if (d.logs?.length) setLogs(d.logs);
        } else {
          distributeRequested.current = false;
          recaptureDistributeRequested.current = false;
          if (d.logs?.length) setLogs(d.logs);
          setError(d.error ?? "Failed to start distribute");
        }
      }

      if (distributeJobId && job.status === "failed") {
        setLogs(job.logs ?? []);
        setError(job.error ?? "Distribute failed");
        setDistributeJobId(null);
        distributeRequested.current = false;
        recaptureDistributeRequested.current = false;
      }

      if (distributeJobId && job.status === "published") {
        const slug = (job.skillSlug as string) || editingSlug || "";
        const pr = job.publishResult as DeviceSkill | undefined;
        setPublishSuccess({
          slug,
          listingKey: pr?.catalogListingId,
          version: pr?.catalogVersion,
          message: `Re-recorded and listed on Catalog (v${pr?.catalogVersion ?? "?"})`,
        });
        setCaptureJobId(null);
        setDistributeJobId(null);
        distributeRequested.current = false;
        recaptureDistributeRequested.current = false;
        await loadContributions();
        setEditingSlug(null);
        setEditForm(null);
        setEditDraftMeta(null);
      }

      if (captureJobId && job.status === "failed") {
        setLogs(job.logs ?? []);
        setError(job.error ?? "Capture failed");
        setCaptureJobId(null);
        recaptureDistributeRequested.current = false;
      }
    }, 2000);

    return () => clearInterval(id);
  }, [captureJobId, distributeJobId, editingSlug, editForm, loadContributions]);

  async function openEdit(slug: string) {
    const deviceId = requireDeviceId();
    if (!deviceId) return;
    setError("");
    setSelectedSkill(null);
    setCatalogDetail(null);
    const res = await fetch(`${ORCH}/skills/${slug}/draft`, {
      headers: deviceHeaders(deviceId),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError((data as { error?: string }).error ?? `Cannot load draft for ${slug}`);
      return;
    }
    const { draft } = (await res.json()) as { draft: DraftPayload };
    setEditDraftMeta(draft);
    setEditForm(draftToForm(draft));
    setEditingSlug(slug);
  }

  async function saveMetadataEdit() {
    if (!editForm || !editingSlug) return;
    const deviceId = requireDeviceId();
    if (!deviceId) return;
    setError("");
    const saved = await postSkillMd(editForm, deviceId);
    if (!saved.ok) {
      setError(saved.error ?? "Failed to update SKILL.md");
      return;
    }
    setLogs(["Updating Catalog catalog…"]);
    const res = await fetch(`${ORCH}/jobs/update-catalog`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...deviceHeaders(deviceId) },
      body: JSON.stringify({ skillSlug: editingSlug }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to start catalog update");
      return;
    }
    actionDeviceIdRef.current = deviceId;
    orchJobLabelRef.current = "update-catalog";
    setOrchJobId(data.jobId);
  }

  async function startRecaptureRepublish() {
    if (!editForm || !editingSlug) return;
    const deviceId = requireDeviceId();
    if (!deviceId) return;
    const ok = window.confirm(
      "Re-record & republish creates a new Story IP asset and CDR vault. Existing buyers keep access to the old vault; new buyers need the new listing. Continue?",
    );
    if (!ok) return;
    setError("");
    const saved = await postSkillMd(editForm, deviceId);
    if (!saved.ok) {
      setError(saved.error ?? "Failed to save SKILL.md");
      return;
    }
    distributeRequested.current = false;
    recaptureDistributeRequested.current = true;
    actionDeviceIdRef.current = deviceId;
    setLogs(["Starting re-capture…"]);
    const res = await fetch(`${ORCH}/jobs/capture`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...deviceHeaders(deviceId) },
      body: JSON.stringify({ skillSlug: editingSlug }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Capture failed to start");
      recaptureDistributeRequested.current = false;
      return;
    }
    setCaptureJobId(data.jobId);
  }

  async function fullRepublish(slug: string) {
    const deviceId = requireDeviceId();
    if (!deviceId) return;
    const ok = window.confirm(
      "Re-encrypt & republish runs full distribute (new IP + vault) without re-recording. Continue?",
    );
    if (!ok) return;
    setError("");
    setLogs(["Starting full republish…"]);
    const res = await fetch(`${ORCH}/jobs/republish`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...deviceHeaders(deviceId) },
      body: JSON.stringify({ skillSlug: slug }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Republish failed to start");
      return;
    }
    actionDeviceIdRef.current = deviceId;
    orchJobLabelRef.current = "republish";
    setOrchJobId(data.jobId);
  }

  async function archiveSkill(slug: string) {
    const deviceId = requireDeviceId();
    if (!deviceId) return;
    const ok = window.confirm(
      `Remove "${slug}" from the marketplace? This archives the Catalog listing (soft delete).`,
    );
    if (!ok) return;
    setError("");
    setLogs(["Archiving on catalog…"]);
    const res = await fetch(`${ORCH}/jobs/archive`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...deviceHeaders(deviceId) },
      body: JSON.stringify({ skillSlug: slug }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Archive failed to start");
      return;
    }
    actionDeviceIdRef.current = deviceId;
    orchJobLabelRef.current = "archive";
    setOrchJobId(data.jobId);
  }

  async function viewSkill(contribution: Contribution) {
    const slug = contribution.skill_slug;
    setSelectedSkill(slug);
    setCatalogDetail(null);
    setCatalogError(null);
    setCatalogLoading(true);
    try {
      const params = new URLSearchParams();
      if (contribution.device_wallet_address) {
        params.set("ownerAddress", contribution.device_wallet_address);
      }
      if (contribution.catalog_listing_id) {
        params.set("listingKey", contribution.catalog_listing_id);
      }
      params.set("kind", contribution.kind);
      const qs = params.toString();
      const res = await fetch(
        `/api/catalog/${encodeURIComponent(slug)}${qs ? `?${qs}` : ""}`,
      );
      const payload = (await res.json().catch(() => ({}))) as Record<string, unknown> & {
        error?: string;
      };
      if (res.ok) {
        setCatalogDetail(payload);
        return;
      }
      const message = payload.error ?? "Could not load catalog entry";
      setCatalogError(message);
    } finally {
      setCatalogLoading(false);
    }
  }

  async function openContributionDialog(contribution: Contribution) {
    actionDeviceIdRef.current = contribution.device_id;
    setSelectedContribution(contribution);
    setSelectedSkill(contribution.skill_slug);
    setCatalogDetail(null);
    if (contribution.status === "published") {
      await viewSkill(contribution);
    }
  }

  const visibleContributions = contributions.filter((c) => c.status !== "archived");

  const dialogTitle =
    (catalogDetail?.payload as Record<string, unknown> | undefined)?.title != null
      ? String((catalogDetail?.payload as Record<string, unknown>).title)
      : selectedContribution?.title ?? selectedContribution?.skill_slug ?? "Contribution";

  const dialogSubtitle = selectedContribution?.skill_slug;

  const contributionMeta = selectedContribution
    ? {
        deviceName: selectedContribution.device_name,
        status: selectedContribution.status,
        catalogVersion: selectedContribution.catalog_version,
        listingKey: selectedContribution.catalog_listing_id,
        kind: selectedContribution.kind,
      }
    : undefined;

  function closeContributionDialog() {
    setSelectedContribution(null);
    setSelectedSkill(null);
    setCatalogDetail(null);
    setCatalogError(null);
    setCatalogLoading(false);
    setEditingSlug(null);
    setEditForm(null);
    setEditDraftMeta(null);
  }

  function renderMetadataFields(
    value: MetadataForm,
    onChange: (f: MetadataForm) => void,
    slugReadOnly: boolean,
  ) {
    return (
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel>Skill slug</FieldLabel>
            <Input
              value={value.skillSlug}
              readOnly={slugReadOnly}
              disabled={slugReadOnly}
              onChange={(e) => onChange({ ...value, skillSlug: e.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel>Title</FieldLabel>
            <Input
              value={value.title}
              onChange={(e) => onChange({ ...value, title: e.target.value })}
            />
          </Field>
        </div>
        <Field>
          <FieldLabel>Description</FieldLabel>
          <Textarea
            rows={3}
            value={value.description}
            onChange={(e) => onChange({ ...value, description: e.target.value })}
          />
        </Field>
        <Field>
          <FieldLabel>Triggers</FieldLabel>
          <Textarea
            className="font-mono text-xs"
            rows={3}
            value={value.triggers}
            onChange={(e) => onChange({ ...value, triggers: e.target.value })}
          />
          <FieldDescription>One trigger per line.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel>Extra tags</FieldLabel>
          <Input
            value={value.extraTags}
            onChange={(e) => onChange({ ...value, extraTags: e.target.value })}
          />
          <FieldDescription>Comma-separated tags.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel>Expertise source</FieldLabel>
          <Input
            value={value.expertiseSource}
            onChange={(e) => onChange({ ...value, expertiseSource: e.target.value })}
          />
        </Field>
      </FieldGroup>
    );
  }

  return (
    <div className="skill-marketplace-ui flex w-full flex-col gap-6">
      <header className="skill-page-toolbar">
        <h1>My contributions</h1>
        <p>
          Skill and training listings on Catalog across your registered devices.
        </p>
      </header>

      {logs.length > 0 ? (
        <div className="skill-job-log">
          {logs.slice(-80).map((line, index) => (
            <div key={`${line}-${index}`}>{line}</div>
          ))}
        </div>
      ) : null}

      {loading ? <SkillCardGridSkeleton count={6} /> : null}

      {!loading && visibleContributions.length === 0 && !contributionsError ? (
        <div className="skill-empty-state">
          <p>No active contributions. Publish a skill or training data from Contribute.</p>
        </div>
      ) : null}

      {!loading && visibleContributions.length > 0 ? (
        <>
          <p className="text-sm text-muted-foreground">
            {visibleContributions.length} contribution{visibleContributions.length === 1 ? "" : "s"}
          </p>
          <div className="premium-skill-grid grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleContributions.map((contribution) => (
              <ContributionListingCard
                key={contribution.id}
                title={contribution.title ?? contribution.skill_slug}
                description={contribution.description ?? "No description available"}
                status={contribution.status}
                deviceName={contribution.device_name}
                version={contribution.catalog_version}
                kind={contribution.kind}
                onClick={() => void openContributionDialog(contribution)}
              />
            ))}
          </div>
        </>
      ) : null}

      <SkillModalDialog
        open={!!selectedContribution}
        onClose={closeContributionDialog}
        title={dialogTitle}
        subtitle={dialogSubtitle}
        footer={
          selectedContribution?.kind === "skill" ? (
            <>
              <Button type="button" variant="outline" onClick={() => void openEdit(selectedContribution.skill_slug)}>
                Edit
              </Button>
              {selectedContribution.status === "published" ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void fullRepublish(selectedContribution.skill_slug)}
                  disabled={!!orchJobId || !!captureJobId}
                >
                  Re-encrypt
                </Button>
              ) : null}
              <Button
                type="button"
                variant="destructive"
                onClick={() => void archiveSkill(selectedContribution.skill_slug)}
                disabled={!!orchJobId}
              >
                Archive
              </Button>
            </>
          ) : null
        }
      >
        {selectedContribution ? (
          <div className="flex flex-col gap-5">
            {catalogLoading ? <CatalogDetailSkeleton /> : null}

            {!catalogLoading && selectedContribution.status === "published" && catalogDetail ? (
              <CatalogDetailPanel detail={catalogDetail} />
            ) : null}

            {!catalogLoading && selectedContribution.status !== "published" ? (
              <ContributionDraftPanel
                title={selectedContribution.title}
                description={selectedContribution.description}
                contributionMeta={contributionMeta!}
              />
            ) : null}

            {!catalogLoading &&
            selectedContribution.status === "published" &&
            !catalogDetail &&
            selectedSkill ? (
              <>
                {catalogError ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
                    <p className="font-medium">Catalog entry unavailable</p>
                    <p className="mt-1 text-xs opacity-90">{catalogError}</p>
                    {catalogError.includes("No Catalog catalog listing") ? (
                      <p className="mt-2 text-xs">
                        The skill is marked published locally but is not on Catalog yet. Re-publish from
                        the device or re-publish from Contribute.
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <ContributionDraftPanel
                  title={selectedContribution.title}
                  description={selectedContribution.description}
                  contributionMeta={contributionMeta!}
                />
              </>
            ) : null}

            {editingSlug === selectedContribution.skill_slug && editForm ? (
              <div className="flex flex-col gap-4">
                <Separator />
                <p className="text-sm text-muted-foreground">
                  Edit catalog metadata
                  {editDraftMeta?.catalogVersion != null
                    ? ` (current Catalog v${editDraftMeta.catalogVersion})`
                    : ""}
                </p>
                {renderMetadataFields(editForm, setEditForm, true)}
                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    onClick={() => void saveMetadataEdit()}
                    disabled={!!orchJobId || !!captureJobId || !editForm.title.trim()}
                  >
                    Save metadata to catalog
                  </Button>
                  {editDraftMeta?.catalogListingId ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void startRecaptureRepublish()}
                      disabled={!!orchJobId || !!captureJobId || !!distributeJobId}
                    >
                      Re-record &amp; republish
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setEditingSlug(null);
                      setEditForm(null);
                      setEditDraftMeta(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </SkillModalDialog>
    </div>
  );
}
