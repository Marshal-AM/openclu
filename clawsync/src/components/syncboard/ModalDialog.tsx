import { useEffect, type ReactNode } from 'react';
import { X } from '@phosphor-icons/react';
import './ModalDialog.css';

type ModalDialogProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

export function ModalDialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: ModalDialogProps) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-dialog-overlay" onClick={onClose} role="presentation">
      <div
        className={`modal-dialog${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-dialog-title' : undefined}
        onClick={(event) => event.stopPropagation()}
      >
        {(title || description) && (
          <header className="modal-dialog-header">
            <div className="modal-dialog-heading">
              {title ? (
                <h2 id="modal-dialog-title" className="modal-dialog-title">
                  {title}
                </h2>
              ) : null}
              {description ? <p className="modal-dialog-description">{description}</p> : null}
            </div>
            <button type="button" className="modal-dialog-close" onClick={onClose} aria-label="Close">
              <X size={18} weight="bold" />
            </button>
          </header>
        )}

        <div className="modal-dialog-body">{children}</div>
      </div>
    </div>
  );
}
