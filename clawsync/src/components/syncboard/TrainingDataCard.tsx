import './TrainingDataCard.css';

type TrainingDataCardProps = {
  title: string;
  skillName: string;
  purchasedAt: number;
  selected?: boolean;
  onSelect: () => void;
};

export function TrainingDataCard({
  title,
  skillName,
  purchasedAt,
  selected = false,
  onSelect,
}: TrainingDataCardProps) {
  return (
    <button
      type="button"
      className={`training-data-card${selected ? ' is-selected' : ''}`}
      onClick={onSelect}
    >
      <header className="training-data-card-header">
        <h3 className="training-data-card-title">{title}</h3>
        <span className="training-data-card-badge">{skillName}</span>
      </header>
      <footer className="training-data-card-footer">
        <time dateTime={new Date(purchasedAt).toISOString()}>
          Acquired {new Date(purchasedAt).toLocaleDateString()}
        </time>
      </footer>
    </button>
  );
}
