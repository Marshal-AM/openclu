import { useEffect, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import './SkillAcquiredCard.css';
import { SkillAcquiredCardSkeleton } from '../ui/skeletons';

interface SkillAcquiredCardProps {
  purchaseEventId: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Preparing',
  purchasing: 'Acquiring',
  success: 'Acquired',
  failed: 'Failed',
  already_attached: 'Attached',
};

export function SkillAcquiredCard({ purchaseEventId }: SkillAcquiredCardProps) {
  const event = useQuery(api.chatSkillActions.getPurchaseEvent, {
    purchaseEventId: purchaseEventId as Id<'skillPurchaseEvents'>,
  });
  const [elapsedSec, setElapsedSec] = useState(0);

  const isActive =
    event?.status === 'purchasing' || event?.status === 'pending';

  useEffect(() => {
    if (!isActive) return;
    const t0 = Date.now();
    const id = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - t0) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [isActive, purchaseEventId]);

  if (event === undefined) {
    return <SkillAcquiredCardSkeleton />;
  }

  if (event === null) {
    return null;
  }

  const statusClass = event.status;
  const label = STATUS_LABELS[event.status] ?? event.status;

  return (
    <div className={`skill-acquired-card ${isActive ? 'purchasing' : ''}`}>
      <div className="skill-acquired-header">
        <div className="skill-acquired-icon">✦</div>
        <div className="skill-acquired-meta">
          <h4>{event.title || event.skillName}</h4>
          {event.description && <p>{event.description}</p>}
        </div>
        <span className={`skill-acquired-status ${statusClass}`}>{label}</span>
      </div>

      {event.catalogCid && (
        <div className="skill-acquired-footer" style={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>
          CID: {event.catalogCid.slice(0, 20)}…
          {event.catalogSource && ` · catalog: ${event.catalogSource}`}
          {event.heliaAddrCount != null && ` · ${event.heliaAddrCount} Helia addrs`}
        </div>
      )}

      {isActive && (
        <div className="skill-acquired-footer">
          Acquiring from Arkiv marketplace… {elapsedSec}s (Story mint + CDR decrypt — not catalog lookup)
        </div>
      )}

      {event.status === 'success' && (
        <div className="skill-acquired-footer">
          Now attached to this agent. You can use it on your next message.
        </div>
      )}

      {event.status === 'already_attached' && (
        <div className="skill-acquired-footer">
          This skill is already attached to this agent — no new purchase was needed.
        </div>
      )}

      {isActive && event.status === 'purchasing' && (
        <div className="skill-acquired-footer">
          Purchase runs in the background (Story mint + public IPFS download + decrypt — often 1–3
          minutes).
        </div>
      )}

      {event.status === 'failed' && event.error && (
        <div className="skill-acquired-footer" style={{ color: 'var(--error)' }}>
          {event.error}
          {event.error.includes('AGENT_PRIVATE_KEY') && (
            <span>
              {' '}
              Set <code>AGENT_PRIVATE_KEY</code> in clawsync/.env (Convex loads it in dev).
            </span>
          )}
        </div>
      )}

      {event.logs && event.logs.length > 0 && (
        <details className="skill-acquired-logs">
          <summary>Purchase log ({event.logs.length} lines)</summary>
          <pre>{event.logs.join('\n')}</pre>
        </details>
      )}
    </div>
  );
}
