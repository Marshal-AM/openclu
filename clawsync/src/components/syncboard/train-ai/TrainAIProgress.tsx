import type { TrainProgressEvent } from '../../../lib/localTrainerApi';

type Props = {
  progress: TrainProgressEvent | null;
};

export function TrainAIProgress({ progress }: Props) {
  if (!progress || progress.status === 'queued') {
    return (
      <div className="train-ai-progress">
        <p className="text-sm text-muted-foreground">
          Starting… (first run may download the model from Hugging Face — this can take several
          minutes)
        </p>
      </div>
    );
  }

  if (progress.status === 'running' && progress.epoch === 0) {
    return (
      <div className="train-ai-progress">
        <p className="text-sm text-muted-foreground">Loading model and preparing frames…</p>
      </div>
    );
  }

  const pct =
    progress.total_epochs > 0
      ? Math.round((progress.epoch / progress.total_epochs) * 100)
      : 0;

  return (
    <div className="train-ai-progress">
      <p className="mb-2 text-sm">
        Status: <strong>{progress.status}</strong>
        {progress.loss != null ? ` — loss: ${progress.loss.toFixed(4)}` : null}
      </p>
      <div className="train-ai-progress-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="train-ai-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Epoch {progress.epoch} / {progress.total_epochs}
      </p>
      {progress.error ? (
        <p className="purchase-error mt-2">{progress.error}</p>
      ) : null}
    </div>
  );
}
