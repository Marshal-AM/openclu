import { query, mutation, internalQuery } from './_generated/server';
import { v } from 'convex/values';
import type { Id } from './_generated/dataModel';

/**
 * Per-Agent Skill and MCP Server Assignments
 *
 * Controls which skills and MCP servers each agent can access.
 * Used by toolLoader to filter tools per-agent.
 */

// ============================================
// Skill Assignments
// ============================================

// List skill assignments for an agent
export const listSkills = query({
  args: { agentId: v.id('agents') },
  returns: v.array(
    v.object({
      _id: v.id('agentSkillAssignments'),
      agentId: v.id('agents'),
      skillId: v.id('skillRegistry'),
      enabled: v.boolean(),
    })
  ),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('agentSkillAssignments')
      .withIndex('by_agentId', (q) => q.eq('agentId', args.agentId))
      .collect();
    return rows.map(({ _id, agentId, skillId, enabled }) => ({
      _id,
      agentId,
      skillId,
      enabled,
    }));
  },
});

// Assign a skill to an agent (idempotent)
export const assignSkill = mutation({
  args: {
    agentId: v.id('agents'),
    skillId: v.id('skillRegistry'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Check if assignment already exists
    const existing = await ctx.db
      .query('agentSkillAssignments')
      .withIndex('by_agentId', (q) => q.eq('agentId', args.agentId))
      .collect();
    const found = existing.find((a) => a.skillId === args.skillId);
    if (found) {
      // Re-enable if disabled
      if (!found.enabled) {
        await ctx.db.patch(found._id, { enabled: true });
      }
      return null;
    }

    await ctx.db.insert('agentSkillAssignments', {
      agentId: args.agentId,
      skillId: args.skillId,
      enabled: true,
    });
    return null;
  },
});

// Remove a skill assignment from an agent
export const removeSkill = mutation({
  args: {
    agentId: v.id('agents'),
    skillId: v.id('skillRegistry'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const assignments = await ctx.db
      .query('agentSkillAssignments')
      .withIndex('by_agentId', (q) => q.eq('agentId', args.agentId))
      .collect();
    const found = assignments.find((a) => a.skillId === args.skillId);
    if (found) {
      await ctx.db.delete(found._id);
    }
    return null;
  },
});

// Toggle a skill assignment on/off
export const toggleSkill = mutation({
  args: {
    assignmentId: v.id('agentSkillAssignments'),
    enabled: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.assignmentId, { enabled: args.enabled });
    return null;
  },
});

// Internal: skill names/descriptions for system prompt
export const getAgentSkillsSummary = internalQuery({
  args: { agentId: v.id('agents') },
  returns: v.array(
    v.object({
      name: v.string(),
      description: v.string(),
      enabled: v.boolean(),
      skillRegistryId: v.id('skillRegistry'),
    }),
  ),
  handler: async (ctx, args) => {
    const assignments = await ctx.db
      .query('agentSkillAssignments')
      .withIndex('by_agentId', (q) => q.eq('agentId', args.agentId))
      .collect();
    const out: Array<{
      name: string;
      description: string;
      enabled: boolean;
      skillRegistryId: Id<'skillRegistry'>;
    }> = [];
    for (const a of assignments) {
      const skill = await ctx.db.get(a.skillId);
      if (!skill || skill.status !== 'active' || !skill.approved) continue;
      out.push({
        name: skill.name,
        description: skill.description,
        enabled: a.enabled,
        skillRegistryId: skill._id,
      });
    }
    return out;
  },
});

// Internal: active approved skills in the registry not yet assigned to this agent
export const listUnattachedSkillsForAgent = internalQuery({
  args: { agentId: v.id('agents') },
  returns: v.array(
    v.object({
      skillRegistryId: v.id('skillRegistry'),
      name: v.string(),
      description: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const assignments = await ctx.db
      .query('agentSkillAssignments')
      .withIndex('by_agentId', (q) => q.eq('agentId', args.agentId))
      .collect();
    const attached = new Set(assignments.map((a) => a.skillId));
    const skills = await ctx.db
      .query('skillRegistry')
      .withIndex('by_status', (q) => q.eq('status', 'active'))
      .filter((q) => q.eq(q.field('approved'), true))
      .take(200);
    return skills
      .filter((s) => !attached.has(s._id))
      .map((s) => ({
        skillRegistryId: s._id,
        name: s.name,
        description: s.description,
      }));
  },
});

// Internal: get active skill IDs for an agent (used by toolLoader)
export const getAgentSkillIds = internalQuery({
  args: { agentId: v.id('agents') },
  returns: v.array(v.id('skillRegistry')),
  handler: async (ctx, args) => {
    const assignments = await ctx.db
      .query('agentSkillAssignments')
      .withIndex('by_agentId', (q) => q.eq('agentId', args.agentId))
      .collect();
    return assignments
      .filter((a) => a.enabled)
      .map((a) => a.skillId);
  },
});

// ============================================
// MCP Server Assignments
// ============================================

// List MCP server assignments for an agent
export const listMcpServers = query({
  args: { agentId: v.id('agents') },
  returns: v.array(
    v.object({
      _id: v.id('agentMcpAssignments'),
      agentId: v.id('agents'),
      mcpServerId: v.id('mcpServers'),
      enabled: v.boolean(),
    })
  ),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('agentMcpAssignments')
      .withIndex('by_agentId', (q) => q.eq('agentId', args.agentId))
      .collect();
    return rows.map(({ _id, agentId, mcpServerId, enabled }) => ({
      _id,
      agentId,
      mcpServerId,
      enabled,
    }));
  },
});

// Assign an MCP server to an agent (idempotent)
export const assignMcpServer = mutation({
  args: {
    agentId: v.id('agents'),
    mcpServerId: v.id('mcpServers'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('agentMcpAssignments')
      .withIndex('by_agentId', (q) => q.eq('agentId', args.agentId))
      .collect();
    const found = existing.find((a) => a.mcpServerId === args.mcpServerId);
    if (found) {
      if (!found.enabled) {
        await ctx.db.patch(found._id, { enabled: true });
      }
      return null;
    }

    await ctx.db.insert('agentMcpAssignments', {
      agentId: args.agentId,
      mcpServerId: args.mcpServerId,
      enabled: true,
    });
    return null;
  },
});

// Remove an MCP server assignment from an agent
export const removeMcpServer = mutation({
  args: {
    agentId: v.id('agents'),
    mcpServerId: v.id('mcpServers'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const assignments = await ctx.db
      .query('agentMcpAssignments')
      .withIndex('by_agentId', (q) => q.eq('agentId', args.agentId))
      .collect();
    const found = assignments.find((a) => a.mcpServerId === args.mcpServerId);
    if (found) {
      await ctx.db.delete(found._id);
    }
    return null;
  },
});

// Toggle an MCP server assignment on/off
export const toggleMcpServer = mutation({
  args: {
    assignmentId: v.id('agentMcpAssignments'),
    enabled: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.assignmentId, { enabled: args.enabled });
    return null;
  },
});

// Internal: get active MCP server IDs for an agent (used by toolLoader)
export const getAgentMcpIds = internalQuery({
  args: { agentId: v.id('agents') },
  returns: v.array(v.id('mcpServers')),
  handler: async (ctx, args) => {
    const assignments = await ctx.db
      .query('agentMcpAssignments')
      .withIndex('by_agentId', (q) => q.eq('agentId', args.agentId))
      .collect();
    return assignments
      .filter((a) => a.enabled)
      .map((a) => a.mcpServerId);
  },
});
