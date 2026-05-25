import { queryCatalog, queryCatalogTraining } from "@/lib/catalog";
import { listDevicesForOwner } from "@/lib/orchestrator-db";

export type ContributionKind = "skill" | "training";

export type Contribution = {
  id: string;
  device_id: string;
  device_name: string | null;
  device_wallet_address: string;
  skill_slug: string;
  status: string;
  title: string | null;
  description: string | null;
  arkiv_listing_key: string | null;
  arkiv_version: number | null;
  kind: ContributionKind;
  /** Sort key from Arkiv purchase.publishedAt */
  published_at_ms: number;
};

type ArkivMatch = {
  entityKey?: string;
  listingKey?: string;
  skillName?: string;
  title?: string;
  description?: string;
  status?: string;
  arkivVersion?: number;
  purchase?: { publishedAt?: string };
};

function publishedAtMs(match: ArkivMatch): number {
  const raw = match.purchase?.publishedAt;
  if (!raw) return 0;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : 0;
}

function mapMatch(
  match: ArkivMatch,
  device: { id: string; device_name: string; wallet_address: string },
  kind: ContributionKind,
): Contribution {
  const listingKey = match.listingKey ?? match.entityKey ?? "";
  return {
    id: listingKey || `${device.id}:${match.skillName}:${kind}`,
    device_id: device.id,
    device_name: device.device_name,
    device_wallet_address: device.wallet_address,
    skill_slug: match.skillName ?? "",
    status: match.status ?? "published",
    title: match.title ?? null,
    description: match.description ?? null,
    arkiv_listing_key: listingKey || null,
    arkiv_version: match.arkivVersion ?? null,
    kind,
    published_at_ms: publishedAtMs(match),
  };
}

export type ListContributionsResult = {
  contributions: Contribution[];
  warnings: string[];
};

export async function listContributionsForOwner(
  ownerWallet: string,
): Promise<ListContributionsResult> {
  const devices = await listDevicesForOwner(ownerWallet);
  if (devices.length === 0) {
    return { contributions: [], warnings: [] };
  }

  const contributions: Contribution[] = [];
  const warnings: string[] = [];

  await Promise.all(
    devices.map(async (device) => {
      const ownerAddress = device.wallet_address;
      try {
        const [skillRes, trainingRes] = await Promise.all([
          queryCatalog({ scope: "mine", ownerAddress, full: true }),
          queryCatalogTraining({ scope: "mine", ownerAddress, full: true }),
        ]);
        for (const m of (skillRes.matches ?? []) as ArkivMatch[]) {
          contributions.push(mapMatch(m, device, "skill"));
        }
        for (const m of (trainingRes.matches ?? []) as ArkivMatch[]) {
          contributions.push(mapMatch(m, device, "training"));
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        warnings.push(`${device.device_name}: ${msg}`);
      }
    }),
  );

  contributions.sort((a, b) => b.published_at_ms - a.published_at_ms);

  return { contributions, warnings };
}
