export type ArkivQueryTrace = {
  operation: string;
  source: string;
  request: unknown;
  response: unknown;
  queriedAt: string;
  meta?: Record<string, unknown>;
};

export function createArkivTrace(
  operation: string,
  source: string,
  request: unknown,
  response: unknown,
  meta?: Record<string, unknown>,
): ArkivQueryTrace {
  return {
    operation,
    source,
    request,
    response,
    queriedAt: new Date().toISOString(),
    ...(meta ? { meta } : {}),
  };
}

export function splitArkivTrace<T extends Record<string, unknown>>(
  payload: T & { arkivTrace?: ArkivQueryTrace },
): { data: Omit<T, "arkivTrace">; trace: ArkivQueryTrace | null } {
  const { arkivTrace, ...data } = payload;
  return { data: data as Omit<T, "arkivTrace">, trace: arkivTrace ?? null };
}
