import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { SyncBoardLayout } from '../components/syncboard/SyncBoardLayout';
import {
  CatalogSearchPanel,
  defaultCatalogSearchFilters,
  type CatalogSearchFilters,
} from '../components/syncboard/CatalogSearchPanel';
import {
  CatalogListingCard,
  getMintingFeeFromPayload,
} from '../components/syncboard/CatalogListingCard';
import { CatalogSkillDialog } from '../components/syncboard/CatalogSkillDialog';
import { CatalogQueryDebugPanel } from '../components/syncboard/CatalogQueryDebugPanel';
import { createCatalogTrace, type CatalogQueryTrace } from '../lib/catalogTrace';
import { TrainingDataVideoPlayer } from '../components/syncboard/TrainingDataVideoPlayer';
import '../components/syncboard/PremiumSkillCard.css';
import '../components/syncboard/TrainingDataCard.css';
import './SyncBoardPurchaseSkills.css';
import { SkillCardGridSkeleton } from '../components/ui/skeletons';

function parseFilterTimestamp(value: string, bound: 'since' | 'until'): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const ms = Date.parse(trimmed);
  if (Number.isNaN(ms)) return undefined;
  return bound === 'until' ? ms + 59_999 : ms;
}

type QueryMatch = {
  score: number;
  skillName: string;
  title: string;
  description: string;
  triggers: string[];
  listingKey: string;
  status: string;
  payload?: Record<string, unknown>;
};

