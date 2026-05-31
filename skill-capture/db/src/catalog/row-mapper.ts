import { randomUUID } from "node:crypto";
import type {
  SkillListingPayload,
  TrainingDataListingPayload,
  ListingOps,
  PurchaseInfo,
} from "../types.js";
import { ListingOpsSchema, PurchaseInfoSchema, SkillListingPayloadSchema, TrainingDataListingPayloadSchema } from "../types.js";

export type CatalogListingRow = {
  id: string;
  content_kind: "skill" | "trainingData";
  skill_slug: string;
  status: string;
  owner_wallet: string;
  creator_wallet: string;
  version: number;
  title: string;
  description: string;
  expertise_source: string | null;
  recorded_at: string | null;
  search_text: string;
  triggers: string[];
  trigger_count: number;
  tag_cursor: boolean;
  video_mime: string | null;
  purchase_vault_uuid: number;
  purchase_ip_id: string;
  purchase_license_terms_id: string;
  purchase_cid: string;
  purchase_minting_fee_ip: string;
  purchase_network: string;
  purchase_published_at: string;
  purchase_publisher_address: string;
  ops: ListingOps;
  payload: SkillListingPayload | TrainingDataListingPayload;
  published_at_ms: number;
  recorded_at_ms: number;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export function payloadFromRow(row: CatalogListingRow): SkillListingPayload | TrainingDataListingPayload {
  if (row.content_kind === "trainingData") {
    return TrainingDataListingPayloadSchema.parse(row.payload);
  }
  return SkillListingPayloadSchema.parse(row.payload);
}

export function rowFromSkillPayload(
  payload: SkillListingPayload,
  meta: {
    id?: string;
    status: string;
    ownerWallet: string;
    creatorWallet: string;
    version: number;
    tagCursor: boolean;
    expiresAt?: string | null;
  },
): Omit<CatalogListingRow, "created_at" | "updated_at"> {
  const purchase = PurchaseInfoSchema.parse(payload.purchase);
  const ops = ListingOpsSchema.parse(payload.ops);
  const publishedAtMs = Date.parse(purchase.publishedAt) || Date.now();
  const recordedAtMs = payload.recordedAt ? Date.parse(payload.recordedAt) : publishedAtMs;
  return {
    id: meta.id ?? randomUUID(),
    content_kind: "skill",
    skill_slug: payload.skillName,
    status: meta.status,
    owner_wallet: meta.ownerWallet,
    creator_wallet: meta.creatorWallet,
    version: meta.version,
    title: payload.title,
    description: payload.description,
    expertise_source: payload.expertiseSource ?? null,
    recorded_at: payload.recordedAt ?? null,
    search_text: payload.searchText,
    triggers: payload.triggers ?? [],
    trigger_count: payload.triggerCount,
    tag_cursor: meta.tagCursor,
    video_mime: null,
    purchase_vault_uuid: purchase.vaultUuid,
    purchase_ip_id: purchase.ipId,
    purchase_license_terms_id: purchase.licenseTermsId,
    purchase_cid: purchase.cid,
    purchase_minting_fee_ip: purchase.mintingFeeIp,
    purchase_network: purchase.network,
    purchase_published_at: purchase.publishedAt,
    purchase_publisher_address: purchase.publisherAddress,
    ops,
    payload,
    published_at_ms: publishedAtMs,
    recorded_at_ms: recordedAtMs,
    expires_at: meta.expiresAt ?? null,
  };
}

export function rowFromTrainingPayload(
  payload: TrainingDataListingPayload,
  meta: {
    id?: string;
    status: string;
    ownerWallet: string;
    creatorWallet: string;
    version: number;
    tagCursor: boolean;
    expiresAt?: string | null;
  },
): Omit<CatalogListingRow, "created_at" | "updated_at"> {
  const base = rowFromSkillPayload(payload, meta);
  return {
    ...base,
    content_kind: "trainingData",
    video_mime: payload.videoMime,
    payload,
  };
}

export function purchaseFromRow(row: CatalogListingRow): PurchaseInfo {
  return {
    vaultUuid: Number(row.purchase_vault_uuid),
    ipId: row.purchase_ip_id,
    licenseTermsId: row.purchase_license_terms_id,
    cid: row.purchase_cid,
    mintingFeeIp: row.purchase_minting_fee_ip,
    network: row.purchase_network,
    publishedAt: row.purchase_published_at,
    publisherAddress: row.purchase_publisher_address,
  };
}
