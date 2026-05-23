"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CatalogDetailPanel } from "@/components/CatalogDetailPanel";
import { DeviceChooserDialog } from "@/components/DeviceChooserDialog";
import { useOrchestratorJob } from "@/hooks/useOrchestratorJob";
import { useDeviceInteractionStore } from "@/lib/device-interaction-store";
import type { OwnedDevice } from "@/lib/device-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

type Contribution = {
  id: string;
  skill_slug: string;
  status: string;
  title?: string | null;
  description?: string | null;
  arkiv_listing_key?: string;
  arkiv_version?: number | null;
};

type DeviceSkill = {
  skillSlug: string;
  arkivListingKey?: string;
  arkivVersion?: number;
  arkivStatus?: string;
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
  arkivListingKey?: string;
  arkivVersion?: number;
  arkivStatus?: string;
};

const ORCH = "/api/orch";

function isPublishedOnDevice(s: DeviceSkill): boolean {
  return s.arkivStatus === "published" || !!s.arkivListingKey;
}

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
  selectedDeviceId: string | null,
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
    headers: { "Content-Type": "application/json", ...deviceHeaders(selectedDeviceId) },
    body: JSON.stringify({
      skillSlug: slug,
      title: form.title,
      description: form.description,
      triggers: triggers.length ? triggers : ["general"],
      extraTags,
      expertiseSource: form.expertiseSource || undefined,
      recordedAt: form.recordedAt ? new Date(form.recordedAt).toISOString() : undefined,
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
  const [publishSuccess, setPublishSuccess] = useState<PublishSuccess | null>(null);
  const [contributionsError, setContributionsError] = useState("");
  const [devices, setDevices] = useState<OwnedDevice[]>([]);
  const [devicePickerOpen, setDevicePickerOpen] = useState(false);
  const [deviceChoiceId, setDeviceChoiceId] = useState<string | null>(null);

  const selectedDeviceId = useDeviceInteractionStore((s) => s.selectedDeviceId);
  const chooseDevice = useDeviceInteractionStore((s) => s.chooseDevice);
  const clearDeviceSelection = useDeviceInteractionStore((s) => s.clearDeviceSelection);

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
  editFormRef.current = editForm;

  const selectedDevice = devices.find((d) => d.id === selectedDeviceId) ?? null;

  const loadContributions = useCallback(
    async (deviceIdOverride?: string) => {
      const deviceId = deviceIdOverride ?? selectedDeviceId;
      if (!deviceId) {
        setContributions([]);
        return;
      }
      const res = await fetch(`/api/contributions?deviceId=${encodeURIComponent(deviceId)}`);
      if (res.ok) {
        const data = await res.json();
        setContributions(data.contributions ?? []);
        if (!contributionsError || contributionsError.includes("Could not load contributions")) {
          setContributionsError("");
        }
      } else {
        const data = await res.json().catch(() => ({}));
        setContributionsError(
          (data as { error?: string }).error ?? `Could not load contributions (${res.status})`,
        );
      }
    },
    [selectedDeviceId, contributionsError],
  );

  const syncContributionFromJob = useCallback(
    async (
      slug: string,
      status: string,
      pr?: Partial<DeviceSkill>,
      meta?: { title?: string; description?: string },
    ) => {
      await fetch("/api/contributions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: selectedDeviceId,
          skillSlug: slug,
          status,
          arkivListingKey: pr?.arkivListingKey,
          arkivVersion: pr?.arkivVersion,
          title: meta?.title,
          description: meta?.description,
        }),
      });
      await loadContributions();
    },
    [loadContributions, selectedDeviceId],
  );

  const syncPublishedFromDevice = useCallback(
    async (deviceIdOverride?: string) => {
      const deviceId = deviceIdOverride ?? selectedDeviceId;
      if (!deviceId) return;

      const res = await fetch(`${ORCH}/skills`, {
        headers: deviceHeaders(deviceId),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 404) {
          setContributionsError(
            "Device orchestrator is missing GET /api/v1/skills — restart orchestrator (npm run start) and refresh.",
          );
        } else {
          setContributionsError(
            (err as { error?: string }).error ??
              `Cannot read skills from device (${res.status}). Is orchestrator running?`,
          );
        }
        return;
      }

      const data = await res.json();
      const skills = (data.skills ?? []) as DeviceSkill[];
      const onDevice = skills.filter(
        (s) => isPublishedOnDevice(s) || s.arkivStatus === "archived",
      );
      if (onDevice.length === 0) return;

      const failures: string[] = [];
      for (const skill of onDevice) {
        const postRes = await fetch("/api/contributions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceId,
            skillSlug: skill.skillSlug,
            status:
              skill.arkivStatus === "archived"
                ? "archived"
                : isPublishedOnDevice(skill)
                  ? "published"
                  : "draft",
            arkivListingKey: skill.arkivListingKey,
            arkivVersion: skill.arkivVersion,
          }),
        });
        if (!postRes.ok) {
          const err = await postRes.json().catch(() => ({}));
          failures.push(`${skill.skillSlug}: ${(err as { error?: string }).error ?? postRes.status}`);
        }
      }

      if (failures.length > 0) {
        setContributionsError(`Failed to save to Supabase: ${failures.join("; ")}`);
      }
    },
    [selectedDeviceId],
  );

  const loadDevices = useCallback(async () => {
    const res = await fetch("/api/devices");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setContributionsError((data as { error?: string }).error ?? `Could not load devices (${res.status})`);
      setDevices([]);
      clearDeviceSelection();
      return;
    }
    const list = ((data as { devices?: OwnedDevice[] }).devices ?? []) as OwnedDevice[];
    setDevices(list);
    if (selectedDeviceId && !list.some((d) => d.id === selectedDeviceId)) {
      clearDeviceSelection();
      setContributions([]);
      setContributionsError("Previously selected device is no longer available.");
    }
    if (list.length === 0) {
      clearDeviceSelection();
      setContributions([]);
      setContributionsError(
        "No devices registered yet. Register a device first, then return to contributions.",
      );
    }
  }, [clearDeviceSelection, selectedDeviceId]);

  const selectDevice = useCallback(
    async (deviceId: string) => {
      chooseDevice(deviceId);
      setDevicePickerOpen(false);
      setDeviceChoiceId(null);
      setError("");
      setContributionsError("");
      setContributions([]);
      await syncPublishedFromDevice(deviceId);
      await loadContributions(deviceId);
      toast.success("Device selected.");
    },
    [chooseDevice, loadContributions, syncPublishedFromDevice],
  );

  function ensureDeviceSelected(): boolean {
    if (!selectedDeviceId) {
      setDevicePickerOpen(true);
      setError("Select a device before running orchestrator actions.");
      return false;
    }
    return true;
  }

  useEffect(() => {
    void loadDevices();
  }, [loadDevices]);

  useEffect(() => {
    if (devicePickerOpen) {
      setDeviceChoiceId(selectedDeviceId);
    }
  }, [devicePickerOpen, selectedDeviceId]);

  useEffect(() => {
    return () => {
      clearDeviceSelection();
    };
  }, [clearDeviceSelection]);

  useEffect(() => {
    if (!selectedDeviceId) return;
    void (async () => {
      await syncPublishedFromDevice();
      await loadContributions();
    })();
  }, [selectedDeviceId, syncPublishedFromDevice, loadContributions]);

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

  const { logs: orchLogs } = useOrchestratorJob(orchJobId, selectedDeviceId, {
    onPublished: async (job) => {
      const slug = job.skillSlug;
      const pr = job.publishResult;
      const label = orchJobLabelRef.current;
      orchJobLabelRef.current = "";
      setOrchJobId(null);
      setLogs([]);
      if (label === "update-catalog") {
        setPublishSuccess({
          slug,
          listingKey: pr?.arkivListingKey,
          version: pr?.arkivVersion,
          message: `Catalog updated on Arkiv (v${pr?.arkivVersion ?? "?"})`,
        });
        setEditingSlug(null);
        setEditForm(null);
        setEditDraftMeta(null);
        await syncContributionFromJob(slug, "published", pr, {
          title: editFormRef.current?.title,
          description: editFormRef.current?.description,
        });
      } else if (label === "archive") {
        setPublishSuccess({
          slug,
          message: `"${slug}" removed from marketplace (archived on Arkiv)`,
        });
        setEditingSlug(null);
        setEditForm(null);
        setEditDraftMeta(null);
        await syncContributionFromJob(slug, "archived", pr);
      } else if (label === "republish") {
        setPublishSuccess({
          slug,
          listingKey: pr?.arkivListingKey,
          version: pr?.arkivVersion,
          message: `Re-encrypted and listed on Arkiv (v${pr?.arkivVersion ?? "?"})`,
        });
        setEditingSlug(null);
        setEditForm(null);
        setEditDraftMeta(null);
        await syncContributionFromJob(slug, "published", pr);
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
      if (!jobId) return;
      const res = await fetch(`${ORCH}/jobs/${jobId}`, {
        headers: deviceHeaders(selectedDeviceId),
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
          headers: { "Content-Type": "application/json", ...deviceHeaders(selectedDeviceId) },
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
          listingKey: pr?.arkivListingKey,
          version: pr?.arkivVersion,
          message: `Re-recorded and listed on Arkiv (v${pr?.arkivVersion ?? "?"})`,
        });
        setCaptureJobId(null);
        setDistributeJobId(null);
        distributeRequested.current = false;
        recaptureDistributeRequested.current = false;
        await syncContributionFromJob(slug, "published", pr, {
          title: editForm?.title,
          description: editForm?.description,
        });
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
  }, [
    captureJobId,
    distributeJobId,
    editingSlug,
    editForm,
    selectedDeviceId,
    syncContributionFromJob,
  ]);

  async function openEdit(slug: string) {
    if (!ensureDeviceSelected()) return;
    setError("");
    setSelectedSkill(null);
    setCatalogDetail(null);
    const res = await fetch(`${ORCH}/skills/${slug}/draft`, {
      headers: deviceHeaders(selectedDeviceId),
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
    if (!ensureDeviceSelected()) return;
    setError("");
    const saved = await postSkillMd(editForm, selectedDeviceId);
    if (!saved.ok) {
      setError(saved.error ?? "Failed to update SKILL.md");
      return;
    }
    setLogs(["Updating Arkiv catalog…"]);
    const res = await fetch(`${ORCH}/jobs/update-catalog`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...deviceHeaders(selectedDeviceId) },
      body: JSON.stringify({ skillSlug: editingSlug }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to start catalog update");
      return;
    }
    orchJobLabelRef.current = "update-catalog";
    setOrchJobId(data.jobId);
  }

  async function startRecaptureRepublish() {
    if (!editForm || !editingSlug) return;
    if (!ensureDeviceSelected()) return;
    const ok = window.confirm(
      "Re-record & republish creates a new Story IP asset and CDR vault. Existing buyers keep access to the old vault; new buyers need the new listing. Continue?",
    );
    if (!ok) return;
    setError("");
    const saved = await postSkillMd(editForm, selectedDeviceId);
    if (!saved.ok) {
      setError(saved.error ?? "Failed to save SKILL.md");
      return;
    }
    distributeRequested.current = false;
    recaptureDistributeRequested.current = true;
    setLogs(["Starting re-capture…"]);
    const res = await fetch(`${ORCH}/jobs/capture`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...deviceHeaders(selectedDeviceId) },
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
    if (!ensureDeviceSelected()) return;
    const ok = window.confirm(
      "Re-encrypt & republish runs full distribute (new IP + vault) without re-recording. Continue?",
    );
    if (!ok) return;
    setError("");
    setLogs(["Starting full republish…"]);
    const res = await fetch(`${ORCH}/jobs/republish`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...deviceHeaders(selectedDeviceId) },
      body: JSON.stringify({ skillSlug: slug }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Republish failed to start");
      return;
    }
    orchJobLabelRef.current = "republish";
    setOrchJobId(data.jobId);
  }

  async function archiveSkill(slug: string) {
    if (!ensureDeviceSelected()) return;
    const ok = window.confirm(
      `Remove "${slug}" from the marketplace? This archives the Arkiv listing (soft delete).`,
    );
    if (!ok) return;
    setError("");
    setLogs(["Archiving on Arkiv…"]);
    const res = await fetch(`${ORCH}/jobs/archive`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...deviceHeaders(selectedDeviceId) },
      body: JSON.stringify({ skillSlug: slug }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Archive failed to start");
      return;
    }
    orchJobLabelRef.current = "archive";
    setOrchJobId(data.jobId);
  }

  async function viewSkill(slug: string) {
    setSelectedSkill(slug);
    setCatalogDetail(null);
    const res = await fetch(`/api/catalog/${encodeURIComponent(slug)}`);
    if (res.ok) setCatalogDetail(await res.json());
    else toast.error("Could not load catalog entry.");
  }

  async function openContributionDialog(contribution: Contribution) {
    setSelectedContribution(contribution);
    setSelectedSkill(contribution.skill_slug);
    setCatalogDetail(null);
    if (contribution.status === "published") {
      await viewSkill(contribution.skill_slug);
    }
  }

  const visibleContributions = contributions.filter((c) => c.status !== "archived");

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
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel>Expertise source</FieldLabel>
            <Input
              value={value.expertiseSource}
              onChange={(e) => onChange({ ...value, expertiseSource: e.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel>Recorded at</FieldLabel>
            <Input
              type="datetime-local"
              value={value.recordedAt}
              onChange={(e) => onChange({ ...value, recordedAt: e.target.value })}
            />
          </Field>
        </div>
      </FieldGroup>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">My contributions</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage drafts, catalog metadata, and published Arkiv listings.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selectedDevice ? (
              <Badge variant="secondary">{selectedDevice.device_name}</Badge>
            ) : (
              <Badge variant="destructive">No device selected</Badge>
            )}
            <Button type="button" variant="outline" onClick={() => setDevicePickerOpen(true)}>
              Choose device
            </Button>
          </div>
        </div>

        {logs.length > 0 ? (
          <div className="max-h-64 overflow-auto rounded-lg border bg-muted/50 p-3 font-mono text-xs text-muted-foreground">
            {logs.slice(-80).map((line, index) => (
              <div key={`${line}-${index}`}>{line}</div>
            ))}
          </div>
        ) : null}

        {visibleContributions.length === 0 && !contributionsError ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No active contributions</EmptyTitle>
              <EmptyDescription>
                Save a draft or publish a skill. Published skills on your device sync here automatically.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}

        <div className="flex flex-col gap-3">
          {visibleContributions.map((contribution) => (
            <Card
              key={contribution.id}
              size="sm"
              role="button"
              tabIndex={0}
              className="cursor-pointer transition-colors hover:bg-muted/40"
              onClick={() => void openContributionDialog(contribution)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  void openContributionDialog(contribution);
                }
              }}
            >
              <CardHeader>
                <div>
                  <CardTitle>{contribution.skill_slug}</CardTitle>
                  <CardDescription>
                    {contribution.status}
                    {contribution.arkiv_version != null && contribution.status === "published"
                      ? ` · v${contribution.arkiv_version}`
                      : ""}
                  </CardDescription>
                  {contribution.arkiv_listing_key ? (
                    <p className="mt-1 max-w-md truncate font-mono text-[10px] text-muted-foreground">
                      {contribution.arkiv_listing_key}
                    </p>
                  ) : null}
                </div>
              </CardHeader>
              {(contribution.title || contribution.description) ? (
                <CardContent className="space-y-1 text-xs text-muted-foreground">
                  {contribution.title ? <p className="font-medium text-foreground">{contribution.title}</p> : null}
                  {contribution.description ? <p className="line-clamp-2">{contribution.description}</p> : null}
                </CardContent>
              ) : null}
            </Card>
          ))}
        </div>
      </section>

      <DeviceChooserDialog
        open={devicePickerOpen}
        onOpenChange={setDevicePickerOpen}
        devices={devices}
        selectedDeviceId={selectedDeviceId}
        deviceChoiceId={deviceChoiceId}
        onChoiceChange={setDeviceChoiceId}
        onSelect={selectDevice}
      />

      <Dialog
        open={!!selectedContribution}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedContribution(null);
            setSelectedSkill(null);
            setCatalogDetail(null);
            setEditingSlug(null);
            setEditForm(null);
            setEditDraftMeta(null);
          }
        }}
      >
        <DialogContent className="max-h-[90svh] overflow-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedContribution?.skill_slug ?? "Contribution"}</DialogTitle>
            <DialogDescription>Contribution details and management actions.</DialogDescription>
          </DialogHeader>

          {selectedContribution ? (
            <div className="flex flex-col gap-5">
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Status</dt>
                  <dd>{selectedContribution.status}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Arkiv version</dt>
                  <dd>{selectedContribution.arkiv_version ?? "Unavailable"}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">Title</dt>
                  <dd>{selectedContribution.title ?? "Unavailable"}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">Description</dt>
                  <dd>{selectedContribution.description ?? "Unavailable"}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">Listing key</dt>
                  <dd className="break-all font-mono text-xs">
                    {selectedContribution.arkiv_listing_key ?? "Unavailable"}
                  </dd>
                </div>
              </dl>

              {editingSlug === selectedContribution.skill_slug && editForm ? (
                <div className="flex flex-col gap-4">
                  <Separator />
                  <p className="text-sm text-muted-foreground">
                    Edit catalog metadata
                    {editDraftMeta?.arkivVersion != null
                      ? ` (current Arkiv v${editDraftMeta.arkivVersion})`
                      : ""}
                  </p>
                  {renderMetadataFields(editForm, setEditForm, true)}
                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      onClick={() => void saveMetadataEdit()}
                      disabled={!!orchJobId || !!captureJobId || !editForm.title.trim()}
                    >
                      Save metadata to Arkiv
                    </Button>
                    {editDraftMeta?.arkivListingKey ? (
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

              {selectedSkill && catalogDetail ? <CatalogDetailPanel detail={catalogDetail} /> : null}
            </div>
          ) : null}

          {selectedContribution ? (
            <DialogFooter>
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
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