export function SyncBoardPurchaseTrainingData() {
  const catalogQuery = useAction(api.trainingDataCatalogActions.query);
  const catalogGetDetail = useAction(api.trainingDataCatalogActions.getDetail);
  const purchaseTraining = useAction(api.trainingDataPurchaseActions.purchaseTrainingData);
  const getWalletStatus = useAction(api.trainingDataPurchaseActions.getWalletStatus);

  const [filters, setFilters] = useState<CatalogSearchFilters>(defaultCatalogSearchFilters);
  const [matches, setMatches] = useState<QueryMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [showFullBrowse, setShowFullBrowse] = useState(false);
  const [selectedSkillName, setSelectedSkillName] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [queryCatalogTrace, setQueryCatalogTrace] = useState<CatalogQueryTrace | null>(null);
  const [detailCatalogTrace, setDetailCatalogTrace] = useState<CatalogQueryTrace | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [walletConfigured, setWalletConfigured] = useState(false);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [purchaseError, setPurchaseError] = useState('');
  const [purchaseLogs, setPurchaseLogs] = useState<string[]>([]);
  const [purchaseElapsedSec, setPurchaseElapsedSec] = useState(0);
  const [purchasedId, setPurchasedId] = useState<string | null>(null);
  const [purchasedVideoMime, setPurchasedVideoMime] = useState('video/webm');
  const purchaseInFlight = useRef(false);
  const initialCatalogLoad = useRef(false);
  const queryDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void getWalletStatus({}).then((w) => {
      setWalletConfigured(w.configured);
    });
  }, [getWalletStatus]);

  useEffect(() => {
    if (initialCatalogLoad.current) return;
    initialCatalogLoad.current = true;
    void runSearch({ full: true, emptyQuery: true });
  }, []);

  useEffect(() => {
    if (!initialCatalogLoad.current) return;
    if (queryDebounceRef.current) clearTimeout(queryDebounceRef.current);
    queryDebounceRef.current = setTimeout(() => {
      void runSearch();
    }, 350);
    return () => {
      if (queryDebounceRef.current) clearTimeout(queryDebounceRef.current);
    };
  }, [filters.query]);

  async function runSearch(opts?: { full?: boolean; emptyQuery?: boolean }) {
    setLoading(true);
    setError('');
    try {
      const request = {
        query: opts?.emptyQuery ? '' : filters.query.trim() || undefined,
        tag: filters.tag.trim() || undefined,
        status: filters.status || undefined,
        since: parseFilterTimestamp(filters.since, 'since'),
        until: parseFilterTimestamp(filters.until, 'until'),
        minScore: Number(filters.minScore) || 0,
        skillSlug: filters.skillSlug.trim() || undefined,
        scope: filters.scope,
        full: opts?.full ?? true,
      };
      const data = (await catalogQuery(request)) as {
        matches?: QueryMatch[];
        filters?: unknown;
      };
      setMatches(data.matches ?? []);
      setQueryCatalogTrace(
        createCatalogTrace('query', 'convex:trainingDataCatalogActions.query', request, data, {
          transport: 'skill-marketplace query-training',
          network: 'supabase',
          resolvedFilters: data.filters,
        }),
      );
      setSearched(true);
      if (opts?.full) setShowFullBrowse(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setMatches([]);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }

  async function openDetail(name: string, listingKey?: string) {
    setSelectedSkillName(name);
    setDetailLoading(true);
    setError('');
    setPurchaseError('');
    setPurchaseLogs([]);
    setPurchasedId(null);
    setDetail(null);
    setDetailCatalogTrace(null);

    try {
      const request = {
        skillName: name,
        listingKey,
        scope: filters.scope as 'marketplace' | 'mine',
      };
      const data = await catalogGetDetail(request);
      setDetail(data as Record<string, unknown>);
      setDetailCatalogTrace(
        createCatalogTrace('get-detail', 'convex:trainingDataCatalogActions.getDetail', request, data, {
          transport: 'skill-marketplace get-training-detail',
          network: 'supabase',
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetail() {
    setSelectedSkillName(null);
    setDetail(null);
    setDetailCatalogTrace(null);
    setPurchaseError('');
    setPurchaseLogs([]);
    setPurchasedId(null);
  }

  function appendPurchaseLog(line: string) {
    const stamped = `[${new Date().toLocaleTimeString()}] ${line}`;
    setPurchaseLogs((prev) => [...prev, stamped]);
  }

  async function handlePurchase() {
    if (!detail || purchaseInFlight.current) return;
    const payload = detail.payload as Record<string, unknown> | undefined;
    const skillName = String(payload?.skillName ?? '');
    const entityKey = String(detail.entityKey ?? '');
    if (!skillName || !entityKey || !payload) {
      setPurchaseError('Missing Catalog catalog payload — open full detail first');
      return;
    }
    purchaseInFlight.current = true;
    setPurchaseLoading(true);
    setPurchaseError('');
    setPurchaseLogs([]);
    setPurchasedId(null);

    const tick = window.setInterval(() => {
      setPurchaseElapsedSec((s) => s + 1);
    }, 1000);

    appendPurchaseLog(`Starting purchase for training data "${skillName}"…`);

    try {
      const result = await purchaseTraining({
        skillName,
        catalogSnapshot: { entityKey, payload },
      });
      if (result.logs?.length) {
        for (const line of result.logs) {
          appendPurchaseLog(line);
        }
      }
      appendPurchaseLog(`Done in ${(result.durationMs / 1000).toFixed(1)}s — decrypting video bundle.`);
      setPurchasedId(result.purchasedTrainingDataId);
      setPurchasedVideoMime(result.videoMime);
      toast.success(`Purchased training data "${skillName}"`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      appendPurchaseLog(`Failed: ${msg}`);
      setPurchaseError(msg);
      toast.error('Purchase failed', { description: msg });
    } finally {
      window.clearInterval(tick);
      purchaseInFlight.current = false;
      setPurchaseLoading(false);
    }
  }

  const purchaseBlock = detail?.payload
    ? ((detail.payload as Record<string, unknown>).purchase as Record<string, unknown> | undefined)
    : undefined;
  const mintingFee = purchaseBlock?.mintingFeeIp ? String(purchaseBlock.mintingFeeIp) : undefined;
  const hasQueryScore = Boolean(filters.query.trim());
  const videoMime =
    (detail?.payload as Record<string, unknown> | undefined)?.videoMime?.toString() ??
    'video/webm';

  return (
    <SyncBoardLayout>
      <div className="purchase-skills-page syncboard-page">
        <CatalogSearchPanel
          filters={filters}
          onChange={setFilters}
          onSearch={() => void runSearch()}
          loading={loading}
          searchPlaceholder="Search training data listings…"
        />

        {error && <p className="purchase-error">{error}</p>}
        {loading ? <SkillCardGridSkeleton count={6} /> : null}

        {!loading && searched && !error && matches.length === 0 && (
          <p className="purchase-hint">No training data matched your filters.</p>
        )}

        {!loading && searched && matches.length > 0 ? (
          <>
            <p className="purchase-hint">
              {matches.length} listing{matches.length === 1 ? '' : 's'}
              {showFullBrowse ? ' (full catalog)' : ''}
            </p>
            <div className="premium-skill-grid">
              {matches.map((match) => (
                <CatalogListingCard
                  key={match.listingKey}
                  title={match.title}
                  description={match.description}
                  skillName={match.skillName}
                  status={match.status}
                  mintingFeeIp={getMintingFeeFromPayload(match.payload)}
                  score={hasQueryScore ? match.score : undefined}
                  onClick={() => void openDetail(match.skillName, match.listingKey)}
                />
              ))}
            </div>
            <CatalogQueryDebugPanel trace={queryCatalogTrace} />
          </>
        ) : null}

        <CatalogSkillDialog
          open={selectedSkillName !== null}
          onClose={closeDetail}
          detail={detail}
          catalogTrace={detailCatalogTrace}
          loading={detailLoading}
          purchaseFee={mintingFee}
          walletConfigured={walletConfigured}
          onPurchase={() => void handlePurchase()}
          purchaseLoading={purchaseLoading}
          purchaseError={purchaseError}
          purchaseLogs={purchaseLogs}
          purchaseElapsedSec={purchaseElapsedSec}
        />

        {purchasedId ? (
          <section className="training-data-purchase-preview">
            <div className="training-data-purchase-preview-header">
              <h2>Your video</h2>
              <Link
                to={`/syncboard/training-data/${purchasedId}`}
                className="btn btn-secondary btn-sm"
              >
                View full details
              </Link>
            </div>
            <TrainingDataVideoPlayer
              purchasedId={purchasedId as import('../../convex/_generated/dataModel').Id<'purchasedTrainingData'>}
              skillName={selectedSkillName ?? ''}
              videoMime={purchasedVideoMime}
            />
          </section>
        ) : null}
      </div>
    </SyncBoardLayout>
  );
}
