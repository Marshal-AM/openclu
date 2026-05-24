import { useCallback, useEffect, useState } from 'react';
import { SyncBoardLayout } from '../components/syncboard/SyncBoardLayout';
import { TrainAIForm } from '../components/syncboard/train-ai/TrainAIForm';
import { TrainAIResults } from '../components/syncboard/train-ai/TrainAIResults';
import {
  fetchTrainerHealth,
  fetchTrainMetrics,
  getTrainerBaseUrl,
  runInference,
  type InferencePrediction,
  type TrainMetrics,
  type TrainerHealth,
} from '../lib/localTrainerApi';
import '../components/syncboard/train-ai/TrainAI.css';

export function SyncBoardTrainAI() {
  const [health, setHealth] = useState<TrainerHealth | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [outputPath, setOutputPath] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<TrainMetrics | null>(null);
  const [trainingDone, setTrainingDone] = useState(false);
  const [predictions, setPredictions] = useState<InferencePrediction[] | null>(null);
  const [inferBusy, setInferBusy] = useState(false);
  const [inferError, setInferError] = useState<string | null>(null);

  const checkHealth = useCallback(async () => {
    try {
      const h = await fetchTrainerHealth();
      setHealth(h);
      setHealthError(null);
    } catch {
      setHealth(null);
      setHealthError(
        `Local trainer not reachable at ${getTrainerBaseUrl()}. Start it with: npm run trainer:dev`,
      );
    }
  }, []);

  useEffect(() => {
    void checkHealth();
    const id = window.setInterval(() => void checkHealth(), 15000);
    return () => window.clearInterval(id);
  }, [checkHealth]);

  const onComplete = async (id: string, path: string | null) => {
    setJobId(id);
    setOutputPath(path);
    setTrainingDone(true);
    try {
      const m = await fetchTrainMetrics(id);
      setMetrics(m);
      if (m.output_path) {
        setOutputPath(m.output_path);
      }
    } catch {
      setMetrics(null);
    }
  };

  const onInferFile = async (file: File) => {
    if (!jobId) {
      return;
    }
    setInferBusy(true);
    setInferError(null);
    setPredictions(null);
    try {
      const res = await runInference(jobId, file);
      setPredictions(res.predictions);
    } catch (e) {
      setPredictions(null);
      setInferError(e instanceof Error ? e.message : String(e));
    } finally {
      setInferBusy(false);
    }
  };

  const trainerOk = health?.ok === true;

  return (
    <SyncBoardLayout>
      <div className="syncboard-page">
        <h1 className="syncboard-page-title">Train your AI</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          Fine-tune small vision models on your machine. After training, use{' '}
          <strong>See model output</strong> below to upload a test image and view predicted labels.
        </p>

        <div
          className={`train-ai-banner ${trainerOk ? 'train-ai-banner--ok' : 'train-ai-banner--error'}`}
        >
          {trainerOk ? (
            <p className="text-sm">
              Trainer connected — device: <strong>{health?.device}</strong>, PyTorch{' '}
              {health?.torch_version}
            </p>
          ) : (
            <p className="text-sm purchase-error">{healthError ?? 'Checking trainer…'}</p>
          )}
          <button
            type="button"
            className="syncboard-btn syncboard-btn-secondary mt-2"
            onClick={() => void checkHealth()}
          >
            Retry connection
          </button>
        </div>

        <TrainAIForm
          disabled={!trainerOk}
          onComplete={(id, path) => void onComplete(id, path)}
        />

        <TrainAIResults
          jobId={jobId}
          outputPath={outputPath}
          metrics={metrics}
          predictions={predictions}
          inferBusy={inferBusy}
          inferError={inferError}
          trainingDone={trainingDone}
          onInferFile={(file) => void onInferFile(file)}
        />

        <details className="train-ai-howto">
          <summary>How to download a model from Hugging Face</summary>
          <p className="mt-2 text-sm text-muted-foreground">
            Option 1: pick a preset above — weights download automatically on first train.
          </p>
          <p className="text-sm text-muted-foreground">
            Option 2: pre-download with the Hugging Face CLI:
          </p>
          <pre>{`pip install huggingface_hub
huggingface-cli download openai/clip-vit-base-patch32 --local-dir .\\models\\clip-vit-b32`}</pre>
          <p className="text-sm text-muted-foreground">
            Then enable &quot;Upload local model folder&quot; and select that directory.
          </p>
        </details>
      </div>
    </SyncBoardLayout>
  );
}
