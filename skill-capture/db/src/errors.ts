export class DbError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "DbError";
  }
}

export function wrapDbError(err: unknown): DbError {
  if (err instanceof DbError) return err;
  const message = err instanceof Error ? err.message : String(err);
  if (/not found|no rows/i.test(message)) {
    return new DbError("NOT_FOUND", message);
  }
  return new DbError("DB_ERROR", message);
}
