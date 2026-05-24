'use node';

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { action } from './_generated/server';
import { v } from 'convex/values';
import type { Id } from './_generated/dataModel';
import { internal } from './_generated/api';
import { loadClawsyncDotEnv } from './lib/clawsyncDotenv';
import {
  runMarketplaceCli,
  runMarketplaceCliWithLogs,
  getPurchasedTrainingDataBaseDir,
} from './lib/marketplaceCli';

type TrainingPurchasesInternal = {
  findBySkillName: typeof internal.trainingDataPurchasesInternal.findBySkillName;
  insertPurchased: typeof internal.trainingDataPurchasesInternal.insertPurchased;
};

const trainingInternal = (internal as unknown as {
  trainingDataPurchasesInternal: TrainingPurchasesInternal;
}).trainingDataPurchasesInternal;

export const getWalletStatus = action({
  args: {},
  handler: async () => {
    return await runMarketplaceCli<{ configured: boolean; address: string | null }>(
      'wallet-address',
    );
  },
});

export const getPurchasedVideo = action({
  args: { id: v.id('purchasedTrainingData') },
  handler: async (ctx, args): Promise<{ found: boolean; base64?: string; videoMime?: string }> => {
    const row = await ctx.runQuery(internal.trainingDataPurchasesInternal.getPurchasedInternal, {
      id: args.id,
    });
    if (!row) throw new Error('Purchase not found');
    const b64Path = resolve(row.localPath, 'video.b64');
    if (!existsSync(b64Path)) {
      return { found: false };
    }
    const base64 = readFileSync(b64Path, 'utf-8');
    return { found: true, base64, videoMime: row.videoMime };
  },
});

export const purchaseTrainingData = action({
  args: {
    skillName: v.string(),
    catalogSnapshot: v.optional(
      v.object({
        entityKey: v.string(),
        payload: v.any(),
      }),
    ),
  },
  returns: v.object({
    success: v.boolean(),
    purchasedTrainingDataId: v.id('purchasedTrainingData'),
    skillName: v.string(),
    title: v.string(),
    description: v.string(),
    buyerAddress: v.string(),
    licenseTokenId: v.string(),
    mintingFeeIp: v.string(),
    localPath: v.string(),
    videoMime: v.string(),
    readTxHash: v.string(),
    cid: v.string(),
    durationMs: v.number(),
    logs: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    loadClawsyncDotEnv();
    if (!process.env.AGENT_PRIVATE_KEY?.trim()) {
      throw new Error(
        'AGENT_PRIVATE_KEY is not configured. Add it to clawsync/.env or run: npx convex env set AGENT_PRIVATE_KEY <hex>',
      );
    }

    const existing = await ctx.runQuery(trainingInternal.findBySkillName, {
      skillName: args.skillName,
    });
    if (existing) {
      throw new Error(`Training data "${args.skillName}" is already purchased.`);
    }

    const outputDir = getPurchasedTrainingDataBaseDir();
    const { result, logs, durationMs } = await runMarketplaceCliWithLogs<{
      skillName: string;
      title: string;
      description: string;
      buyerAddress: string;
      licenseTokenId: string;
      mintingFeeIp: string;
      localPath: string;
      readTxHash: string;
      cid: string;
    }>('purchase-training', {
      skillName: args.skillName,
      outputDir,
      catalogSnapshot: args.catalogSnapshot,
    });

    const metaPath = resolve(result.localPath, 'video.meta.json');
    let videoMime = 'video/webm';
    if (existsSync(metaPath)) {
      const meta = JSON.parse(readFileSync(metaPath, 'utf-8')) as { mimeType?: string };
      if (meta.mimeType) videoMime = meta.mimeType;
    }

    const id: Id<'purchasedTrainingData'> = await ctx.runMutation(trainingInternal.insertPurchased, {
      skillName: result.skillName,
      title: result.title,
      description: result.description,
      buyerAddress: result.buyerAddress,
      licenseTokenId: result.licenseTokenId,
      mintingFeeIp: result.mintingFeeIp,
      localPath: result.localPath,
      videoMime,
      readTxHash: result.readTxHash,
      cid: result.cid,
    });

    return {
      success: true,
      purchasedTrainingDataId: id,
      videoMime,
      ...result,
      durationMs,
      logs,
    };
  },
});
