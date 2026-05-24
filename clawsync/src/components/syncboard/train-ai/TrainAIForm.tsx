import { useCallback, useRef, useState, type InputHTMLAttributes } from 'react';
import {
  PRESET_MODELS,
  startTraining,
  subscribeTrainProgress,
  type TrainProgressEvent,
} from '../../../lib/localTrainerApi';
import { TrainAIProgress } from './TrainAIProgress';

type Props = {
  disabled: boolean;
  onComplete: (jobId: string, outputPath: string | null) => void;
};

export function TrainAIForm({ disabled, onComplete }: Props) {
  const [modelId, setModelId] = useState(PRESET_MODELS[0].id);
  const [customModelId, setCustomModelId] = useState('');
  const [useLocalModel, setUseLocalModel] = useState(false);
  const [video, setVideo] = useState<File | null>(null);
  const [modelFiles, setModelFiles] = useState<File[]>([]);
  const [epochs, setEpochs] = useState(3);
  const [learningRate, setLearningRate] = useState(5e-5);
  const [sampleRateSec, setSampleRateSec] = useState(1);
  const [labels, setLabels] = useState('action');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<TrainProgressEvent | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  const resolvedModelId = customModelId.trim() || modelId;

  const onDropVideo = useCallback((file: File | null) => {
    if (file) {
      setVideo(file);
    }
  }, []);

  const handleTrain = async () => {
    if (!video) {
      setError('Upload a training video first.');
      return;
    }
    setError(null);
    setBusy(true);
    setProgress(null);
    unsubRef.current?.();

    try {
      const { job_id } = await startTraining({
        video,
        modelId: resolvedModelId,
        epochs,
        learningRate,
        sampleRateSec,
        labels,
        modelFiles: useLocalModel && modelFiles.length ? modelFiles : undefined,
      });
      setJobId(job_id);

      unsubRef.current = subscribeTrainProgress(
        job_id,
        (ev) => {
          setProgress(ev);
          if (ev.status === 'done') {
            setBusy(false);
            onComplete(job_id, ev.output_path ?? null);
          }
          if (ev.status === 'error') {
            setBusy(false);
            setError(ev.error ?? 'Training failed');
          }
        },
        (err) => {
          setBusy(false);
          setError(err.message);
        },
      );
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="train-ai-grid">
      <div>
        <h2 className="mb-3 text-lg font-medium">Model</h2>
        <div className="train-ai-field mb-3">
          <label htmlFor="preset-model">Preset</label>
          <select
            id="preset-model"
            value={modelId}
            disabled={disabled || busy || useLocalModel}
            onChange={(e) => setModelId(e.target.value)}
          >
            {PRESET_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div className="train-ai-field mb-3">
          <label htmlFor="custom-model">Or HuggingFace model ID</label>
          <input
            id="custom-model"
            type="text"
            placeholder="e.g. openai/clip-vit-base-patch32"
            value={customModelId}
            disabled={disabled || busy || useLocalModel}
            onChange={(e) => setCustomModelId(e.target.value)}
          />
        </div>
        <label className="mb-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={useLocalModel}
            disabled={disabled || busy}
            onChange={(e) => setUseLocalModel(e.target.checked)}
          />
          Upload local model folder (config.json + weights)
        </label>
        {useLocalModel ? (
          <input
            type="file"
            {...({ webkitdirectory: '', directory: '' } as InputHTMLAttributes<HTMLInputElement>)}
            multiple
            disabled={disabled || busy}
            onChange={(e) => setModelFiles(Array.from(e.target.files ?? []))}
          />
        ) : null}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-medium">Training video</h2>
        <div
          className="train-ai-dropzone"
          onDragOver={(e) => {
            e.preventDefault();
            e.currentTarget.classList.add('train-ai-dropzone--active');
          }}
          onDragLeave={(e) => {
            e.currentTarget.classList.remove('train-ai-dropzone--active');
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.classList.remove('train-ai-dropzone--active');
            const file = e.dataTransfer.files[0];
            if (file) {
              onDropVideo(file);
            }
          }}
        >
          <input
            type="file"
            accept="video/mp4,video/webm,video/quicktime,.mp4,.mov,.webm"
            id="train-video"
            disabled={disabled || busy}
            onChange={(e) => onDropVideo(e.target.files?.[0] ?? null)}
          />
          <p className="mt-2 text-sm text-muted-foreground">
            {video ? `Selected: ${video.name}` : 'Drop a file on this area or use the picker above'}
          </p>
        </div>

        <div className="mt-4 grid gap-3">
          <div className="train-ai-field">
            <label htmlFor="sample-rate">Sample rate (seconds between frames)</label>
            <input
              id="sample-rate"
              type="number"
              min={0.1}
              step={0.1}
              value={sampleRateSec}
              disabled={disabled || busy}
              onChange={(e) => setSampleRateSec(Number(e.target.value))}
            />
          </div>
          <div className="train-ai-field">
            <label htmlFor="epochs">Epochs</label>
            <input
              id="epochs"
              type="number"
              min={1}
              max={50}
              value={epochs}
              disabled={disabled || busy}
              onChange={(e) => setEpochs(Number(e.target.value))}
            />
          </div>
          <div className="train-ai-field">
            <label htmlFor="lr">Learning rate</label>
            <input
              id="lr"
              type="number"
              step="any"
              value={learningRate}
              disabled={disabled || busy}
              onChange={(e) => setLearningRate(Number(e.target.value))}
            />
          </div>
          <div className="train-ai-field">
            <label htmlFor="labels">Labels (comma-separated; one label adds &quot;other&quot;)</label>
            <input
              id="labels"
              type="text"
              value={labels}
              disabled={disabled || busy}
              onChange={(e) => setLabels(e.target.value)}
            />
          </div>
        </div>

        <button
          type="button"
          className="btn btn-primary mt-4"
          disabled={disabled || busy || !video}
          onClick={() => void handleTrain()}
        >
          {busy ? 'Training…' : 'Train'}
        </button>

        {error ? <p className="purchase-error mt-2">{error}</p> : null}
      </div>

      {(busy || progress) && jobId ? (
        <div style={{ gridColumn: '1 / -1' }}>
          <TrainAIProgress progress={progress} />
        </div>
      ) : null}
    </div>
  );
}
