import type { InferencePrediction, TrainMetrics } from '../../../lib/localTrainerApi';

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
      <h2 className="text-lg font-medium">Results</h2>

      {!trainingDone ? (
        <p className="text-sm text-muted-foreground">
          Training in progress… metrics and inference appear when finished.
        </p>
      ) : null}

      {trainingDone && metrics?.ready ? (
        <div className="mb-4 rounded-lg border p-3 text-sm">
          <p>
            <strong>Classes trained:</strong> {metrics.labels.join(', ')}
          </p>
          {metrics.final_loss != null ? (
            <p className="mt-1">
              <strong>Final loss:</strong> {metrics.final_loss.toFixed(4)}
            </p>
          ) : null}
          {metrics.losses.length > 1 ? (
            <p className="mt-1 text-muted-foreground">
              Loss per epoch: {metrics.losses.map((l) => l.toFixed(4)).join(' → ')}
            </p>
          ) : null}
        </div>
      ) : null}

      {outputPath ? (
        <p className="text-sm text-muted-foreground">
          Weights on disk: <code className="text-xs">{outputPath}</code>
        </p>
      ) : null}

      {trainingDone ? (
        <div className="mt-4">
          <h3 className="mb-2 font-medium">See model output (inference)</h3>
          <p className="mb-2 text-sm text-muted-foreground">
            Upload a test image or short video clip. The model predicts which label best
            matches what it sees (with confidence scores).
          </p>
          <label className="train-ai-field">
            <span>Test file</span>
            <input
              type="file"
              accept="image/*,video/mp4,video/webm,video/quicktime"
              disabled={!outputPath || inferBusy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  onInferFile(file);
                }
              }}
            />
          </label>
        </div>
      ) : null}

      {inferBusy ? (
        <p className="mt-2 text-sm text-muted-foreground">Running inference…</p>
      ) : null}

      {inferError ? <p className="purchase-error mt-2">{inferError}</p> : null}

      {predictions?.length ? (
        <div className="mt-3">
          <p className="mb-2 text-sm font-medium">Predictions</p>
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
    </section>
  );
}
