import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import { ModalDialog } from '../ModalDialog';
import '../TrainingDataCard.css';
import './TrainingDataPickerDialog.css';

export type TrainingDataPickerItem = {
  id: Id<'purchasedTrainingData'>;
  title: string;
  skillName: string;
  videoMime: string;
  purchasedAt: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onAdd: (item: TrainingDataPickerItem) => void;
  adding?: boolean;
};

export function TrainingDataPickerDialog({ open, onClose, onAdd, adding = false }: Props) {
  const rows = useQuery(api.trainingDataPurchases.listPurchased);
  const [selectedId, setSelectedId] = useState<Id<'purchasedTrainingData'> | null>(null);

  const selected = rows?.find((r) => r._id === selectedId);

  function handleClose() {
    if (adding) return;
    setSelectedId(null);
    onClose();
  }

  function handleAdd() {
    if (!selected || adding) return;
    onAdd({
      id: selected._id,
      title: selected.title,
      skillName: selected.skillName,
      videoMime: selected.videoMime,
      purchasedAt: selected.purchasedAt,
    });
  }

  return (
    <ModalDialog
      open={open}
      onClose={handleClose}
      title="Add training data"
      description="Choose a purchased training video to use for fine-tuning."
      className="modal-dialog--wide training-data-picker-dialog"
    >
      {!rows ? (
        <p className="purchase-hint">Loading your training data…</p>
      ) : rows.length === 0 ? (
        <div className="training-data-picker-empty">
          <p>No purchased training data yet.</p>
          <Link to="/syncboard/training-data/purchase" className="btn btn-primary" onClick={handleClose}>
            Purchase training data
          </Link>
        </div>
      ) : (
        <ul className="training-data-picker-list">
          {rows.map((row) => (
            <li key={row._id}>
              <button
                type="button"
                className={`training-data-picker-row${selectedId === row._id ? ' is-selected' : ''}`}
                onClick={() => setSelectedId(row._id)}
                disabled={adding}
              >
                <span className="training-data-picker-row-title">{row.title}</span>
                <span className="training-data-picker-row-badge">{row.skillName}</span>
                <span className="training-data-picker-row-date">
                  Acquired {new Date(row.purchasedAt).toLocaleDateString()}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {rows && rows.length > 0 ? (
        <footer className="training-data-picker-footer">
          <button type="button" className="btn btn-secondary" onClick={handleClose} disabled={adding}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleAdd}
            disabled={!selectedId || adding}
          >
            {adding ? 'Adding…' : 'Add'}
          </button>
        </footer>
      ) : null}
    </ModalDialog>
  );
}
