'use node';

import { runMarketplaceCli } from './marketplaceCli';
import { logChatSkill } from './chatSkillLog';

export type CatalogSnapshot = {
  entityKey: string;
  payload: unknown;
};

type CatalogDetail = {
  entityKey: string;
  payload: {
    skillName?: string;
    purchase?: { cid?: string };
    ops?: { heliaMultiaddrs?: string[]; heliaPeerId?: string };
  };
};

function payloadHasOps(payload: unknown): payload is CatalogDetail['payload'] {
  if (!payload || typeof payload !== 'object') return false;
  const ops = (payload as CatalogDetail['payload']).ops;
  return Boolean(
    ops?.heliaPeerId &&
      Array.isArray(ops.heliaMultiaddrs) &&
      ops.heliaMultiaddrs.length > 0,
  );
}

function summarize(snapshot: CatalogSnapshot) {
  const p = snapshot.payload as CatalogDetail['payload'];
  return {
    entityKey: snapshot.entityKey,
    skillName: p?.skillName,
    cid: p?.purchase?.cid,
    heliaAddrCount: p?.ops?.heliaMultiaddrs?.length ?? 0,
    heliaPeerId: p?.ops?.heliaPeerId?.slice(0, 20),
  };
}

/**
 * Resolve catalog JSON for purchase.
 * Prefer a complete inline snapshot (search / preview) to avoid an extra get-detail round-trip.
 * Fall back to get-detail (same as SyncBoard preview) when inline is missing or incomplete.
 */
export async function resolvePurchaseCatalogSnapshot(
  skillName: string,
  inline?: CatalogSnapshot,
): Promise<{ snapshot: CatalogSnapshot; source: 'inline' | 'get_detail' | 'inline_fallback' }> {
  if (inline?.payload && payloadHasOps(inline.payload)) {
    logChatSkill('purchase_catalog_resolved', {
      source: 'inline',
      ...summarize(inline),
    });
    return { snapshot: inline, source: 'inline' };
  }

  try {
    const detail = (await runMarketplaceCli('get-detail', skillName)) as CatalogDetail;
    const snapshot: CatalogSnapshot = {
      entityKey: detail.entityKey,
      payload: detail.payload,
    };
    if (!payloadHasOps(snapshot.payload)) {
      throw new Error('get-detail payload missing ops.heliaMultiaddrs');
    }
    logChatSkill('purchase_catalog_resolved', {
      source: 'get_detail',
      ...summarize(snapshot),
      inlineEntityKey: inline?.entityKey,
    });
    return { snapshot, source: 'get_detail' };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    if (inline?.payload) {
      logChatSkill('purchase_catalog_resolved', {
        source: 'inline_fallback',
        getDetailError: err,
        ...summarize(inline),
        warning: 'inline payload missing ops — CLI may re-fetch Arkiv',
      });
      return { snapshot: inline, source: 'inline_fallback' };
    }
    throw new Error(`Could not load catalog for "${skillName}": ${err}`);
  }
}
