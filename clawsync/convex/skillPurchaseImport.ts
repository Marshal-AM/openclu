// @ts-nocheck — avoids circular inference with generated internal API
'use node';

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { action } from './_generated/server';
import { v } from 'convex/values';
import type { Id } from './_generated/dataModel';
import { api, internal } from './_generated/api';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const skillInternal = (internal as any).skillPurchasesInternal;

function parseSkillMd(raw: string): { name: string; description: string; body: string } {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('---')) {
    return { name: 'purchased-skill', description: trimmed.slice(0, 500), body: trimmed };
  }
  const end = trimmed.indexOf('---', 3);
  if (end < 0) {
    return { name: 'purchased-skill', description: '', body: trimmed };
  }
  const frontmatter = trimmed.slice(3, end).trim();
  const body = trimmed.slice(end + 3).trim();
  let name = 'purchased-skill';
  let description = '';
  for (const line of frontmatter.split('\n')) {
    const m = line.match(/^([a-zA-Z_-]+):\s*(.+)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim().replace(/^["']|["']$/g, '');
    if (key === 'name') name = val;
    if (key === 'description') description = val;
  }
  return { name, description: description || body.slice(0, 500), body };
}

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
