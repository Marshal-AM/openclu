import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { SyncBoardLayout } from '../components/syncboard/SyncBoardLayout';
import { TrainingDataVideoPlayer } from '../components/syncboard/TrainingDataVideoPlayer';
import { SkillDetailHeaderSkeleton, InlineCardSkeleton } from '../components/ui/skeletons';
import '../components/syncboard/PremiumSkillCard.css';
import '../components/syncboard/TrainingDataCard.css';

function shortAddress(address: string): string {
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function shortHash(value: string, head = 10, tail = 6): string {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

function formatVideoMime(mime: string): string {
  const normalized = mime.trim().toLowerCase();
  if (!normalized) return 'Unknown';
  if (normalized.includes('webm')) return 'WebM';
  if (normalized.includes('mp4')) return 'MP4';
  if (normalized.includes('quicktime') || normalized.includes('mov')) return 'QuickTime';
  return normalized;
}

export function SyncBoardTrainingDataDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const purchasedId = id as Id<'purchasedTrainingData'>;

  const item = useQuery(api.trainingDataPurchases.get, { id: purchasedId });

  useEffect(() => {
    if (item === null) {
      navigate('/syncboard/training-data', { replace: true });
    }
  }, [item, navigate]);

  if (item === undefined) {
    return (
      <SyncBoardLayout dynamicLabel="Training data">
        <div className="syncboard-page premium-skill-detail-page">
          <div className="premium-skill-detail">
            <aside className="premium-skill-detail-card">
              <SkillDetailHeaderSkeleton />
            </aside>
            <section className="premium-skill-detail-content">
              <InlineCardSkeleton height="420px" />
            </section>
          </div>
        </div>
      </SyncBoardLayout>
    );
  }

  if (item === null) {
    return null;
  }

  return (
    <SyncBoardLayout dynamicLabel={item.title} hidePageHeader>
      <div className="syncboard-page premium-skill-detail-page">
        <div className="premium-skill-detail">
          <aside className="premium-skill-detail-card">
            <header className="premium-skill-detail-header">
              <div className="premium-skill-detail-heading">
                <h1 className="premium-skill-detail-title">{item.title}</h1>
                {item.skillName !== item.title ? (
                  <p className="premium-skill-detail-subtitle">{item.skillName}</p>
                ) : null}
              </div>
              <span className="premium-skill-detail-price">{item.mintingFeeIp} IP</span>
            </header>

            <dl className="premium-skill-detail-meta">
              <div>
                <dt>Acquired</dt>
                <dd>{new Date(item.purchasedAt).toLocaleString()}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd className="training-data-detail-status">{item.status}</dd>
              </div>
              <div>
                <dt>Skill slug</dt>
                <dd>
                  <code className="training-data-detail-code">{item.skillName}</code>
                </dd>
              </div>
              <div>
                <dt>Video format</dt>
                <dd>{formatVideoMime(item.videoMime)}</dd>
              </div>
              <div>
                <dt>License token</dt>
                <dd>
                  <code className="training-data-detail-code" title={item.licenseTokenId}>
                    {shortHash(item.licenseTokenId, 12, 8)}
                  </code>
                </dd>
              </div>
              <div>
                <dt>Buyer wallet</dt>
                <dd>
                  <code className="training-data-detail-code" title={item.buyerAddress}>
                    {shortAddress(item.buyerAddress)}
                  </code>
                </dd>
              </div>
              {item.cid ? (
                <div>
                  <dt>Content ID</dt>
                  <dd>
                    <code className="training-data-detail-code" title={item.cid}>
                      {shortHash(item.cid, 14, 10)}
                    </code>
                  </dd>
                </div>
              ) : null}
              {item.readTxHash ? (
                <div>
                  <dt>Read transaction</dt>
                  <dd>
                    <code className="training-data-detail-code" title={item.readTxHash}>
                      {shortHash(item.readTxHash, 12, 8)}
                    </code>
                  </dd>
                </div>
              ) : null}
            </dl>

            <div className="premium-skill-detail-actions">
              <Link to="/syncboard/training-data" className="btn btn-secondary btn-sm">
                Back to library
              </Link>
              <Link to="/syncboard/train-ai" className="btn btn-primary btn-sm">
                Train your AI
              </Link>
            </div>
          </aside>

          <section className="premium-skill-detail-content training-data-detail-content">
            {item.description.trim() ? (
              <>
                <h2 className="premium-skill-detail-content-label">Description</h2>
                <p className="training-data-detail-description">{item.description}</p>
              </>
            ) : null}

            <h2 className="premium-skill-detail-content-label">Training video</h2>
            <div className="training-data-detail-video-wrap">
              <TrainingDataVideoPlayer
                purchasedId={item._id}
                skillName={item.skillName}
                videoMime={item.videoMime}
              />
            </div>
          </section>
        </div>
      </div>
    </SyncBoardLayout>
  );
}
