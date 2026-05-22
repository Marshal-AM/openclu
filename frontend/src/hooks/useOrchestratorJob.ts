"use client";

import { useEffect, useRef, useState } from "react";

const ORCH = "/api/orch";

export type OrchestratorJob = {
  id: string;
  skillSlug: string;
  status: string;
  logs: string[];
  exitCode: number | null;
  error?: string;
  publishResult?: {
    skillSlug?: string;
    arkivListingKey?: string;
    arkivVersion?: number;
    arkivStatus?: string;
  };
};

type JobHandlers = {
  onPublished?: (job: OrchestratorJob) => void | Promise<void>;
  onFailed?: (job: OrchestratorJob) => void;
};

export function useOrchestratorJob(jobId: string | null, handlers?: JobHandlers) {
  const [job, setJob] = useState<OrchestratorJob | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const finishedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      finishedRef.current = null;
      return;
    }
    finishedRef.current = null;
    let cancelled = false;

    const poll = async () => {
      const res = await fetch(`${ORCH}/jobs/${jobId}`);
      if (!res.ok || cancelled) return;
      const data = (await res.json()) as OrchestratorJob;
      if (cancelled) return;
      setJob(data);
      if (finishedRef.current === jobId) return;
      if (data.status === "published") {
        finishedRef.current = jobId;
        await handlersRef.current?.onPublished?.(data);
      } else if (data.status === "failed") {
        finishedRef.current = jobId;
        handlersRef.current?.onFailed?.(data);
      }
    };

    void poll();
    const id = setInterval(() => void poll(), 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [jobId]);

  return { job, logs: job?.logs ?? [] };
}
