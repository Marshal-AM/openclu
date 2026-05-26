import { useRef, useState, type InputHTMLAttributes } from 'react';
import { useAction } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import {
  PRESET_MODELS,
  startTraining,
  subscribeTrainProgress,
  type TrainProgressEvent,
} from '../../../lib/localTrainerApi';
import { base64ToVideoFile, videoFilenameForSkill } from '../../../lib/purchasedTrainingVideoFile';
import { TrainAIProgress } from './TrainAIProgress';
import {
  TrainingDataPickerDialog,
  type TrainingDataPickerItem,
} from './TrainingDataPickerDialog';
import './TrainAI.css';
import './TrainingDataPickerDialog.css';

type SelectedTrainingData = TrainingDataPickerItem;

type Props = {
  disabled: boolean;
  onComplete: (jobId: string, outputPath: string | null) => void;
};

export function TrainAIForm({ disabled, onComplete }: Props) {
  const getPurchasedVideo = useAction(api.trainingDataPurchaseActions.getPurchasedVideo);

  const [modelId, setModelId] = useState(PRESET_MODELS[0].id);
  const [customModelId, setCustomModelId] = useState('');
  const [useLocalModel, setUseLocalModel] = useState(false);
  const [video, setVideo] = useState<File | null>(null);
  const [selectedTrainingData, setSelectedTrainingData] = useState<SelectedTrainingData | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loadingTrainingVideo, setLoadingTrainingVideo] = useState(false);
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

  async function handleAddTrainingData(item: TrainingDataPickerItem) {
    setError(null);
    setLoadingTrainingVideo(true);
    try {
      const res = await getPurchasedVideo({ id: item.id });
      if (!res.found || !res.base64) {
        setError('Video file not found in purchased bundle.');
        return;
      }
      const mime = res.videoMime ?? item.videoMime;
      const file = base64ToVideoFile(
        res.base64,
        mime,
        videoFilenameForSkill(item.skillName, mime),
      );
      setVideo(file);
      setSelectedTrainingData(item);
      setPickerOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingTrainingVideo(false);
    }
  }

  function clearTrainingData() {
    setVideo(null);
    setSelectedTrainingData(null);
    setError(null);
  }

  const handleTrain = async () => {
    if (!video) {
      setError('Add training data before training.');
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

  const formLocked = disabled || busy || loadingTrainingVideo;

  return (
    <div className="train-ai-grid">
      <section className="train-ai-section">
        <h3>Model</h3>
        <div className="form-group">
          <label htmlFor="preset-model">Preset</label>
          <select
            id="preset-model"
            className="input"
            value={modelId}
            disabled={formLocked || useLocalModel}
            onChange={(e) => setModelId(e.target.value)}
          >
            {PRESET_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="custom-model">Or HuggingFace model ID</label>
          <input
            id="custom-model"
            type="text"
            className="input"
            placeholder="e.g. openai/clip-vit-base-patch32"
            value={customModelId}
            disabled={formLocked || useLocalModel}
            onChange={(e) => setCustomModelId(e.target.value)}
          />
        </div>
        <label className="train-ai-checkbox">
          <input
            type="checkbox"
            checked={useLocalModel}
            disabled={formLocked}
            onChange={(e) => setUseLocalModel(e.target.checked)}
          />
          Upload local model folder (config.json + weights)
        </label>
        {useLocalModel ? (
          <div className="form-group">
            <label htmlFor="local-model">Model folder</label>
            <input
              id="local-model"
              type="file"
              className="input"
              {...({ webkitdirectory: '', directory: '' } as InputHTMLAttributes<HTMLInputElement>)}
              multiple
              disabled={formLocked}
              onChange={(e) => setModelFiles(Array.from(e.target.files ?? []))}
            />
          </div>
        ) : null}
      </section>

      <section className="train-ai-section">
        <h3>Training data</h3>

        {selectedTrainingData ? (
          <div className="train-ai-selected-data">
            <div className="train-ai-selected-data-main">
              <p className="train-ai-selected-data-title">{selectedTrainingData.title}</p>
              <span className="training-data-card-badge">{selectedTrainingData.skillName}</span>
              <p className="purchase-hint">
                Video ready for training
                {video ? ` (${video.name})` : ''}
              </p>
            </div>
            <div className="train-ai-selected-data-actions">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={formLocked}
                onClick={() => setPickerOpen(true)}
              >
                Change
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={formLocked}
                onClick={clearTrainingData}
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <p className="purchase-hint train-ai-training-data-hint">
            Select purchased training data from your library. Its video will be used for fine-tuning.
          </p>
        )}

        <div className="train-ai-form-actions train-ai-add-data-action">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={formLocked}
            onClick={() => setPickerOpen(true)}
          >
            {loadingTrainingVideo ? 'Loading video…' : 'Add training data'}
          </button>
        </div>

        <div className="train-ai-form-stack">
          <div className="form-group">
            <label htmlFor="sample-rate">Sample rate (seconds between frames)</label>
            <input
              id="sample-rate"
              type="number"
              className="input"
              min={0.1}
              step={0.1}
              value={sampleRateSec}
              disabled={formLocked}
              onChange={(e) => setSampleRateSec(Number(e.target.value))}
            />
          </div>
          <div className="form-group">
            <label htmlFor="epochs">Epochs</label>
            <input
              id="epochs"
              type="number"
              className="input"
              min={1}
              max={50}
              value={epochs}
              disabled={formLocked}
              onChange={(e) => setEpochs(Number(e.target.value))}
            />
          </div>
          <div className="form-group">
            <label htmlFor="lr">Learning rate</label>
            <input
              id="lr"
              type="number"
              className="input"
              step="any"
              value={learningRate}
              disabled={formLocked}
              onChange={(e) => setLearningRate(Number(e.target.value))}
            />
          </div>
          <div className="form-group">
            <label htmlFor="labels">Labels (comma-separated; one label adds &quot;other&quot;)</label>
            <input
              id="labels"
              type="text"
              className="input"
              value={labels}
              disabled={formLocked}
              onChange={(e) => setLabels(e.target.value)}
            />
          </div>
        </div>

        <div className="train-ai-form-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={formLocked || !video}
            onClick={() => void handleTrain()}
          >
            {busy ? 'Training…' : 'Train'}
          </button>
        </div>

        {error ? <p className="purchase-error">{error}</p> : null}
      </section>

      <TrainingDataPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onAdd={(item) => void handleAddTrainingData(item)}
        adding={loadingTrainingVideo}
      />

      {(busy || progress) && jobId ? (
        <div style={{ gridColumn: '1 / -1' }}>
          <TrainAIProgress progress={progress} />
        </div>
      ) : null}

      <style>{`
        .train-ai-section .form-group {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
          margin-bottom: var(--space-3);
        }

        .train-ai-section .form-group label {
          font-weight: 500;
          font-size: var(--text-sm);
        }

        .train-ai-form-stack {
          margin-top: var(--space-4);
        }

        .train-ai-training-data-hint {
          margin: 0 0 var(--space-3);
        }

        .train-ai-selected-data {
          display: flex;
          flex-wrap: wrap;
          align-items: flex-start;
          justify-content: space-between;
          gap: var(--space-3);
          margin-bottom: var(--space-3);
          padding: var(--space-3);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          background: var(--bg-primary);
        }

        .train-ai-selected-data-main {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: var(--space-2);
          min-width: 0;
        }

        .train-ai-selected-data-title {
          margin: 0;
          font-size: var(--text-base);
          font-weight: 600;
          color: var(--text-primary);
        }

        .train-ai-selected-data-actions {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-2);
        }

        .train-ai-add-data-action {
          margin-bottom: var(--space-2);
        }

        .train-ai-section .purchase-error {
          margin-top: var(--space-3);
        }
      `}</style>
    </div>
  );
}
