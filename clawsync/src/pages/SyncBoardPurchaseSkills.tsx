import { useState, useEffect, useRef } from 'react';
import { useAction, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { SyncBoardLayout } from '../components/syncboard/SyncBoardLayout';
import { SyncBoardPageToolbar } from '../components/syncboard/SyncBoardPageToolbar';
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
import '../components/syncboard/PremiumSkillCard.css';
import './SyncBoardPurchaseSkills.css';
import { SkillCardGridSkeleton } from '../components/ui/skeletons';

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

type AgentOption = {
  _id: Id<'agents'>;
  name: string;
  isDefault: boolean;
};

export function SyncBoardPurchaseSkills() {
  const catalogQuery = useAction(api.catalogActions.query);
  const catalogGetDetail = useAction(api.catalogActions.getDetail);
  const purchaseSkill = useAction(api.skillPurchaseActions.purchaseSkill);
  const importPurchasedSkill = useAction(api.skillPurchaseImport.importPurchasedSkill);
  const getWalletStatus = useAction(api.skillPurchaseActions.getWalletStatus);
  const agents = useQuery(api.agents.list) as AgentOption[] | undefined;

  const [filters, setFilters] = useState<CatalogSearchFilters>(defaultCatalogSearchFilters);
  const [matches, setMatches] = useState<QueryMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [showFullBrowse, setShowFullBrowse] = useState(false);
  const [selectedSkillName, setSelectedSkillName] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
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
    try {
      const data = (await catalogQuery({
        query: opts?.emptyQuery ? '' : filters.query.trim() || undefined,
        tag: filters.tag.trim() || undefined,
        status: filters.status || undefined,
        since: filters.since ? Date.parse(filters.since) : undefined,
        until: filters.until ? Date.parse(filters.until) : undefined,
        minScore: Number(filters.minScore) || 0,
        skillSlug: filters.skillSlug.trim() || undefined,
        scope: filters.scope,
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
    setSelectedSkillName(name);
    setDetailLoading(true);
    setError('');
    setPurchaseError('');
    setPurchaseLogs([]);
    setPurchaseElapsedSec(0);
    setDetail(null);

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

  function closeDetail() {
    setSelectedSkillName(null);
    setDetail(null);
    setPurchaseError('');
    setPurchaseLogs([]);
    setPurchaseElapsedSec(0);
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
      appendPurchaseLog('Registering purchased skill in the Skills registry and assigning it to the default agent…');
      const defaultAgent = agents?.find((agent) => agent.isDefault) ?? agents?.[0];
      const importResult = await importPurchasedSkill({
        purchasedSkillId: result.purchasedSkillId,
        ...(defaultAgent?._id ? { targetAgentId: defaultAgent._id } : {}),
      });
      const selectedAgentName = defaultAgent?.name ?? 'the default agent';
      appendPurchaseLog(
        `${importResult.alreadyImported ? 'Already registered' : 'Registered'} as skill ${importResult.skillRegistryId} and assigned to ${selectedAgentName}.`,
      );
      setPurchaseError('');
      alert(`Purchased "${skillName}" and added it to ${selectedAgentName}.`);
      closeDetail();
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

  const purchaseBlock = detail?.payload
    ? ((detail.payload as Record<string, unknown>).purchase as Record<string, unknown> | undefined)
    : undefined;
  const mintingFee = purchaseBlock?.mintingFeeIp ? String(purchaseBlock.mintingFeeIp) : undefined;
  const hasQueryScore = Boolean(filters.query.trim());

  return (
    <SyncBoardLayout>
      <div className="purchase-skills-page syncboard-page">
        <SyncBoardPageToolbar
          description={
            <p>
              Browse the Arkiv catalog. Open a skill to view full metadata and purchase. Purchases use
              your AGENT_PRIVATE_KEY wallet on Story Aeneid and are registered on the default agent
              automatically. Run <code>npm run cdr-storage</code> in a second terminal before buying.
            </p>
          }
        />

        <CatalogSearchPanel
          filters={filters}
          onChange={setFilters}
          onSearch={() => void runSearch()}
          onBrowseAll={() => void runSearch({ full: true, emptyQuery: true })}
          loading={loading}
        />

        {error && <p className="purchase-error">{error}</p>}

        {!searched && !loading && (
          <p className="purchase-hint">
            Search by keyword or click Browse all to load published listings.
          </p>
        )}

        {searched && !loading && !error && matches.length === 0 && (
          <p className="purchase-hint">No skills matched your filters.</p>
        )}

        {loading && searched ? <SkillCardGridSkeleton count={6} /> : null}

        {searched && !loading && matches.length > 0 ? (
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
                  onClick={() => void openDetail(match.skillName)}
                />
              ))}
            </div>
          </>
        ) : null}

        <CatalogSkillDialog
          open={selectedSkillName !== null}
          onClose={closeDetail}
          detail={detail}
          loading={detailLoading}
          purchaseFee={mintingFee}
          walletConfigured={walletConfigured}
          walletAddress={walletAddress}
          onPurchase={() => void handlePurchase()}
          purchaseLoading={purchaseLoading}
          purchaseError={purchaseError}
          purchaseLogs={purchaseLogs}
          purchaseElapsedSec={purchaseElapsedSec}
        />
      </div>
    </SyncBoardLayout>
  );
}
