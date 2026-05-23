"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { XIcon } from "lucide-react";

type SkillModalDialogProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function SkillModalDialog({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: SkillModalDialogProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="skill-marketplace-ui">
      <div className="modal-dialog-overlay" onClick={onClose} role="presentation">
        <div
          className="modal-dialog modal-dialog--wide"
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? "skill-modal-title" : undefined}
          onClick={(event) => event.stopPropagation()}
        >
          {(title || subtitle) && (
            <header className="modal-dialog-header">
              <div className="modal-dialog-heading">
                {title ? (
                  <h2 id="skill-modal-title" className="modal-dialog-title">
                    {title}
                  </h2>
                ) : null}
                {subtitle ? <p className="modal-dialog-subtitle">{subtitle}</p> : null}
              </div>
              <button type="button" className="modal-dialog-close" onClick={onClose} aria-label="Close">
                <XIcon className="size-4" />
              </button>
            </header>
          )}

          <div className="modal-dialog-body">{children}</div>
          {footer ? <footer className="modal-dialog-footer">{footer}</footer> : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
