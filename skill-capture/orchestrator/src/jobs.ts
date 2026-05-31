import { type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import {
  SKILL_CAPTURE_ROOT,
  getSpawnPreflight,
  resolveTsxCli,
  resolveVenvPython,
  spawnNodeTsx,
  spawnVenvPython,
} from "../../lib/spawn-util.js";
import { readPublishResult, type PublishResult } from "./skill-manifest.js";
import { readTrainingPublishResult } from "./training-manifest.js";
import { startCaptureQuitListener, stopCaptureQuitListener } from "./capture-quit-listener.js";
import { captureDevMode, resolveFixedMediaInput } from "./capture-config.js";

export type JobStatus =
  | "queued"
  | "capturing"
  | "processing"
  | "distributing"
  | "published"
  | "failed";

export type JobKind = "skill" | "training";

export interface Job {
  id: string;
  skillSlug: string;
  jobKind: JobKind;
  status: JobStatus;
  logs: string[];
  exitCode: number | null;
  error?: string;
  /** Set when distribute / republish finishes successfully (from cdr-manifest.json). */
  publishResult?: PublishResult;
}

const jobs = new Map<string, Job>();

function captureEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    CDR_PUBLISH: "0",
    PYTHONUNBUFFERED: "1",
    PYTHONIOENCODING: "utf-8",
  };
}

function appendLog(job: Job, line: string) {
  job.logs.push(line);
  if (job.logs.length > 500) job.logs.shift();
}

function wireChildOutput(job: Job, child: ChildProcess, prefix: string) {
  const handle = (chunk: Buffer, isErr: boolean) => {
    const text = chunk.toString();
    for (const line of text.split(/\r?\n/)) {
      const t = line.trimEnd();
      if (!t) continue;
      appendLog(job, t);
      const tag = isErr ? `${prefix} stderr` : prefix;
      console.log(`[${tag}] ${t}`);
    }
  };
  child.stdout?.on("data", (d) => handle(d, false));
  child.stderr?.on("data", (d) => handle(d, true));
}

