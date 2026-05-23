"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CatalogDetailPanel } from "@/components/CatalogDetailPanel";
import { useOrchestratorJob } from "@/hooks/useOrchestratorJob";
import { useDeviceInteractionStore } from "@/lib/device-interaction-store";
import type { OwnedDevice } from "@/lib/device-types";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
  skillName: string;
  arkivListingKey?: string;
  arkivVersion?: number;
  arkivStatus?: string;
  cid?: string;
  ipId?: string;
  publishedAt?: string;
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

function emptyForm(): MetadataForm {
  return {
    skillSlug: "",
    title: "",
    description: "",
    triggers: "",
    extraTags: "",
    expertiseSource: "",
    recordedAt: new Date().toISOString().slice(0, 16),
  };
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

export default function ContributePage() {
  const [form, setForm] = useState<MetadataForm>(emptyForm);
  const [draftSaved, setDraftSaved] = useState(false);
  const [captureJobId, setCaptureJobId] = useState<string | null>(null);
  const [distributeJobId, setDistributeJobId] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState("");
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
  const orchJobLabelRef = useRef("");

  const distributeRequested = useRef(false);
  const recaptureDistributeRequested = useRef(false);
  const editFormRef = useRef<MetadataForm | null>(null);
  editFormRef.current = editForm;

  const selectedDevice = devices.find((d) => d.id === selectedDeviceId) ?? null;

  const loadContributions = useCallback(async (deviceIdOverride?: string) => {
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
  }, [selectedDeviceId, contributionsError]);

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
      for (const s of onDevice) {
        const postRes = await fetch("/api/contributions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceId,
            skillSlug: s.skillSlug,
            status: s.arkivStatus === "archived" ? "archived" : isPublishedOnDevice(s) ? "published" : "draft",
            arkivListingKey: s.arkivListingKey,
            arkivVersion: s.arkivVersion,
          }),
        });
        if (!postRes.ok) {
          const err = await postRes.json().catch(() => ({}));
          failures.push(`${s.skillSlug}: ${(err as { error?: string }).error ?? postRes.status}`);
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
      setContributionsError(
        (data as { error?: string }).error ?? `Could not load devices (${res.status})`,
      );
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
        "No devices registered yet. Register a device first, then return to contribute.",
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
      return true;
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
        const slug =
          editingSlug && recaptureDistributeRequested.current
            ? editingSlug
            : form.skillSlug;
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
        const wasRecapture = recaptureDistributeRequested.current;
        const slug =
          (job.skillSlug as string) ||
          (wasRecapture ? editingSlug : null) ||
          form.skillSlug ||
          "";
        const pr = job.publishResult as DeviceSkill | undefined;
        setPublishSuccess({
          slug,
          listingKey: pr?.arkivListingKey,
          version: pr?.arkivVersion,
          message: wasRecapture
            ? `Re-recorded and listed on Arkiv (v${pr?.arkivVersion ?? "?"})`
            : undefined,
        });
        setCaptureJobId(null);
        setDistributeJobId(null);
        distributeRequested.current = false;
        recaptureDistributeRequested.current = false;
        const metaForm = wasRecapture ? editForm : form;
        await syncContributionFromJob(slug, "published", pr, {
          title: metaForm?.title,
          description: metaForm?.description,
        });
        if (wasRecapture) {
          setEditingSlug(null);
          setEditForm(null);
          setEditDraftMeta(null);
        }
      }
      if (captureJobId && job.status === "failed") {
        setLogs(job.logs ?? []);
        setError(job.error ?? "Capture failed");
        setCaptureJobId(null);
        recaptureDistributeRequested.current = false;
      }
    }, 2000);
    return () => clearInterval(id);
  }, [captureJobId, distributeJobId, form, editingSlug, editForm, syncContributionFromJob, selectedDeviceId]);

  async function saveDraft(): Promise<boolean> {
    if (!ensureDeviceSelected()) return false;
    setError("");
    const slug = form.skillSlug.toLowerCase().replace(/\s+/g, "-");
    if (!slug || !form.title.trim() || !form.description.trim()) {
      setError("Skill slug, title, and description are required.");
      return false;
    }
    const saved = await postSkillMd({ ...form, skillSlug: slug }, selectedDeviceId);
    if (!saved.ok) {
      setError(saved.error ?? "Failed to save draft");
      return false;
    }
    await fetch("/api/contributions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: selectedDeviceId,
        skillSlug: slug,
        status: "draft",
        title: form.title,
        description: form.description,
      }),
    });
    setDraftSaved(true);
    setForm((f) => ({ ...f, skillSlug: slug }));
    loadContributions();
    return true;
  }

  async function startCapture() {
    if (!ensureDeviceSelected()) return;
    if (!draftSaved) {
      const ok = await saveDraft();
      if (!ok) return;
    }
    setError("");
    distributeRequested.current = false;
    recaptureDistributeRequested.current = false;
    setLogs(["Starting capture…"]);
    const res = await fetch(`${ORCH}/jobs/capture`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...deviceHeaders(selectedDeviceId) },
      body: JSON.stringify({ skillSlug: form.skillSlug }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Capture failed to start");
      return;
    }
    setCaptureJobId(data.jobId);
    await fetch("/api/contributions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: selectedDeviceId,
        skillSlug: form.skillSlug,
        status: "capturing",
        jobId: data.jobId,
      }),
    });
  }

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
    else setCatalogDetail({ error: "Could not load full catalog entry" });
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
      {publishSuccess && (
        <Alert>
          <AlertTitle>
            {publishSuccess.message ??
              `Skill "${publishSuccess.slug}" is listed on Arkiv.`}
          </AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
          {publishSuccess.version != null && (
            <span>Version {publishSuccess.version}</span>
          )}
          {publishSuccess.listingKey && (
            <span className="break-all font-mono text-xs">
              Listing: {publishSuccess.listingKey}
            </span>
          )}
          <Button
            type="button"
            variant="link"
            className="h-auto w-fit px-0"
            onClick={() => setPublishSuccess(null)}
          >
            Dismiss
          </Button>
          </AlertDescription>
        </Alert>
      )}
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contribute Agent Skills</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Step 1: metadata. Step 2: record in terminal. Step 3: auto-publish.
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
            {selectedDeviceId ? (
              <Button
                type="button"
                variant="ghost"
                disabled={!!captureJobId || !!distributeJobId || !!orchJobId}
                onClick={() => {
                  clearDeviceSelection();
                  setContributions([]);
                  setLogs([]);
                }}
              >
                Clear context
              </Button>
            ) : null}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Skill Metadata</CardTitle>
            <CardDescription>Define the catalog entry before recording the skill session.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
          {renderMetadataFields(form, setForm, false)}
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              onClick={() => void saveDraft()}
              variant="secondary"
              disabled={!selectedDeviceId || !!captureJobId || !!distributeJobId || !!orchJobId}
            >
              Save draft
            </Button>
            <Button
              type="button"
              onClick={() => void startCapture()}
              disabled={
                !form.skillSlug.trim() ||
                !form.title.trim() ||
                !form.description.trim() ||
                !selectedDeviceId ||
                !!captureJobId ||
                !!distributeJobId ||
                !!orchJobId
              }
            >
              Start recording
            </Button>
          </div>
          {draftSaved && (
            <Badge variant="secondary" className="w-fit">Draft saved on device</Badge>
          )}
          {(captureJobId || distributeJobId || orchJobId || (error && logs.length > 0)) && (
            <div className="max-h-64 overflow-auto rounded-lg border bg-muted/50 p-3 font-mono text-xs text-muted-foreground">
              {captureJobId && (
                <p className="mb-2 text-foreground">
                  Press Q in the <strong>orchestrator</strong> terminal to stop recording.
                </p>
              )}
              {logs.slice(-60).map((l, i) => (
                <div key={i}>{l}</div>
              ))}
            </div>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Action failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-medium">My contributions</h2>
          <p className="text-sm text-muted-foreground">Manage drafts, catalog metadata, and published Arkiv listings.</p>
        </div>
        {contributionsError && (
          <Alert>
            <AlertTitle>Sync warning</AlertTitle>
            <AlertDescription>{contributionsError}</AlertDescription>
          </Alert>
        )}
        {visibleContributions.length === 0 && !contributionsError && (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No active contributions</EmptyTitle>
              <EmptyDescription>
                Save a draft or publish a skill. Published skills on your device sync here automatically.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
        <div className="flex flex-col gap-3">
          {visibleContributions.map((c) => (
            <Card
              key={c.id}
              size="sm"
              role="button"
              tabIndex={0}
              className="cursor-pointer transition-colors hover:bg-muted/40"
              onClick={() => void openContributionDialog(c)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  void openContributionDialog(c);
                }
              }}
            >
              <CardHeader>
                <div>
                  <CardTitle>{c.skill_slug}</CardTitle>
                  <CardDescription>
                    {c.status}
                    {c.arkiv_version != null && c.status === "published" ? ` · v${c.arkiv_version}` : ""}
                  </CardDescription>
                  {c.arkiv_listing_key && (
                    <p className="mt-1 max-w-md truncate font-mono text-[10px] text-muted-foreground">
                      {c.arkiv_listing_key}
                    </p>
                  )}
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <Dialog
        open={devicePickerOpen}
        onOpenChange={setDevicePickerOpen}
      >
        <DialogContent className="max-h-[92svh] overflow-auto sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle>Choose device for orchestrator actions</DialogTitle>
            <DialogDescription>
              Pick a device only when you are about to run orchestrator jobs. This context is in-app
              only and is not persisted in cookies.
            </DialogDescription>
          </DialogHeader>
          {devices.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No devices available</EmptyTitle>
                <EmptyDescription>
                  Register a device first, then return to contribution flow.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="grid max-h-[64svh] grid-cols-1 gap-4 overflow-auto pr-1 md:grid-cols-2 xl:grid-cols-3">
              {devices.map((device) => {
                const isSelected = device.id === selectedDeviceId;
                const isChoice = device.id === deviceChoiceId;
                const missingOrchestrator = !device.orchestrator_url;
                return (
                  <Card
                    key={device.id}
                    size="sm"
                    role="button"
                    tabIndex={0}
                    className={cn(
                      "cursor-pointer transition-all",
                      isChoice
                        ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                        : "hover:bg-muted/40",
                    )}
                    onClick={() => setDeviceChoiceId(device.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setDeviceChoiceId(device.id);
                      }
                    }}
                  >
                    <CardHeader>
                      <CardTitle>{device.device_name}</CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        {isSelected ? <Badge variant="secondary">Current</Badge> : null}
                        {missingOrchestrator ? (
                          <Badge variant="destructive">Missing orchestrator URL</Badge>
                        ) : null}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3 text-xs text-muted-foreground">
                      <span className="break-all font-mono">{device.wallet_address}</span>
                      <span className="break-all font-mono">
                        {device.orchestrator_url ?? "No orchestrator URL"}
                      </span>
                    </CardContent>
                    <CardFooter>
                      {isChoice ? (
                        <Button
                          type="button"
                          className="w-full"
                          onClick={() => void selectDevice(device.id)}
                        >
                          {isSelected ? "Keep as selected device" : "Select this device"}
                        </Button>
                      ) : null}
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={!!captureJobId || !!distributeJobId || !!orchJobId}
              onClick={() => {
                clearDeviceSelection();
                setDeviceChoiceId(null);
                setDevicePickerOpen(false);
                setContributions([]);
                setLogs([]);
              }}
            >
              Clear current context
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDeviceChoiceId(selectedDeviceId);
                setDevicePickerOpen(false);
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                    {editDraftMeta?.arkivVersion != null ? ` (current Arkiv v${editDraftMeta.arkivVersion})` : ""}
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

              {selectedSkill && catalogDetail ? (
                catalogDetail.error ? (
                  <Alert variant="destructive">
                    <AlertTitle>Could not load catalog entry</AlertTitle>
                    <AlertDescription>{String(catalogDetail.error)}</AlertDescription>
                  </Alert>
                ) : (
                  <CatalogDetailPanel detail={catalogDetail} />
                )
              ) : null}
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
