import type { InferencePrediction, TrainMetrics } from '../../../lib/localTrainerApi';
import './TrainAI.css';

type Props = {
  jobId: string | null;
  outputPath: string | null;
  metrics: TrainMetrics | null;
  predictions: InferencePrediction[] | null;
  inferBusy: boolean;
  inferError: string | null;
  trainingDone: boolean;
  onInferFile: (file: File) => void;
};

export function TrainAIResults({
  jobId,
  outputPath,
  metrics,
  predictions,
  inferBusy,
  inferError,
  trainingDone,
  onInferFile,
}: Props) {
  if (!jobId) {
    return null;
  }

  return (
    <section className="train-ai-results">
      <h2>Results</h2>

      {!trainingDone ? (
        <p>Training in progress… metrics and inference appear when finished.</p>
      ) : null}

      {trainingDone && metrics?.ready ? (
        <div className="train-ai-metrics">
          <p>
            <strong>Classes trained:</strong> {metrics.labels.join(', ')}
          </p>
          {metrics.final_loss != null ? (
            <p>
              <strong>Final loss:</strong> {metrics.final_loss.toFixed(4)}
            </p>
          ) : null}
          {metrics.losses.length > 1 ? (
            <p>Loss per epoch: {metrics.losses.map((l) => l.toFixed(4)).join(' → ')}</p>
          ) : null}
        </div>
      ) : null}

      {outputPath ? (
        <p style={{ marginTop: 'var(--space-3)' }}>
          Weights on disk: <code>{outputPath}</code>
        </p>
      ) : null}

      {trainingDone ? (
        <div style={{ marginTop: 'var(--space-4)' }}>
          <h3>See model output (inference)</h3>
          <p style={{ marginBottom: 'var(--space-3)' }}>
            Upload a test image or short video clip. The model predicts which label best matches what it
            sees (with confidence scores).
          </p>
          <div className="form-group">
            <label htmlFor="infer-file">Test file</label>
            <input
              id="infer-file"
              type="file"
              className="input"
              accept="image/*,video/mp4,video/webm,video/quicktime"
              disabled={!outputPath || inferBusy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  onInferFile(file);
                }
              }}
            />
          </div>
        </div>
      ) : null}

      {inferBusy ? <p style={{ marginTop: 'var(--space-2)' }}>Running inference…</p> : null}

      {inferError ? <p className="purchase-error">{inferError}</p> : null}

      {predictions?.length ? (
        <div style={{ marginTop: 'var(--space-3)' }}>
          <p style={{ marginBottom: 'var(--space-2)', fontWeight: 600, color: 'var(--text-primary)' }}>
            Predictions
          </p>
          <ul className="train-ai-predictions">
            {predictions.map((p) => (
              <li key={p.label}>
                <span>{p.label}</span>
                <span>{(p.score * 100).toFixed(1)}%</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <style>{`
        .train-ai-results .form-group {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .train-ai-results .form-group label {
          font-weight: 500;
          font-size: var(--text-sm);
        }

        .train-ai-results .purchase-error {
          margin-top: var(--space-2);
        }
      `}</style>
    </section>
  );
}