function attachChildHandlers(
  job: Job,
  child: ChildProcess,
  prefix: string,
  onSuccess: () => void,
  onFailMsg: (code: number | null) => string,
) {
  wireChildOutput(job, child, prefix);

  child.on("error", (err) => {
    job.status = "failed";
    job.exitCode = 1;
    job.error = err.message;
    appendLog(job, `Spawn error: ${err.message}`);
    console.error(`[${prefix}] spawn error:`, err);
  });

  child.on("close", (code) => {
    stopCaptureQuitListener();
    job.exitCode = code ?? 1;
    if (code === 0) {
      onSuccess();
    } else {
      job.status = "failed";
      job.error = onFailMsg(code);
      console.error(`[${prefix}] failed exit ${code}`);
    }
  });
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

export { getSpawnPreflight };

export function startCaptureJob(skillSlug: string): Job {
  const id = randomUUID();
  const job: Job = {
    id,
    skillSlug,
    jobKind: "skill",
    status: "capturing",
    logs: [
      `Starting capture for "${skillSlug}" - type q and press Enter in this terminal to stop.`,
      `Python: ${resolveVenvPython()}`,
    ],
    exitCode: null,
  };
  jobs.set(id, job);

  const pre = getSpawnPreflight();
  if (!pre.hasGroqKey) {
    job.status = "failed";
    job.exitCode = 1;
    job.error = pre.issues.join("; ");
    appendLog(job, job.error);
    return job;
  }

  const skillMd = resolve(SKILL_CAPTURE_ROOT, "skills", skillSlug, "SKILL.md");
  if (!existsSync(skillMd)) {
    job.status = "failed";
    job.exitCode = 1;
    job.error = `Draft SKILL.md missing at skills/${skillSlug}/SKILL.md - save metadata first`;
    appendLog(job, job.error);
    console.error(`[capture] ${job.error}`);
    return job;
  }

  try {
    const child = spawnVenvPython(
      resolve(SKILL_CAPTURE_ROOT, "capture.py"),
      [skillSlug, "--no-distribute"],
      { env: captureEnv(), stdio: ["pipe", "pipe", "pipe"] },
    );
    startCaptureQuitListener(child);
    attachChildHandlers(
      job,
      child,
      `capture:${skillSlug}`,
      () => {
        job.status = "processing";
        appendLog(job, "Capture finished - bundle ready for distribute.");
      },
      (code) => `Capture exited with code ${code}`,
    );
  } catch (e) {
    job.status = "failed";
    job.exitCode = 1;
    job.error = e instanceof Error ? e.message : String(e);
    appendLog(job, job.error);
  }

  return job;
}

export function startVideoCaptureJob(skillSlug: string): Job {
  const fixedMedia = resolveFixedMediaInput();
  const id = randomUUID();
  const job: Job = {
    id,
    skillSlug,
    jobKind: "training",
    status: "capturing",
    logs: [
      `Starting video recording (camera + microphone) for "${skillSlug}" - type q and press Enter in this terminal to stop.`,
      `Python: ${resolveVenvPython()}`,
    ],
    exitCode: null,
  };
  jobs.set(id, job);

  const trainingMd = resolve(SKILL_CAPTURE_ROOT, "training-data", skillSlug, "TRAINING.md");
  if (!existsSync(trainingMd)) {
    job.status = "failed";
    job.exitCode = 1;
    job.error = `Draft TRAINING.md missing at training-data/${skillSlug}/TRAINING.md - save metadata first`;
    appendLog(job, job.error);
    return job;
  }

  const bundleDir = resolve(SKILL_CAPTURE_ROOT, "training-data", skillSlug);
  for (const name of ["video.b64", "video.meta.json"]) {
    const p = resolve(bundleDir, name);
    if (existsSync(p)) {
      try {
        unlinkSync(p);
        appendLog(job, `Removed stale ${name} before new capture.`);
      } catch {
        appendLog(job, `Warning: could not remove old ${name}`);
      }
    }
  }

  if (captureDevMode && !fixedMedia) {
    job.status = "failed";
    job.exitCode = 1;
    job.error = "Video capture source is not available";
    appendLog(job, job.error);
    return job;
  }

  const env = captureEnv();
  if (fixedMedia) {
    env.SKILL_CAPTURE_MEDIA_INPUT = fixedMedia;
  }

  try {
    const child = spawnVenvPython(
      resolve(SKILL_CAPTURE_ROOT, "video_capture.py"),
      [skillSlug, "--no-distribute"],
      { env, stdio: ["pipe", "pipe", "pipe"] },
    );
    startCaptureQuitListener(child);
    attachChildHandlers(
      job,
      child,
      `video-capture:${skillSlug}`,
      () => {
        job.status = "processing";
        appendLog(job, "Video recording finished - bundle ready for distribute.");
      },
      (code) => `Video capture exited with code ${code}`,
    );
  } catch (e) {
    job.status = "failed";
    job.exitCode = 1;
    job.error = e instanceof Error ? e.message : String(e);
    appendLog(job, job.error);
  }

  return job;
}

export function startDistributeJob(skillSlug: string): Job {
  const id = randomUUID();
  const job: Job = {
    id,
    skillSlug,
    jobKind: "skill",
    status: "distributing",
    logs: ["Starting local distribute (Story + Helia + catalog)..."],
    exitCode: null,
  };
  jobs.set(id, job);

  try {
    resolveTsxCli();
  } catch (e) {
    job.status = "failed";
    job.exitCode = 1;
    job.error = e instanceof Error ? e.message : String(e);
    appendLog(job, job.error);
    return job;
  }

  const cliDir = resolve(SKILL_CAPTURE_ROOT, "cli");
  const pipeline = resolve(cliDir, "src", "pipeline.ts");

  try {
    const child = spawnNodeTsx(pipeline, ["distribute", skillSlug], {
      cwd: cliDir,
      env: process.env,
      tsxDirs: [cliDir],
    });
    attachChildHandlers(
      job,
      child,
      `distribute:${skillSlug}`,
      () => {
        job.status = "published";
        job.publishResult = readPublishResult(skillSlug) ?? undefined;
        appendLog(job, "Publish complete.");
        if (job.publishResult?.catalogListingId) {
          appendLog(job, `Catalog listing ${job.publishResult.catalogListingId}`);
        }
      },
      (code) => `Distribute exited with code ${code}`,
    );
  } catch (e) {
    job.status = "failed";
    job.exitCode = 1;
    job.error = e instanceof Error ? e.message : String(e);
    appendLog(job, job.error);
    console.error(`[distribute]`, e);
  }

  return job;
}

export function startDistributeTrainingJob(skillSlug: string): Job {
  const id = randomUUID();
  const job: Job = {
    id,
    skillSlug,
    jobKind: "training",
    status: "distributing",
    logs: ["Starting training data distribute (Story + Helia + catalog)..."],
    exitCode: null,
  };
  jobs.set(id, job);

  const bundleDir = resolve(SKILL_CAPTURE_ROOT, "training-data", skillSlug);
  const videoB64 = resolve(bundleDir, "video.b64");
  if (!existsSync(videoB64)) {
    job.status = "failed";
    job.exitCode = 1;
    job.error = `video.b64 missing at training-data/${skillSlug}/ - complete video recording first`;
    appendLog(job, job.error);
    return job;
  }

  const metaPath = resolve(bundleDir, "video.meta.json");
  if (existsSync(metaPath)) {
    try {
      const meta = JSON.parse(readFileSync(metaPath, "utf-8")) as {
        durationSec?: number;
        byteLength?: number;
        captureSource?: string;
      };
      const minDur = Number(process.env.TRAINING_MIN_PUBLISH_DURATION_SEC ?? "50");
      if ((meta.durationSec ?? 0) < minDur) {
        job.status = "failed";
        job.exitCode = 1;
        job.error =
          `video.meta.json durationSec=${meta.durationSec} is below ${minDur}s — ` +
          "re-run capture and wait for transcode/recording to finish before distribute.";
        appendLog(job, job.error);
        return job;
      }
      appendLog(
        job,
        `Bundle video: ${meta.durationSec}s, ${meta.byteLength ?? "?"} bytes (${meta.captureSource ?? "unknown"}).`,
      );
    } catch {
      appendLog(job, "Warning: could not parse video.meta.json");
    }
  }

  try {
    resolveTsxCli();
  } catch (e) {
    job.status = "failed";
    job.exitCode = 1;
    job.error = e instanceof Error ? e.message : String(e);
    appendLog(job, job.error);
    return job;
  }

  const cliDir = resolve(SKILL_CAPTURE_ROOT, "cli");
  const pipeline = resolve(cliDir, "src", "pipeline.ts");

  try {
    const child = spawnNodeTsx(pipeline, ["distribute-training", skillSlug, bundleDir], {
      cwd: cliDir,
      env: process.env,
      tsxDirs: [cliDir],
    });
    attachChildHandlers(
      job,
      child,
      `distribute-training:${skillSlug}`,
      () => {
        job.status = "published";
        job.publishResult = readTrainingPublishResult(skillSlug) ?? undefined;
        appendLog(job, "Training data publish complete.");
        if (job.publishResult?.catalogListingId) {
          appendLog(job, `Catalog listing ${job.publishResult.catalogListingId}`);
        }
      },
      (code) => `Distribute training exited with code ${code}`,
    );
  } catch (e) {
    job.status = "failed";
    job.exitCode = 1;
    job.error = e instanceof Error ? e.message : String(e);
    appendLog(job, job.error);
  }

  return job;
}

export function startCatalogJob(
  script: "archive-skill" | "extend-skill" | "republish-skill" | "update-catalog",
  skillSlug: string,
): Job {
  const id = randomUUID();
  const job: Job = {
    id,
    skillSlug,
    jobKind: "skill",
    status: "distributing",
    logs: [`Running ${script}...`],
    exitCode: null,
  };
  jobs.set(id, job);

  const dbDir = resolve(SKILL_CAPTURE_ROOT, "db");
  const scriptPath = resolve(dbDir, "src", "jobs", `${script}.ts`);

  try {
    const child = spawnNodeTsx(scriptPath, [skillSlug], {
      cwd: dbDir,
      env: process.env,
      tsxDirs: [dbDir],
    });
    attachChildHandlers(
      job,
      child,
      script,
      () => {
        job.status = "published";
        job.publishResult = readPublishResult(skillSlug) ?? undefined;
      },
      () => `${script} failed`,
    );
  } catch (e) {
    job.status = "failed";
    job.exitCode = 1;
    job.error = e instanceof Error ? e.message : String(e);
    appendLog(job, job.error);
  }

  return job;
}
