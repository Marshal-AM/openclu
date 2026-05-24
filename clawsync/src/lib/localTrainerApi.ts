const BASE =
  import.meta.env.VITE_LOCAL_TRAINER_URL?.replace(/\/$/, '') ?? 'http://127.0.0.1:8000';

export type TrainerHealth = {
  ok: boolean;
  device: string;
  torch_version: string;
};

export type TrainProgressEvent = {
  epoch: number;
  total_epochs: number;
  loss: number | null;
  status: string;
  error?: string | null;
  output_path?: string | null;
};

export type TrainJobStatus = {
  job_id: string;
  status: string;
  epoch: number;
  total_epochs: number;
  loss: number | null;
  output_path: string | null;
  labels: string[];
  error: string | null;
};

export type TrainMetrics = {
  ready: boolean;
  labels: string[];
  losses: number[];
  final_loss: number | null;
  model_id?: string;
  output_path?: string;
};

export type InferencePrediction = {
  label: string;
  score: number;
};

export const PRESET_MODELS = [
  { id: 'openai/clip-vit-base-patch32', label: 'CLIP ViT-B/32 (~350MB, default)' },
  { id: 'apple/mobilevit-small-224', label: 'MobileViT-small (~20MB, fastest CPU)' },
  { id: 'google/vit-base-patch16-224', label: 'ViT-base patch16-224' },
] as const;

export async function fetchTrainerHealth(): Promise<TrainerHealth> {
  const res = await fetch(`${BASE}/health`);
  if (!res.ok) {
    throw new Error(`Trainer health check failed (${res.status})`);
  }
  return res.json() as Promise<TrainerHealth>;
}

export type StartTrainParams = {
  video: File;
  modelId: string;
  epochs: number;
  learningRate: number;
  sampleRateSec: number;
  labels: string;
  modelFiles?: File[];
};

export async function startTraining(params: StartTrainParams): Promise<{ job_id: string }> {
  const form = new FormData();
  form.append('video', params.video);
  form.append('model_id', params.modelId);
  form.append('epochs', String(params.epochs));
  form.append('learning_rate', String(params.learningRate));
  form.append('sample_rate_sec', String(params.sampleRateSec));
  form.append('labels', params.labels);
  if (params.modelFiles?.length) {
    for (const file of params.modelFiles) {
      form.append('model_files', file, file.webkitRelativePath || file.name);
    }
  }

  const res = await fetch(`${BASE}/train`, { method: 'POST', body: form });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Training start failed (${res.status})`);
  }
  return res.json() as Promise<{ job_id: string }>;
}

function jobToProgress(job: TrainJobStatus): TrainProgressEvent {
  return {
    epoch: job.epoch,
    total_epochs: job.total_epochs,
    loss: job.loss,
    status: job.status,
    error: job.error,
    output_path: job.output_path,
  };
}

/** Poll job status (reliable on Windows; avoids SSE disconnect false positives). */
export function subscribeTrainProgress(
  jobId: string,
  onEvent: (event: TrainProgressEvent) => void,
  onError?: (err: Error) => void,
): () => void {
  let cancelled = false;

  const poll = async () => {
    while (!cancelled) {
      try {
        const job = await getTrainJob(jobId);
        onEvent(jobToProgress(job));
        if (job.status === 'done' || job.status === 'error') {
          return;
        }
      } catch (e) {
        if (!cancelled) {
          onError?.(e instanceof Error ? e : new Error(String(e)));
        }
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 800));
    }
  };

  void poll();
  return () => {
    cancelled = true;
  };
}

export async function getTrainJob(jobId: string): Promise<TrainJobStatus> {
  const res = await fetch(`${BASE}/train/${encodeURIComponent(jobId)}`);
  if (!res.ok) {
    throw new Error(`Job status failed (${res.status})`);
  }
  return res.json() as Promise<TrainJobStatus>;
}

export async function fetchTrainMetrics(jobId: string): Promise<TrainMetrics> {
  const res = await fetch(`${BASE}/train/${encodeURIComponent(jobId)}/metrics`);
  if (!res.ok) {
    throw new Error(`Metrics failed (${res.status})`);
  }
  return res.json() as Promise<TrainMetrics>;
}

export async function runInference(
  jobId: string,
  file: File,
): Promise<{ predictions: InferencePrediction[] }> {
  const form = new FormData();
  form.append('job_id', jobId);
  const isVideo = file.type.startsWith('video/');
  if (isVideo) {
    form.append('video', file);
  } else {
    form.append('image', file);
  }

  const res = await fetch(`${BASE}/infer`, { method: 'POST', body: form });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Inference failed (${res.status})`);
  }
  return res.json() as Promise<{ predictions: InferencePrediction[] }>;
}

export function getTrainerBaseUrl(): string {
  return BASE;
}
