"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DeviceChooserDialog } from "@/components/DeviceChooserDialog";
import { useDeviceInteractionStore } from "@/lib/device-interaction-store";
import type { OwnedDevice } from "@/lib/device-types";
import { makeSkillSlug, randomSlugSuffix } from "@/lib/skill-slug";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

const ORCH = "/api/orch";
const DRAFT_STORAGE_KEY = "openclu:contribute-draft";

function Stage({
  step,
  title,
  description,
  children,
}: {
  step: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="mb-5 flex items-start gap-3">
        <div className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-medium text-primary">
          {step}
        </div>
        <div>
          <h2 className="text-base font-medium leading-none">{title}</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

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

function hasDraftProgress(form: MetadataForm): boolean {
  return Boolean(
    form.title.trim() ||
      form.description.trim() ||
      form.triggers.trim() ||
      form.extraTags.trim() ||
      form.expertiseSource.trim(),
  );
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
      recordedAt: new Date().toISOString(),
    }),
  });
  const data = await res.json();
  if (!res.ok) return { ok: false, error: data.error ?? "Failed to save SKILL.md" };
  return { ok: true };
}

async function postTrainingMd(
  form: MetadataForm,
  selectedDeviceId: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const slug = form.skillSlug.toLowerCase().replace(/\s+/g, "-");
  const triggers = form.triggers
    .split("\n")
    .map((t) => t.trim())
    .filter(Boolean);
  const res = await fetch(`${ORCH}/jobs/training-md`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...deviceHeaders(selectedDeviceId) },
    body: JSON.stringify({
      skillSlug: slug,
      title: form.title,
      description: form.description,
      triggers: triggers.length ? triggers : ["general"],
      expertiseSource: form.expertiseSource || undefined,
      recordedAt: new Date().toISOString(),
    }),
  });
  const data = await res.json();
  if (!res.ok) return { ok: false, error: data.error ?? "Failed to save TRAINING.md" };
  return { ok: true };
}

