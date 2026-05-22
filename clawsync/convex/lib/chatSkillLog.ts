/** Structured logs for in-chat Arkiv search / purchase (visible in Convex dashboard). */

export function logChatSkill(
  stage: string,
  data: Record<string, unknown>,
): void {
  console.log(`[chat-skill] ${stage}`, JSON.stringify(data));
}
