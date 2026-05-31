import "dotenv/config";
import cors from "cors";
import express from "express";
import { resolve } from "node:path";
import { config } from "dotenv";
import { SKILL_CAPTURE_ROOT } from "../../db/src/lib/device-wallet.js";
import { readDraftSkill, writeDraftSkillMd, type SkillMetadataInput } from "./skill-md.js";
import { writeDraftTrainingMd, type TrainingMetadataInput } from "./training-md.js";
import {
  getJob,
  getSpawnPreflight,
  startCatalogJob,
  startCaptureJob,
  startDistributeJob,
  startDistributeTrainingJob,
  startVideoCaptureJob,
} from "./jobs.js";
import { listDeviceSkills, readPublishResult } from "./skill-manifest.js";
import { startNgrokTunnel, stopNgrokTunnel } from "./ngrok.js";

config({ path: resolve(SKILL_CAPTURE_ROOT, ".env") });
config({ path: resolve(SKILL_CAPTURE_ROOT, "cdr", ".env"), override: false });

const PORT = Number(process.env.ORCHESTRATOR_PORT ?? "8790");
const HOST = "127.0.0.1";

let publicOrchestratorUrl: string | null = null;

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  const preflight = getSpawnPreflight();
  res.json({
    ok: true,
    service: "skill-capture-orchestrator",
    port: PORT,
    localUrl: `http://${HOST}:${PORT}`,
    publicUrl: publicOrchestratorUrl,
    preflight,
  });
});

app.post("/api/v1/jobs/skill-md", (req, res) => {
  try {
    const body = req.body as SkillMetadataInput;
    if (!body.skillSlug || !body.title || !body.description) {
      res.status(400).json({ error: "skillSlug, title, description required" });
      return;
    }
    const path = writeDraftSkillMd({
      ...body,
      skillSlug: body.skillSlug.toLowerCase().replace(/\s+/g, "-"),
      triggers: body.triggers?.length ? body.triggers : ["general"],
    });
    res.json({ ok: true, path });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

app.post("/api/v1/jobs/capture", (req, res) => {
  const { skillSlug } = req.body as { skillSlug?: string };
  if (!skillSlug) {
    res.status(400).json({ error: "skillSlug required" });
    return;
  }
  const job = startCaptureJob(skillSlug);
  res.json({ jobId: job.id, status: job.status, jobKind: job.jobKind });
});

app.post("/api/v1/jobs/training-md", (req, res) => {
  try {
    const body = req.body as TrainingMetadataInput;
    if (!body.skillSlug || !body.title || !body.description) {
      res.status(400).json({ error: "skillSlug, title, description required" });
      return;
    }
    const path = writeDraftTrainingMd({
      ...body,
      skillSlug: body.skillSlug.toLowerCase().replace(/\s+/g, "-"),
      triggers: body.triggers?.length ? body.triggers : ["general"],
    });
    res.json({ ok: true, path });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

app.post("/api/v1/jobs/video-capture", (req, res) => {
  const { skillSlug } = req.body as { skillSlug?: string };
  if (!skillSlug) {
    res.status(400).json({ error: "skillSlug required" });
    return;
  }
  const job = startVideoCaptureJob(skillSlug);
  res.json({ jobId: job.id, status: job.status, jobKind: job.jobKind });
});

app.get("/api/v1/skills", (_req, res) => {
  res.json({ skills: listDeviceSkills() });
});

app.get("/api/v1/skills/:slug/manifest", (req, res) => {
  const slug = req.params.slug;
  const manifest = readPublishResult(slug);
  if (!manifest) {
    res.status(404).json({ error: `No cdr-manifest.json for skill "${slug}"` });
    return;
  }
  res.json({ manifest });
});

app.get("/api/v1/skills/:slug/draft", (req, res) => {
  const slug = req.params.slug;
  const draft = readDraftSkill(slug);
  if (!draft) {
    res.status(404).json({ error: `No SKILL.md for skill "${slug}"` });
    return;
  }
  res.json({ draft });
});

app.get("/api/v1/jobs/:id", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json(job);
});

app.post("/api/v1/jobs/:id/distribute", (req, res) => {
  const captureJob = getJob(req.params.id);
  const skillSlug =
    (req.body as { skillSlug?: string }).skillSlug ?? captureJob?.skillSlug;
  if (!skillSlug) {
    res.status(400).json({ error: "skillSlug required" });
    return;
  }
  if (captureJob && captureJob.exitCode !== 0 && captureJob.status === "failed") {
    res.status(400).json({ error: "Capture job failed - cannot distribute" });
    return;
  }
  try {
    const job = startDistributeJob(skillSlug);
    if (job.status === "failed" && job.error) {
      res.status(500).json({ error: job.error, jobId: job.id, status: job.status, logs: job.logs });
      return;
    }
    res.json({ jobId: job.id, status: job.status, jobKind: job.jobKind });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

app.post("/api/v1/jobs/:id/distribute-training", (req, res) => {
  const captureJob = getJob(req.params.id);
  const skillSlug =
    (req.body as { skillSlug?: string }).skillSlug ?? captureJob?.skillSlug;
  if (!skillSlug) {
    res.status(400).json({ error: "skillSlug required" });
    return;
  }
  if (captureJob && captureJob.exitCode !== 0 && captureJob.status === "failed") {
    res.status(400).json({ error: "Video capture job failed - cannot distribute" });
    return;
  }
  try {
    const job = startDistributeTrainingJob(skillSlug);
    if (job.status === "failed" && job.error) {
      res.status(500).json({ error: job.error, jobId: job.id, status: job.status, logs: job.logs });
      return;
    }
    res.json({ jobId: job.id, status: job.status, jobKind: job.jobKind });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

app.post("/api/v1/jobs/archive", (req, res) => {
  const { skillSlug } = req.body as { skillSlug?: string };
  if (!skillSlug) {
    res.status(400).json({ error: "skillSlug required" });
    return;
  }
  const job = startCatalogJob("archive-skill", skillSlug);
  res.json({ jobId: job.id });
});

app.post("/api/v1/jobs/extend", (req, res) => {
  const { skillSlug } = req.body as { skillSlug?: string };
  if (!skillSlug) {
    res.status(400).json({ error: "skillSlug required" });
    return;
  }
  const job = startCatalogJob("extend-skill", skillSlug);
  res.json({ jobId: job.id });
});

app.post("/api/v1/jobs/republish", (req, res) => {
  const { skillSlug } = req.body as { skillSlug?: string };
  if (!skillSlug) {
    res.status(400).json({ error: "skillSlug required" });
    return;
  }
  const job = startCatalogJob("republish-skill", skillSlug);
  res.json({ jobId: job.id });
});

app.post("/api/v1/jobs/update-catalog", (req, res) => {
  const { skillSlug } = req.body as { skillSlug?: string };
  if (!skillSlug) {
    res.status(400).json({ error: "skillSlug required" });
    return;
  }
  const job = startCatalogJob("update-catalog", skillSlug);
  res.json({ jobId: job.id, status: job.status });
});

async function main() {
  publicOrchestratorUrl = await startNgrokTunnel(PORT);

  app.listen(PORT, HOST, () => {
    console.log(`Orchestrator listening on http://${HOST}:${PORT}`);
    if (publicOrchestratorUrl) {
      console.log(`Orchestrator public (ngrok): ${publicOrchestratorUrl}`);
    } else {
      console.warn(
        "No ngrok URL — set NGROK_AUTHTOKEN in skill-capture/.env and pip install pyngrok in venv",
      );
    }
  });
}

function shutdown() {
  stopNgrokTunnel();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
