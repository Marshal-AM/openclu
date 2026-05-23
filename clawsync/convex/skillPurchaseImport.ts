// @ts-nocheck — avoids circular inference with generated internal API
'use node';

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { action } from './_generated/server';
import { v } from 'convex/values';
import type { Id } from './_generated/dataModel';
import { api, internal } from './_generated/api';
import { parseSkillMd } from './lib/skillMd';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const skillInternal = (internal as any).skillPurchasesInternal;

export const importPurchasedSkill = action({
  args: {
    purchasedSkillId: v.id('purchasedSkills'),
    targetAgentId: v.optional(v.id('agents')),
  },
  returns: v.object({
    success: v.boolean(),
    skillRegistryId: v.id('skillRegistry'),
    alreadyImported: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const row = await ctx.runQuery(skillInternal.getPurchasedInternal, {
      id: args.purchasedSkillId,
    });
    if (!row) throw new Error('Purchase not found');
    if (row.status === 'imported' && row.skillRegistryId) {
      if (args.targetAgentId) {
        await ctx.runMutation(api.agentAssignments.assignSkill, {
          agentId: args.targetAgentId,
          skillId: row.skillRegistryId,
        });
      }
      return {
        success: true,
        skillRegistryId: row.skillRegistryId,
        alreadyImported: true,
      };
    }

    const skillPath = resolve(row.localPath, 'SKILL.md');
    if (!existsSync(skillPath)) {
      throw new Error(`SKILL.md not found at ${skillPath}`);
    }

    const raw = readFileSync(skillPath, 'utf-8');
    const parsed = parseSkillMd(raw);
    const skillName = row.skillName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
    const description = parsed.description || row.description;

    const skillRegistryId: Id<'skillRegistry'> = await ctx.runMutation(
      skillInternal.importToRegistry,
      {
        name: skillName,
        description,
        knowledge: parsed.body || raw,
        purchasedSkillId: args.purchasedSkillId,
        targetAgentId: args.targetAgentId,
      },
    );

    return { success: true, skillRegistryId, alreadyImported: false };
  },
});
