import { useState, useEffect, useRef } from 'react';
import { useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { SyncBoardLayout } from '../components/syncboard/SyncBoardLayout';
import { CatalogDetailPanel } from '../components/syncboard/CatalogDetailPanel';
import './SyncBoardPurchaseSkills.css';

type QueryMatch = {
  score: number;
  skillName: string;
  title: string;
  description: string;
  triggers: string[];
  listingKey: string;
  status: string;
  owner?: string;
  creator?: string;
  arkivVersion?: number;
  tags?: string[];
  payload?: Record<string, unknown>;
};

export function SyncBoardPurchaseSkills() {
  const catalogQuery = useAction(api.catalogActions.query);
  const catalogGetDetail = useAction(api.catalogActions.getDetail);
  const purchaseSkill = useAction(api.skillPurchaseActions.purchaseSkill);
  const getWalletStatus = useAction(api.skillPurchaseActions.getWalletStatus);

  const [query, setQuery] = useState('');
  const [tag, setTag] = useState('');
  const [status, setStatus] = useState('');
  const [since, setSince] = useState('');
  const [until, setUntil] = useState('');
  const [minScore, setMinScore] = useState('0');
  const [skillSlug, setSkillSlug] = useState('');
  const [scope, setScope] = useState<'marketplace' | 'mine'>('marketplace');
  const [matches, setMatches] = useState<QueryMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showFullBrowse, setShowFullBrowse] = useState(false);
  const [walletConfigured, setWalletConfigured] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [purchaseError, setPurchaseError] = useState('');
  const [purchaseLogs, setPurchaseLogs] = useState<string[]>([]);
  const [purchaseElapsedSec, setPurchaseElapsedSec] = useState(0);
  const purchaseInFlight = useRef(false);

  useEffect(() => {
    void getWalletStatus({}).then((w) => {
      setWalletConfigured(w.configured);
      setWalletAddress(w.address);
    });
  }, [getWalletStatus]);

  async function runSearch(opts?: { full?: boolean; emptyQuery?: boolean }) {
    setLoading(true);
    setError('');
    if (!opts?.full) setDetail(null);
    try {
      const data = (await catalogQuery({
        query: opts?.emptyQuery ? '' : query.trim() || undefined,
        tag: tag.trim() || undefined,
        status: status || undefined,
        since: since ? Date.parse(since) : undefined,
        until: until ? Date.parse(until) : undefined,
        minScore: Number(minScore) || 0,
        skillSlug: skillSlug.trim() || undefined,
        scope,
        full: opts?.full ?? false,
      })) as { matches?: QueryMatch[] };
      setMatches(data.matches ?? []);
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

  async function openDetail(name: string) {
    setDetailLoading(true);
    setError('');
    setPurchaseError('');
    setPurchaseLogs([]);
    setPurchaseElapsedSec(0);
    try {
      const data = await catalogGetDetail({ skillName: name });
      setDetail(data as Record<string, unknown>);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

  function appendPurchaseLog(line: string) {
    const stamped = `[${new Date().toLocaleTimeString()}] ${line}`;
    console.log('[purchase]', stamped);
    setPurchaseLogs((prev) => [...prev, stamped]);
  }

  async function handlePurchase() {
    if (!detail || purchaseInFlight.current) return;
    const payload = detail.payload as Record<string, unknown> | undefined;
    const skillName = String(payload?.skillName ?? '');
    const entityKey = String(detail.entityKey ?? '');
    if (!skillName) {
      setPurchaseError('Missing skill name in listing');
      return;
    }
    if (!entityKey || !payload) {
      setPurchaseError('Missing Arkiv catalog payload — open full detail first');
      return;
    }
    purchaseInFlight.current = true;
    setPurchaseLoading(true);
    setPurchaseError('');
    setPurchaseLogs([]);
    setPurchaseElapsedSec(0);

    const tick = window.setInterval(() => {
      setPurchaseElapsedSec((s) => s + 1);
    }, 1000);

    appendPurchaseLog(`Starting purchase for "${skillName}"…`);
    appendPurchaseLog('Calling Convex action (spawns marketplace CLI subprocess)…');
    appendPurchaseLog(
      'Catalog JSON → Story mint → fetch ciphertext (content registry HTTP, then gateways) → decrypt → unzip. Fresh devices do not use the publisher Helia peer.',
    );
    appendPurchaseLog('Also watch the terminal running `npx convex dev` for [skill-marketplace] lines.');

    try {
      const result = await purchaseSkill({
        skillName,
        catalogSnapshot: { entityKey, payload },
      });
      if (result.logs?.length) {
        for (const line of result.logs) {
          appendPurchaseLog(line);
        }
      }
      appendPurchaseLog(
        `Done in ${(result.durationMs / 1000).toFixed(1)}s — license ${result.licenseTokenId}, saved to disk.`,
      );
      setPurchaseError('');
      alert(`Purchased "${skillName}". Open My Purchased Skills to import it into your agent.`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      appendPurchaseLog(`Failed: ${msg}`);
      setPurchaseError(msg);
    } finally {
      window.clearInterval(tick);
      purchaseInFlight.current = false;
      setPurchaseLoading(false);
    }
  }

  function onFilterKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      void runSearch();
    }
  }

  const purchaseBlock = detail?.payload
    ? ((detail.payload as Record<string, unknown>).purchase as Record<string, unknown> | undefined)
    : undefined;
  const mintingFee = purchaseBlock?.mintingFeeIp
    ? String(purchaseBlock.mintingFeeIp)
    : undefined;

  return (
    <SyncBoardLayout title="Purchase Agent Skills">
      <div className="purchase-skills-page">
        <p className="description">
          Browse the Arkiv catalog. Detail view shows full metadata, purchase block, ops, tags, and
          version. Purchases use your AGENT_PRIVATE_KEY wallet on Story Aeneid (local Convex dev).
          Run <code>npm run cdr-storage</code> in a second terminal before buying — keeps IPFS
          ready; catalog JSON supplies peer hints when P2P is needed.
        </p>

        <div className="purchase-filters">
          <input
            className="input"
            placeholder="Keyword search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onFilterKeyDown}
          />
          <div className="purchase-filters-grid">
            <input
              className="input"
              placeholder="Tag"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              onKeyDown={onFilterKeyDown}
            />
            <select
              className="input"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Any status</option>
              <option value="published">published</option>
              <option value="archived">archived</option>
            </select>
            <input
              type="datetime-local"
              className="input"
              value={since}
              onChange={(e) => setSince(e.target.value)}
            />
            <input
              type="datetime-local"
              className="input"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
            />
            <input
              className="input"
              placeholder="Skill slug"
              value={skillSlug}
              onChange={(e) => setSkillSlug(e.target.value)}
              onKeyDown={onFilterKeyDown}
            />
            <input
              className="input"
              placeholder="Min score"
              value={minScore}
              onChange={(e) => setMinScore(e.target.value)}
              onKeyDown={onFilterKeyDown}
            />
            <select
              className="input span-2"
              value={scope}
              onChange={(e) => setScope(e.target.value as 'marketplace' | 'mine')}
            >
              <option value="marketplace">Marketplace (published only)</option>
              <option value="mine">My listings only</option>
            </select>
          </div>
          <div className="purchase-filter-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void runSearch()}
              disabled={loading}
            >
              {loading ? 'Searching…' : 'Search'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void runSearch({ full: true, emptyQuery: true })}
              disabled={loading}
            >
              {loading ? 'Loading…' : 'Browse entire catalog'}
            </button>
          </div>
        </div>

        {error && <p className="purchase-error">{error}</p>}

        {!searched && !loading && (
          <p className="purchase-hint">
            Search by keyword or click Browse entire catalog to load all published listings with full
            payloads.
          </p>
        )}

        {searched && !loading && !error && matches.length === 0 && (
          <p className="purchase-hint">No skills matched your filters.</p>
        )}

        {searched && matches.length > 0 && (
          <p className="purchase-hint">
            {matches.length} listing{matches.length === 1 ? '' : 's'}
            {showFullBrowse ? ' (full catalog rows)' : ''}
          </p>
        )}

        <ul className="purchase-results">
          {matches.map((m) => (
            <li key={m.listingKey} className="purchase-result-card">
              <button
                type="button"
                className="purchase-result-btn"
                onClick={() => void openDetail(m.skillName)}
              >
                <div className="purchase-result-header">
                  <h3>{m.title}</h3>
                  <span className="purchase-result-meta">
                    {m.status}
                    {m.arkivVersion != null ? ` · v${m.arkivVersion}` : ''}
                    {query.trim() ? ` · score ${(m.score * 100).toFixed(0)}%` : ''}
                  </span>
                </div>
                <p className="purchase-result-desc">{m.description}</p>
                <p className="purchase-result-slug">{m.skillName}</p>
              </button>
              {showFullBrowse && m.payload && (
                <details className="purchase-inline-payload">
                  <summary>Inline full payload</summary>
                  <pre>
                    {JSON.stringify(
                      {
                        entityKey: m.listingKey,
                        status: m.status,
                        owner: m.owner,
                        creator: m.creator,
                        arkivVersion: m.arkivVersion,
                        tags: m.tags,
                        payload: m.payload,
                      },
                      null,
                      2,
                    )}
                  </pre>
                </details>
              )}
            </li>
          ))}
        </ul>

        {detailLoading && <p className="purchase-hint">Loading full catalog entry…</p>}
        {detail && !detailLoading && (
          <CatalogDetailPanel
            detail={detail}
            onClose={() => setDetail(null)}
            purchaseFee={mintingFee}
            walletConfigured={walletConfigured}
            walletAddress={walletAddress}
            onPurchase={() => void handlePurchase()}
            purchaseLoading={purchaseLoading}
            purchaseError={purchaseError}
            purchaseLogs={purchaseLogs}
            purchaseElapsedSec={purchaseElapsedSec}
          />
        )}
      </div>
    </SyncBoardLayout>
  );
}
