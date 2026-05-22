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
  getPurchasedSkillsBaseDir,
} from './lib/marketplaceCli';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const skillInternal = (internal as any).skillPurchasesInternal;

export const getWalletStatus = action({
  args: {},
  handler: async () => {
    return await runMarketplaceCli<{ configured: boolean; address: string | null }>(
      'wallet-address',
    );
  },
});

export const getSkillPreview = action({
  args: { id: v.id('purchasedSkills') },
  handler: async (ctx, args) => {
    const row = await ctx.runQuery(skillInternal.getPurchasedInternal, {
      id: args.id,
    });
    if (!row) throw new Error('Purchase not found');
    const skillPath = resolve(row.localPath, 'SKILL.md');
    if (!existsSync(skillPath)) {
      return { excerpt: '', found: false };
    }
    const raw = readFileSync(skillPath, 'utf-8');
    const lines = raw.split('\n').slice(0, 24);
    return { excerpt: lines.join('\n'), found: true };
  },
});

export const purchaseSkill = action({
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
    purchasedSkillId: v.id('purchasedSkills'),
    skillName: v.string(),
    title: v.string(),
    description: v.string(),
    buyerAddress: v.string(),
    licenseTokenId: v.string(),
    mintingFeeIp: v.string(),
    localPath: v.string(),
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

    console.log(`[skill-purchase] start skill=${args.skillName}`);
    if (args.catalogSnapshot?.payload) {
      const p = args.catalogSnapshot.payload as {
        purchase?: { cid?: string };
        ops?: { heliaMultiaddrs?: string[] };
      };
      console.log(
        `[skill-purchase] catalogSnapshot entityKey=${args.catalogSnapshot.entityKey} cid=${p?.purchase?.cid ?? '?'} heliaAddrs=${p?.ops?.heliaMultiaddrs?.length ?? 0}`,
      );
    } else {
      console.warn(
        `[skill-purchase] no catalogSnapshot — CLI will load listing from Arkiv (slower, may differ from UI preview)`,
      );
    }

    const existing = await ctx.runQuery(skillInternal.findBySkillName, {
      skillName: args.skillName,
      status: 'purchased',
    });
    if (existing) {
      throw new Error(
        `Skill "${args.skillName}" is already purchased. Import it from My Purchased Skills.`,
      );
    }

    const outputDir = getPurchasedSkillsBaseDir();
    console.log(`[skill-purchase] outputDir=${outputDir}`);

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
    }>('purchase', {
      skillName: args.skillName,
      outputDir,
      catalogSnapshot: args.catalogSnapshot,
    });

    console.log(
      `[skill-purchase] CLI finished in ${durationMs}ms license=${result.licenseTokenId} cid=${result.cid}`,
    );

    const id: Id<'purchasedSkills'> = await ctx.runMutation(skillInternal.insertPurchased, {
      skillName: result.skillName,
      title: result.title,
      description: result.description,
      buyerAddress: result.buyerAddress,
      licenseTokenId: result.licenseTokenId,
      mintingFeeIp: result.mintingFeeIp,
      localPath: result.localPath,
      readTxHash: result.readTxHash,
      cid: result.cid,
    });

    return { success: true, purchasedSkillId: id, ...result, durationMs, logs };
  },
});
