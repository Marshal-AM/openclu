"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CatalogDetailPanel } from "@/components/CatalogDetailPanel";
import { useOrchestratorJob } from "@/hooks/useOrchestratorJob";

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

async function postSkillMd(form: MetadataForm): Promise<{ ok: boolean; error?: string }> {
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
    headers: { "Content-Type": "application/json" },
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
  const [catalogDetail, setCatalogDetail] = useState<Record<string, unknown> | null>(null);
  const [publishSuccess, setPublishSuccess] = useState<PublishSuccess | null>(null);
  const [contributionsError, setContributionsError] = useState("");

  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<MetadataForm | null>(null);
  const [editDraftMeta, setEditDraftMeta] = useState<DraftPayload | null>(null);
  const [orchJobId, setOrchJobId] = useState<string | null>(null);
  const orchJobLabelRef = useRef("");

  const distributeRequested = useRef(false);
  const recaptureDistributeRequested = useRef(false);
  const editFormRef = useRef<MetadataForm | null>(null);
  editFormRef.current = editForm;

  const loadContributions = useCallback(async () => {
    const res = await fetch("/api/contributions");
    if (res.ok) {
      const data = await res.json();
      setContributions(data.contributions ?? []);
      setContributionsError("");
    } else {
      const data = await res.json().catch(() => ({}));
      setContributionsError(
        (data as { error?: string }).error ?? `Could not load contributions (${res.status})`,
      );
    }
  }, []);

  const syncContributionFromJob = useCallback(
    async (
      slug: string,
      status: string,
      pr?: DeviceSkill,
      meta?: { title?: string; description?: string },
    ) => {
      await fetch("/api/contributions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
    [loadContributions],
  );

  const syncPublishedFromDevice = useCallback(async () => {
    const res = await fetch(`${ORCH}/skills`);
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
  }, []);

  useEffect(() => {
    void (async () => {
      await syncPublishedFromDevice();
      await loadContributions();
    })();
  }, [syncPublishedFromDevice, loadContributions]);

  const { logs: orchLogs } = useOrchestratorJob(orchJobId, {
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
      const res = await fetch(`${ORCH}/jobs/${jobId}`);
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
          headers: { "Content-Type": "application/json" },
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
  }, [captureJobId, distributeJobId, form.skillSlug, editingSlug, editForm, syncContributionFromJob]);

  async function saveDraft(): Promise<boolean> {
    setError("");
    const slug = form.skillSlug.toLowerCase().replace(/\s+/g, "-");
    if (!slug || !form.title.trim() || !form.description.trim()) {
      setError("Skill slug, title, and description are required.");
      return false;
    }
    const saved = await postSkillMd({ ...form, skillSlug: slug });
    if (!saved.ok) {
      setError(saved.error ?? "Failed to save draft");
      return false;
    }
    await fetch("/api/contributions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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
      headers: { "Content-Type": "application/json" },
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
      body: JSON.stringify({ skillSlug: form.skillSlug, status: "capturing", jobId: data.jobId }),
    });
  }

  async function openEdit(slug: string) {
    setError("");
    setSelectedSkill(null);
    setCatalogDetail(null);
    const res = await fetch(`${ORCH}/skills/${slug}/draft`);
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
    setError("");
    const saved = await postSkillMd(editForm);
    if (!saved.ok) {
      setError(saved.error ?? "Failed to update SKILL.md");
      return;
    }
    setLogs(["Updating Arkiv catalog…"]);
    const res = await fetch(`${ORCH}/jobs/update-catalog`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    const ok = window.confirm(
      "Re-record & republish creates a new Story IP asset and CDR vault. Existing buyers keep access to the old vault; new buyers need the new listing. Continue?",
    );
    if (!ok) return;
    setError("");
    const saved = await postSkillMd(editForm);
    if (!saved.ok) {
      setError(saved.error ?? "Failed to save SKILL.md");
      return;
    }
    distributeRequested.current = false;
    recaptureDistributeRequested.current = true;
    setLogs(["Starting re-capture…"]);
    const res = await fetch(`${ORCH}/jobs/capture`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    const ok = window.confirm(
      "Re-encrypt & republish runs full distribute (new IP + vault) without re-recording. Continue?",
    );
    if (!ok) return;
    setError("");
    setLogs(["Starting full republish…"]);
    const res = await fetch(`${ORCH}/jobs/republish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    const ok = window.confirm(
      `Remove "${slug}" from the marketplace? This archives the Arkiv listing (soft delete).`,
    );
    if (!ok) return;
    setError("");
    setLogs(["Archiving on Arkiv…"]);
    const res = await fetch(`${ORCH}/jobs/archive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

  const visibleContributions = contributions.filter((c) => c.status !== "archived");

  function renderMetadataFields(
    value: MetadataForm,
    onChange: (f: MetadataForm) => void,
    slugReadOnly: boolean,
  ) {
    return (
      <>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            Skill slug
            <input
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 disabled:opacity-50"
              value={value.skillSlug}
              readOnly={slugReadOnly}
              disabled={slugReadOnly}
              onChange={(e) => onChange({ ...value, skillSlug: e.target.value })}
            />
          </label>
          <label className="text-sm">
            Title
            <input
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
              value={value.title}
              onChange={(e) => onChange({ ...value, title: e.target.value })}
            />
          </label>
        </div>
        <label className="text-sm">
          Description
          <textarea
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
            rows={3}
            value={value.description}
            onChange={(e) => onChange({ ...value, description: e.target.value })}
          />
        </label>
        <label className="text-sm">
          Triggers (one per line)
          <textarea
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-xs"
            rows={3}
            value={value.triggers}
            onChange={(e) => onChange({ ...value, triggers: e.target.value })}
          />
        </label>
        <label className="text-sm">
          Extra tags (comma-separated)
          <input
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
            value={value.extraTags}
            onChange={(e) => onChange({ ...value, extraTags: e.target.value })}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            Expertise source
            <input
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
              value={value.expertiseSource}
              onChange={(e) => onChange({ ...value, expertiseSource: e.target.value })}
            />
          </label>
          <label className="text-sm">
            Recorded at
            <input
              type="datetime-local"
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
              value={value.recordedAt}
              onChange={(e) => onChange({ ...value, recordedAt: e.target.value })}
            />
          </label>
        </div>
      </>
    );
  }

  return (
    <div className="max-w-4xl space-y-10">
      {publishSuccess && (
        <div
          role="status"
          className="rounded-lg border border-emerald-700 bg-emerald-950/60 px-4 py-3 text-emerald-200"
        >
          <p className="font-medium">
            {publishSuccess.message ??
              `Skill "${publishSuccess.slug}" is listed on Arkiv.`}
          </p>
          {publishSuccess.version != null && (
            <p className="mt-1 text-xs text-emerald-400/90">Version {publishSuccess.version}</p>
          )}
          {publishSuccess.listingKey && (
            <p className="mt-1 font-mono text-xs text-emerald-400/90">
              Listing: {publishSuccess.listingKey}
            </p>
          )}
          <button
            type="button"
            className="mt-2 text-xs text-emerald-300 underline hover:text-emerald-100"
            onClick={() => setPublishSuccess(null)}
          >
            Dismiss
          </button>
        </div>
      )}
      <section>
        <h1 className="text-2xl font-semibold">Contribute Agent Skills</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Step 1: metadata (required). Step 2: record in terminal (press Q). Step 3: auto-publish.
        </p>

        <div className="mt-6 grid gap-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          {renderMetadataFields(form, setForm, false)}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void saveDraft()}
              className="rounded-lg bg-zinc-700 px-4 py-2 text-sm font-medium hover:bg-zinc-600"
            >
              Save draft
            </button>
            <button
              type="button"
              onClick={() => void startCapture()}
              disabled={
                !form.skillSlug.trim() ||
                !form.title.trim() ||
                !form.description.trim() ||
                !!captureJobId ||
                !!distributeJobId ||
                !!orchJobId
              }
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-40"
            >
              Start recording
            </button>
          </div>
          {draftSaved && (
            <p className="text-xs text-emerald-400">Draft saved on device. Start recording when ready.</p>
          )}
          {(captureJobId || distributeJobId || orchJobId || (error && logs.length > 0)) && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs text-zinc-400 max-h-64 overflow-auto">
              {captureJobId && (
                <p className="mb-2 text-amber-300">
                  Press Q in the <strong>orchestrator</strong> terminal to stop recording.
                </p>
              )}
              {logs.slice(-60).map((l, i) => (
                <div key={i}>{l}</div>
              ))}
            </div>
          )}
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium">My contributions</h2>
        {contributionsError && (
          <p className="mt-2 text-sm text-amber-400">{contributionsError}</p>
        )}
        {visibleContributions.length === 0 && !contributionsError && (
          <p className="mt-2 text-sm text-zinc-500">
            No active contributions. Save a draft or publish a skill — published skills on your device
            sync here automatically.
          </p>
        )}
        <ul className="mt-4 space-y-2">
          {visibleContributions.map((c) => (
            <li
              key={c.id}
              className="rounded-lg border border-zinc-800 px-4 py-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-medium">{c.skill_slug}</span>
                  <span
                    className={`ml-2 text-xs ${
                      c.status === "published" ? "text-emerald-400" : "text-zinc-500"
                    }`}
                  >
                    {c.status}
                    {c.arkiv_version != null && c.status === "published" && (
                      <span className="text-zinc-500"> · v{c.arkiv_version}</span>
                    )}
                  </span>
                  {c.arkiv_listing_key && (
                    <p className="mt-0.5 font-mono text-[10px] text-zinc-600 truncate max-w-md">
                      {c.arkiv_listing_key}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="text-xs text-sky-400 hover:underline"
                    onClick={() => void openEdit(c.skill_slug)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="text-xs text-emerald-400 hover:underline"
                    onClick={() => void viewSkill(c.skill_slug)}
                  >
                    View
                  </button>
                  {c.status === "published" && (
                    <button
                      type="button"
                      className="text-xs text-zinc-400 hover:underline"
                      onClick={() => void fullRepublish(c.skill_slug)}
                      disabled={!!orchJobId || !!captureJobId}
                    >
                      Re-encrypt
                    </button>
                  )}
                  <button
                    type="button"
                    className="text-xs text-red-400 hover:underline"
                    onClick={() => void archiveSkill(c.skill_slug)}
                    disabled={!!orchJobId}
                  >
                    Archive
                  </button>
                </div>
              </div>
              {editingSlug === c.skill_slug && editForm && (
                <div className="mt-4 grid gap-4 border-t border-zinc-800 pt-4">
                  <p className="text-sm text-zinc-400">
                    Edit catalog metadata
                    {editDraftMeta?.arkivVersion != null && (
                      <span className="text-zinc-500"> (current Arkiv v{editDraftMeta.arkivVersion})</span>
                    )}
                  </p>
                  {renderMetadataFields(editForm, setEditForm, true)}
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-40"
                      onClick={() => void saveMetadataEdit()}
                      disabled={!!orchJobId || !!captureJobId || !editForm.title.trim()}
                    >
                      Save metadata to Arkiv
                    </button>
                    {editDraftMeta?.arkivListingKey && (
                      <button
                        type="button"
                        className="rounded-lg border border-amber-700/60 px-4 py-2 text-sm text-amber-200 hover:bg-amber-950/40 disabled:opacity-40"
                        onClick={() => void startRecaptureRepublish()}
                        disabled={!!orchJobId || !!captureJobId || !!distributeJobId}
                      >
                        Re-record &amp; republish
                      </button>
                    )}
                    <button
                      type="button"
                      className="text-sm text-zinc-500 hover:text-zinc-300"
                      onClick={() => {
                        setEditingSlug(null);
                        setEditForm(null);
                        setEditDraftMeta(null);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
        {selectedSkill && catalogDetail && (
          <div className="mt-4">
            {catalogDetail.error ? (
              <p className="text-sm text-red-400">{String(catalogDetail.error)}</p>
            ) : (
              <CatalogDetailPanel
                detail={catalogDetail}
                onClose={() => {
                  setSelectedSkill(null);
                  setCatalogDetail(null);
                }}
              />
            )}
          </div>
        )}
      </section>
    </div>
  );
}
