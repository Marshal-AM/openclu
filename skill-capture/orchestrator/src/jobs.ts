import { type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
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

export type JobStatus =
  | "queued"
  | "capturing"
  | "processing"
  | "distributing"
  | "published"
  | "failed";

export interface Job {
  id: string;
  skillSlug: string;
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
    status: "capturing",
    logs: [
      `Starting capture for "${skillSlug}" - press Q in this orchestrator terminal to stop.`,
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
      { env: captureEnv() },
    );
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

export function startDistributeJob(skillSlug: string): Job {
  const id = randomUUID();
  const job: Job = {
    id,
    skillSlug,
    status: "distributing",
    logs: ["Starting local distribute (Story + Helia + Arkiv)..."],
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
        if (job.publishResult?.arkivListingKey) {
          appendLog(job, `Arkiv listing ${job.publishResult.arkivListingKey}`);
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

export function startArkivJob(
  script: "archive-skill" | "extend-skill" | "republish-skill",
  skillSlug: string,
): Job {
  const id = randomUUID();
  const job: Job = {
    id,
    skillSlug,
    status: "distributing",
    logs: [`Running ${script}...`],
    exitCode: null,
  };
  jobs.set(id, job);

  const arkivDir = resolve(SKILL_CAPTURE_ROOT, "arkiv");
  const scriptPath = resolve(arkivDir, "src", "jobs", `${script}.ts`);

  try {
    const child = spawnNodeTsx(scriptPath, [skillSlug], {
      cwd: arkivDir,
      env: process.env,
      tsxDirs: [arkivDir],
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
