import { Link } from 'react-router-dom';
import type { Id } from '../../../convex/_generated/dataModel';
import './TrainingDataCard.css';

type TrainingDataCardProps = {
  id: Id<'purchasedTrainingData'>;
  title: string;
  skillName: string;
  purchasedAt: number;
};

export function TrainingDataCard({ id, title, skillName, purchasedAt }: TrainingDataCardProps) {
  return (
    <Link to={`/syncboard/training-data/${id}`} className="training-data-card">
      <header className="training-data-card-header">
        <h3 className="training-data-card-title">{title}</h3>
        <span className="training-data-card-badge">{skillName}</span>
      </header>
      <footer className="training-data-card-footer">
        <time dateTime={new Date(purchasedAt).toISOString()}>
          Acquired {new Date(purchasedAt).toLocaleDateString()}
        </time>
      </footer>
    </Link>
  );
}
