export type CatalogQueryTrace = {
  operation: string;
  source: string;
  request: unknown;
  response: unknown;
  queriedAt: string;
  meta?: Record<string, unknown>;
};

export function createCatalogTrace(
  operation: string,
  source: string,
  request: unknown,
  response: unknown,
  meta?: Record<string, unknown>,
): CatalogQueryTrace {
  return {
    operation,
    source,
    request,
    response,
    queriedAt: new Date().toISOString(),
    ...(meta ? { meta } : {}),
  };
}
