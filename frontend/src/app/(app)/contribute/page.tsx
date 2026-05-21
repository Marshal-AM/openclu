"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
};

const ORCH = "/api/orch";

function isPublishedOnDevice(s: DeviceSkill): boolean {
  return s.arkivStatus === "published" || !!s.arkivListingKey;
}

export default function ContributePage() {
  const [form, setForm] = useState<MetadataForm>({
    skillSlug: "",
    title: "",
    description: "",
    triggers: "",
    extraTags: "",
    expertiseSource: "",
    recordedAt: new Date().toISOString().slice(0, 16),
  });
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
  const distributeRequested = useRef(false);

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
    const published = skills.filter(isPublishedOnDevice);
    if (published.length === 0) return;

    const failures: string[] = [];
    for (const s of published) {
      const postRes = await fetch("/api/contributions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skillSlug: s.skillSlug,
          status: "published",
          arkivListingKey: s.arkivListingKey,
          arkivVersion: s.arkivVersion,
        }),
      });
      if (!postRes.ok) {
        const err = await postRes.json().catch(() => ({}));
        failures.push(
          `${s.skillSlug}: ${(err as { error?: string }).error ?? postRes.status}`,
        );
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
        const dRes = await fetch(`${ORCH}/jobs/${captureJobId}/distribute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
        const slug = (job.skillSlug as string) || form.skillSlug;
        const pr = job.publishResult as DeviceSkill | undefined;
        setPublishSuccess({
          slug,
          listingKey: pr?.arkivListingKey,
        });
        setCaptureJobId(null);
        setDistributeJobId(null);
        distributeRequested.current = false;
        const postRes = await fetch("/api/contributions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            skillSlug: slug,
            status: "published",
            arkivListingKey: pr?.arkivListingKey,
            arkivVersion: pr?.arkivVersion,
            title: form.title || undefined,
            description: form.description || undefined,
          }),
        });
        if (!postRes.ok) {
          const err = await postRes.json().catch(() => ({}));
          setContributionsError(
            (err as { error?: string }).error ?? "Published on device but failed to save to Supabase",
          );
        }
        await loadContributions();
      }
      if (captureJobId && job.status === "failed") {
        setLogs(job.logs ?? []);
        setError(job.error ?? "Capture failed");
        setCaptureJobId(null);
      }
    }, 2000);
    return () => clearInterval(id);
  }, [captureJobId, distributeJobId, form.skillSlug, loadContributions]);

  async function saveDraft(): Promise<boolean> {
    setError("");
    const slug = form.skillSlug.toLowerCase().replace(/\s+/g, "-");
    if (!slug || !form.title.trim() || !form.description.trim()) {
      setError("Skill slug, title, and description are required.");
      return false;
    }
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
        triggers,
        extraTags,
        expertiseSource: form.expertiseSource || undefined,
        recordedAt: form.recordedAt ? new Date(form.recordedAt).toISOString() : undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to save draft");
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

  async function viewSkill(slug: string) {
    setSelectedSkill(slug);
    const res = await fetch(`/api/catalog/${slug}`);
    if (res.ok) setCatalogDetail(await res.json());
    else setCatalogDetail(null);
  }

  async function archiveSkill(slug: string) {
    await fetch(`${ORCH}/jobs/archive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skillSlug: slug }),
    });
    loadContributions();
  }

  async function republishSkill(slug: string) {
    await fetch(`${ORCH}/jobs/republish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skillSlug: slug }),
    });
  }

  return (
    <div className="max-w-4xl space-y-10">
      {publishSuccess && (
        <div
          role="status"
          className="rounded-lg border border-emerald-700 bg-emerald-950/60 px-4 py-3 text-emerald-200"
        >
          <p className="font-medium">
            Skill &ldquo;{publishSuccess.slug}&rdquo; is listed on Arkiv.
          </p>
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
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              Skill slug
              <input
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
                value={form.skillSlug}
                onChange={(e) => {
                  setDraftSaved(false);
                  setForm({ ...form, skillSlug: e.target.value });
                }}
              />
            </label>
            <label className="text-sm">
              Title
              <input
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
                value={form.title}
                onChange={(e) => {
                  setDraftSaved(false);
                  setForm({ ...form, title: e.target.value });
                }}
              />
            </label>
          </div>
          <label className="text-sm">
            Description
            <textarea
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
              rows={3}
              value={form.description}
              onChange={(e) => {
                setDraftSaved(false);
                setForm({ ...form, description: e.target.value });
              }}
            />
          </label>
          <label className="text-sm">
            Triggers (one per line)
            <textarea
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-xs"
              rows={3}
              value={form.triggers}
              onChange={(e) => {
                setDraftSaved(false);
                setForm({ ...form, triggers: e.target.value });
              }}
            />
          </label>
          <label className="text-sm">
            Extra tags (comma-separated)
            <input
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
              value={form.extraTags}
              onChange={(e) => {
                setDraftSaved(false);
                setForm({ ...form, extraTags: e.target.value });
              }}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              Expertise source
              <input
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
                value={form.expertiseSource}
                onChange={(e) => setForm({ ...form, expertiseSource: e.target.value })}
              />
            </label>
            <label className="text-sm">
              Recorded at
              <input
                type="datetime-local"
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
                value={form.recordedAt}
                onChange={(e) => setForm({ ...form, recordedAt: e.target.value })}
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={saveDraft}
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
                !!distributeJobId
              }
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-40"
            >
              Start recording
            </button>
          </div>
          {draftSaved && (
            <p className="text-xs text-emerald-400">Draft saved on device. Start recording when ready.</p>
          )}
          {!draftSaved &&
            form.skillSlug.trim() &&
            form.title.trim() &&
            form.description.trim() && (
              <p className="text-xs text-zinc-500">
                Start recording will save the draft on your device first, then open capture in the terminal.
              </p>
            )}
          {(captureJobId || distributeJobId || (error && logs.length > 0)) && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs text-zinc-400 max-h-64 overflow-auto">
              <p className="mb-2 text-amber-300">
                Press Q in the <strong>orchestrator</strong> terminal (where npm run start runs) to stop
                recording. Logs also appear there.
              </p>
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
        {contributions.length === 0 && !contributionsError && (
          <p className="mt-2 text-sm text-zinc-500">
            No contributions yet. Save a draft or publish a skill — published skills on your device
            sync here automatically.
          </p>
        )}
        <ul className="mt-4 space-y-2">
          {contributions.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 px-4 py-3"
            >
              <div>
                <span className="font-medium">{c.skill_slug}</span>
                <span
                  className={`ml-2 text-xs ${
                    c.status === "published" ? "text-emerald-400" : "text-zinc-500"
                  }`}
                >
                  {c.status}
                </span>
                {c.arkiv_listing_key && (
                  <p className="mt-0.5 font-mono text-[10px] text-zinc-600 truncate max-w-md">
                    {c.arkiv_listing_key}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="text-xs text-emerald-400 hover:underline"
                  onClick={() => viewSkill(c.skill_slug)}
                >
                  View
                </button>
                <button
                  type="button"
                  className="text-xs text-zinc-400 hover:underline"
                  onClick={() => republishSkill(c.skill_slug)}
                >
                  Republish
                </button>
                <button
                  type="button"
                  className="text-xs text-red-400 hover:underline"
                  onClick={() => archiveSkill(c.skill_slug)}
                >
                  Archive
                </button>
              </div>
            </li>
          ))}
        </ul>
        {selectedSkill && catalogDetail && (
          <pre className="mt-4 max-h-96 overflow-auto rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-xs">
            {JSON.stringify(catalogDetail, null, 2)}
          </pre>
        )}
      </section>
    </div>
  );
}