export default function ContributePage() {
  const router = useRouter();
  const [form, setForm] = useState<MetadataForm>(emptyForm);
  const [slugSuffix, setSlugSuffix] = useState(() => randomSlugSuffix());
  const [activeStage, setActiveStage] = useState(0);
  const [hydratedDraft, setHydratedDraft] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [captureJobId, setCaptureJobId] = useState<string | null>(null);
  const [distributeJobId, setDistributeJobId] = useState<string | null>(null);
  const [videoCaptureJobId, setVideoCaptureJobId] = useState<string | null>(null);
  const [videoDistributeJobId, setVideoDistributeJobId] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [publishSuccess, setPublishSuccess] = useState<PublishSuccess | null>(null);
  const [devices, setDevices] = useState<OwnedDevice[]>([]);
  const [devicePickerOpen, setDevicePickerOpen] = useState(false);
  const [deviceChoiceId, setDeviceChoiceId] = useState<string | null>(null);
  const [syncWarning, setSyncWarning] = useState("");
  const [quitHref, setQuitHref] = useState<string | null>(null);

  const selectedDeviceId = useDeviceInteractionStore((s) => s.selectedDeviceId);
  const chooseDevice = useDeviceInteractionStore((s) => s.chooseDevice);
  const clearDeviceSelection = useDeviceInteractionStore((s) => s.clearDeviceSelection);

  const distributeRequested = useRef(false);
  const videoDistributeRequested = useRef(false);
  const allowNavigationRef = useRef(false);

  const selectedDevice = devices.find((d) => d.id === selectedDeviceId) ?? null;
  const hasProgress = hasDraftProgress(form);

  const syncContributionFromJob = useCallback(
    async (
      slug: string,
      status: string,
      pr?: Partial<DeviceSkill>,
      meta?: { title?: string; description?: string },
    ) => {
      if (!selectedDeviceId) return;
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
    },
    [selectedDeviceId],
  );

  const syncTrainingContributionFromJob = useCallback(
    async (
      slug: string,
      status: string,
      pr?: Partial<DeviceSkill>,
      meta?: { title?: string; description?: string },
    ) => {
      if (!selectedDeviceId) return;
      await fetch("/api/training-contributions", {
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
    },
    [selectedDeviceId],
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
        setSyncWarning(
          (err as { error?: string }).error ??
            `Cannot read skills from device (${res.status}). Is the portal running?`,
        );
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
            status:
              s.arkivStatus === "archived"
                ? "archived"
                : isPublishedOnDevice(s)
                  ? "published"
                  : "draft",
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
        setSyncWarning(`Failed to sync some skills to Supabase: ${failures.join("; ")}`);
      }
    },
    [selectedDeviceId],
  );

  const loadDevices = useCallback(async () => {
    const res = await fetch("/api/devices");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setSyncWarning((data as { error?: string }).error ?? `Could not load devices (${res.status})`);
      setDevices([]);
      clearDeviceSelection();
      return;
    }
    const list = ((data as { devices?: OwnedDevice[] }).devices ?? []) as OwnedDevice[];
    setDevices(list);
    if (selectedDeviceId && !list.some((d) => d.id === selectedDeviceId)) {
      clearDeviceSelection();
      setSyncWarning("Previously selected device is no longer available.");
    }
    if (list.length === 0) {
      clearDeviceSelection();
      setSyncWarning("No devices registered yet. Register a device first.");
    }
  }, [clearDeviceSelection, selectedDeviceId]);

  const selectDevice = useCallback(
    async (deviceId: string) => {
      chooseDevice(deviceId);
      setDevicePickerOpen(false);
      setDeviceChoiceId(null);
      setError("");
      setSyncWarning("");
      await syncPublishedFromDevice(deviceId);
      toast.success("Device selected.");
    },
    [chooseDevice, syncPublishedFromDevice],
  );

  function ensureDeviceSelected(): boolean {
    if (!selectedDeviceId) {
      setDevicePickerOpen(true);
      setError("Select a device before running portal actions.");
      return false;
    }
    return true;
  }

  function updateTitle(title: string) {
    const suffix = slugSuffix || randomSlugSuffix();
    if (!slugSuffix) setSlugSuffix(suffix);
    setForm((current) => ({
      ...current,
      title,
      skillSlug: makeSkillSlug(title, suffix),
    }));
    if (draftSaved) setDraftSaved(false);
  }

  function persistDraft(nextStage = activeStage) {
    window.localStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({
        form,
        slugSuffix,
        activeStage: nextStage,
        draftSaved,
      }),
    );
  }

  function clearPersistedDraft() {
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
  }

  function saveAndContinueFromBrief() {
    if (!form.title.trim() || !form.description.trim()) {
      toast.error("Title and description are required.");
      return;
    }
    const nextStage = 1;
    setActiveStage(nextStage);
    persistDraft(nextStage);
    toast.success("Skill brief saved.");
  }

  function saveAndContinueFromSetup() {
    if (!selectedDeviceId) {
      setDevicePickerOpen(true);
      toast.error("Choose a device before continuing.");
      return;
    }
    const nextStage = 2;
    setActiveStage(nextStage);
    persistDraft(nextStage);
    toast.success("Recording setup saved.");
  }

  function confirmQuitProgress() {
    if (!quitHref) return;
    allowNavigationRef.current = true;
    clearPersistedDraft();
    setForm(emptyForm());
    setSlugSuffix(randomSlugSuffix());
    setActiveStage(0);
    router.push(quitHref);
  }

  useEffect(() => {
    void loadDevices();
  }, [loadDevices]);

  useEffect(() => {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) {
      setHydratedDraft(true);
      return;
    }
    try {
      const saved = JSON.parse(raw) as {
        form?: MetadataForm;
        slugSuffix?: string;
        activeStage?: number;
        draftSaved?: boolean;
      };
      if (saved.form) setForm(saved.form);
      if (saved.slugSuffix) setSlugSuffix(saved.slugSuffix);
      if (typeof saved.activeStage === "number") {
        setActiveStage(Math.min(Math.max(saved.activeStage, 0), 2));
      }
      if (typeof saved.draftSaved === "boolean") setDraftSaved(saved.draftSaved);
    } catch {
      clearPersistedDraft();
    } finally {
      setHydratedDraft(true);
    }
  }, []);

  useEffect(() => {
    if (!hydratedDraft || !hasProgress) return;
    window.localStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({ form, slugSuffix, activeStage, draftSaved }),
    );
  }, [activeStage, draftSaved, form, hasProgress, hydratedDraft, slugSuffix]);

  useEffect(() => {
    if (!hydratedDraft) return;

    function handleDocumentClick(event: MouseEvent) {
      if (!hasProgress || allowNavigationRef.current) return;
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a[href]");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      const nextUrl = new URL(href, window.location.href);
      if (nextUrl.origin !== window.location.origin || nextUrl.pathname === "/contribute") return;
      event.preventDefault();
      event.stopPropagation();
      setQuitHref(`${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!hasProgress) return;
      event.preventDefault();
    }

    document.addEventListener("click", handleDocumentClick, true);
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      document.removeEventListener("click", handleDocumentClick, true);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasProgress, hydratedDraft]);

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
    void syncPublishedFromDevice();
  }, [selectedDeviceId, syncPublishedFromDevice]);

  useEffect(() => {
    if (!syncWarning) return;
    toast.warning("Sync warning", { description: syncWarning });
  }, [syncWarning]);

  useEffect(() => {
    if (!error) return;
    toast.error("Action failed", { description: error });
  }, [error]);

  useEffect(() => {
    if (!publishSuccess) return;
    toast.success(publishSuccess.message ?? `Skill "${publishSuccess.slug}" is listed on Arkiv.`, {
      description:
        publishSuccess.version != null
          ? `Version ${publishSuccess.version}`
          : publishSuccess.listingKey,
    });
  }, [publishSuccess]);

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
        const dRes = await fetch(`${ORCH}/jobs/${captureJobId}/distribute`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...deviceHeaders(selectedDeviceId) },
          body: JSON.stringify({ skillSlug: form.skillSlug }),
        });
        const d = await dRes.json();
        if (dRes.ok && d.jobId) {
          setDistributeJobId(d.jobId);
          setCaptureJobId(null);
          if (d.logs?.length) setLogs(d.logs);
        } else {
          distributeRequested.current = false;
          if (d.logs?.length) setLogs(d.logs);
          setError(d.error ?? "Failed to start distribute");
        }
      }

      if (distributeJobId && job.status === "failed") {
        setLogs(job.logs ?? []);
        setError(job.error ?? "Distribute failed");
        setDistributeJobId(null);
        distributeRequested.current = false;
      }

      if (distributeJobId && job.status === "published") {
        const slug = (job.skillSlug as string) || form.skillSlug || "";
        const pr = job.publishResult as DeviceSkill | undefined;
        setPublishSuccess({
          slug,
          listingKey: pr?.arkivListingKey,
          version: pr?.arkivVersion,
        });
        setCaptureJobId(null);
        setDistributeJobId(null);
        distributeRequested.current = false;
        await syncContributionFromJob(slug, "published", pr, {
          title: form.title,
          description: form.description,
        });
      }

      if (captureJobId && job.status === "failed") {
        setLogs(job.logs ?? []);
        setError(job.error ?? "Capture failed");
        setCaptureJobId(null);
      }
    }, 2000);

    return () => clearInterval(id);
  }, [captureJobId, distributeJobId, form, selectedDeviceId, syncContributionFromJob]);

  useEffect(() => {
    if (!videoCaptureJobId && !videoDistributeJobId) return;

    const id = setInterval(async () => {
      const jobId = videoDistributeJobId ?? videoCaptureJobId;
      if (!jobId) return;

      const res = await fetch(`${ORCH}/jobs/${jobId}`, {
        headers: deviceHeaders(selectedDeviceId),
      });
      if (!res.ok) return;
      const job = await res.json();
      setLogs(job.logs ?? []);

      if (
        videoCaptureJobId &&
        !videoDistributeJobId &&
        !videoDistributeRequested.current &&
        job.exitCode === 0 &&
        job.status === "processing"
      ) {
        videoDistributeRequested.current = true;
        const dRes = await fetch(`${ORCH}/jobs/${videoCaptureJobId}/distribute-training`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...deviceHeaders(selectedDeviceId) },
          body: JSON.stringify({ skillSlug: form.skillSlug }),
        });
        const d = await dRes.json();
        if (dRes.ok && d.jobId) {
          setVideoDistributeJobId(d.jobId);
          setVideoCaptureJobId(null);
          if (d.logs?.length) setLogs(d.logs);
        } else {
          videoDistributeRequested.current = false;
          if (d.logs?.length) setLogs(d.logs);
          setError(d.error ?? "Failed to start training distribute");
        }
      }

      if (videoDistributeJobId && job.status === "failed") {
        setLogs(job.logs ?? []);
        setError(job.error ?? "Training distribute failed");
        setVideoDistributeJobId(null);
        videoDistributeRequested.current = false;
      }

      if (videoDistributeJobId && job.status === "published") {
        const slug = (job.skillSlug as string) || form.skillSlug || "";
        const pr = job.publishResult as DeviceSkill | undefined;
        setPublishSuccess({
          slug,
          listingKey: pr?.arkivListingKey,
          version: pr?.arkivVersion,
          message: `Training data "${slug}" is listed on Arkiv.`,
        });
        setVideoCaptureJobId(null);
        setVideoDistributeJobId(null);
        videoDistributeRequested.current = false;
        await syncTrainingContributionFromJob(slug, "published", pr, {
          title: form.title,
          description: form.description,
        });
      }

      if (videoCaptureJobId && job.status === "failed") {
        setLogs(job.logs ?? []);
        setError(job.error ?? "Video recording failed");
        setVideoCaptureJobId(null);
      }
    }, 2000);

    return () => clearInterval(id);
  }, [
    videoCaptureJobId,
    videoDistributeJobId,
    form,
    selectedDeviceId,
    syncTrainingContributionFromJob,
  ]);

  async function saveDraft(): Promise<boolean> {
    if (!ensureDeviceSelected()) return false;
    setError("");

    const slug = form.skillSlug || makeSkillSlug(form.title, slugSuffix);
    if (!slug || !form.title.trim() || !form.description.trim()) {
      setError("Title and description are required.");
      return false;
    }

    const saved = await postSkillMd({ ...form, skillSlug: slug }, selectedDeviceId);
    if (!saved.ok) {
      setError(saved.error ?? "Failed to save draft");
      return false;
    }
    const trainingSaved = await postTrainingMd({ ...form, skillSlug: slug }, selectedDeviceId);
    if (!trainingSaved.ok) {
      setError(trainingSaved.error ?? "Failed to save training draft");
      return false;
    }

    await syncContributionFromJob(slug, "draft", undefined, {
      title: form.title,
      description: form.description,
    });
    await syncTrainingContributionFromJob(slug, "draft", undefined, {
      title: form.title,
      description: form.description,
    });

    setDraftSaved(true);
    setForm((f) => ({ ...f, skillSlug: slug }));
    toast.success("Draft saved on device.");
    return true;
  }

  async function startCapture() {
    if (!ensureDeviceSelected()) return;
    const captureSlug = form.skillSlug || makeSkillSlug(form.title, slugSuffix);
    if (!form.skillSlug && captureSlug) {
      setForm((current) => ({ ...current, skillSlug: captureSlug }));
    }

    if (!draftSaved) {
      const ok = await saveDraft();
      if (!ok) return;
    }

    setError("");
    distributeRequested.current = false;
    setLogs(["Starting capture…"]);

    const res = await fetch(`${ORCH}/jobs/capture`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...deviceHeaders(selectedDeviceId) },
      body: JSON.stringify({ skillSlug: captureSlug }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Capture failed to start");
      return;
    }

    setCaptureJobId(data.jobId);

    await syncContributionFromJob(captureSlug, "capturing");
  }

  async function startVideoCapture() {
    if (!ensureDeviceSelected()) return;
    const captureSlug = form.skillSlug || makeSkillSlug(form.title, slugSuffix);
    if (!form.skillSlug && captureSlug) {
      setForm((current) => ({ ...current, skillSlug: captureSlug }));
    }

    if (!draftSaved) {
      const ok = await saveDraft();
      if (!ok) return;
    }

    setError("");
    videoDistributeRequested.current = false;
    setLogs(["Starting video recording…"]);

    const res = await fetch(`${ORCH}/jobs/video-capture`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...deviceHeaders(selectedDeviceId) },
      body: JSON.stringify({ skillSlug: captureSlug }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Video recording failed to start");
      return;
    }

    setVideoCaptureJobId(data.jobId);
    await syncTrainingContributionFromJob(captureSlug, "capturing");
  }

  const recordingBusy =
    !!captureJobId || !!distributeJobId || !!videoCaptureJobId || !!videoDistributeJobId;

  return (
    <div className="flex w-full flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contribute Agent Skills</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Prepare the skill, choose a recording device, then publish the captured session.
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

      <div className="flex gap-2">
        {["Skill brief", "Recording setup", "Capture console"].map((label, index) => (
          <Button
            key={label}
            type="button"
            variant={activeStage === index ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveStage(index)}
          >
            {label}
          </Button>
        ))}
      </div>

      {activeStage === 0 ? (
        <Stage
          step="1"
          title="Skill brief"
          description="Name the skill and define how agents should discover it."
        >
          <FieldGroup>
            <Field>
              <FieldLabel>Title</FieldLabel>
              <Input
                value={form.title}
                onChange={(e) => updateTitle(e.target.value)}
                placeholder="Example: Debug a failing Next.js build"
              />
              {form.skillSlug ? (
                <FieldDescription>Generated slug: {form.skillSlug}</FieldDescription>
              ) : null}
            </Field>
            <Field>
              <FieldLabel>Description</FieldLabel>
              <Textarea
                rows={4}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What does this skill help another agent do?"
              />
            </Field>
            <Field>
              <FieldLabel>Triggers</FieldLabel>
              <Textarea
                className="font-mono text-xs"
                rows={4}
                value={form.triggers}
                onChange={(e) => setForm({ ...form, triggers: e.target.value })}
              />
              <FieldDescription>One trigger per line.</FieldDescription>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>Extra tags</FieldLabel>
                <Input
                  value={form.extraTags}
                  onChange={(e) => setForm({ ...form, extraTags: e.target.value })}
                />
                <FieldDescription>Comma-separated tags.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel>Expertise source</FieldLabel>
                <Input
                  value={form.expertiseSource}
                  onChange={(e) => setForm({ ...form, expertiseSource: e.target.value })}
                />
              </Field>
            </div>
          </FieldGroup>
          <div className="mt-6 flex justify-end">
            <Button type="button" onClick={saveAndContinueFromBrief}>
              Save and continue
            </Button>
          </div>
        </Stage>
      ) : null}

      {activeStage === 1 ? (
        <Stage
          step="2"
          title="Recording setup"
          description="Select the local device that will run the portal."
        >
          <div className="flex max-w-xl flex-col gap-4">
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-sm font-medium">
                {selectedDevice ? selectedDevice.device_name : "No device selected"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {selectedDevice
                  ? selectedDevice.orchestrator_url
                    ? "Ready for portal actions."
                    : "Device is missing a portal URL."
                  : "Choose a device before recording."}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" onClick={() => setDevicePickerOpen(true)}>
                Choose device
              </Button>
              <Button type="button" onClick={saveAndContinueFromSetup}>
                Save and continue
              </Button>
            </div>
          </div>
        </Stage>
      ) : null}

      {activeStage === 2 ? (
        <Stage
          step="3"
          title="Capture console"
          description="Save the skill brief, then start the recording session."
        >
          <div className="flex max-w-2xl flex-col gap-4">
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                onClick={() => void saveDraft()}
                variant="secondary"
                disabled={!selectedDeviceId || recordingBusy}
              >
                Save draft
              </Button>
              <Button
                type="button"
                onClick={() => void startCapture()}
                disabled={
                  !form.title.trim() ||
                  !form.description.trim() ||
                  !selectedDeviceId ||
                  recordingBusy
                }
              >
                Start recording
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void startVideoCapture()}
                disabled={
                  !form.title.trim() ||
                  !form.description.trim() ||
                  !selectedDeviceId ||
                  recordingBusy
                }
              >
                Record Training data
              </Button>
            </div>

            {captureJobId || distributeJobId || videoCaptureJobId || videoDistributeJobId || logs.length > 0 ? (
              <div className="max-h-64 overflow-auto rounded-lg border bg-muted/50 p-3 font-mono text-xs text-muted-foreground">
                {captureJobId ? (
                  <p className="mb-2 text-foreground">
                    Type <strong>q</strong> and press Enter in the <strong>orchestrator</strong> terminal to stop recording.
                  </p>
                ) : null}
                {videoCaptureJobId ? (
                  <p className="mb-2 text-foreground">
                    Type <strong>q</strong> and press Enter in the <strong>orchestrator</strong> terminal to stop{" "}
                    <strong>video recording</strong>.
                  </p>
                ) : null}
                {logs.slice(-60).map((line, index) => (
                  <div key={`${line}-${index}`}>{line}</div>
                ))}
              </div>
            ) : null}
          </div>
        </Stage>
      ) : null}

      <DeviceChooserDialog
        open={devicePickerOpen}
        onOpenChange={setDevicePickerOpen}
        devices={devices}
        selectedDeviceId={selectedDeviceId}
        deviceChoiceId={deviceChoiceId}
        onChoiceChange={setDeviceChoiceId}
        onSelect={selectDevice}
      />

      <Dialog open={!!quitHref} onOpenChange={(open) => !open && setQuitHref(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Quit contribution?</DialogTitle>
            <DialogDescription>
              All progress in this contribution flow will be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setQuitHref(null)}>
              Stay here
            </Button>
            <Button type="button" variant="destructive" onClick={confirmQuitProgress}>
              Quit and delete progress
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
