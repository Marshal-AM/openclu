export type ArkivErrorCode =
  | "RPC_UNREACHABLE"
  | "INSUFFICIENT_GLM"
  | "TX_REJECTED"
  | "ENTITY_EXPIRED"
  | "VALIDATION_FAILED"
  | "NOT_FOUND"
  | "CONFIG_MISSING"
  | "UNKNOWN";

export class ArkivError extends Error {
  readonly code: ArkivErrorCode;

  constructor(code: ArkivErrorCode, message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "ArkivError";
    this.code = code;
    if (options?.cause) this.cause = options.cause;
  }

  toJSON() {
    return { code: this.code, message: this.message };
  }
}

export function wrapArkivError(err: unknown): ArkivError {
  if (err instanceof ArkivError) return err;
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (lower.includes("insufficient") || lower.includes("funds")) {
    return new ArkivError("INSUFFICIENT_GLM", msg, { cause: err });
  }
  if (lower.includes("rejected") || lower.includes("denied")) {
    return new ArkivError("TX_REJECTED", msg, { cause: err });
  }
  if (lower.includes("expired")) {
    return new ArkivError("ENTITY_EXPIRED", msg, { cause: err });
  }
  if (lower.includes("fetch") || lower.includes("network") || lower.includes("econnrefused")) {
    return new ArkivError("RPC_UNREACHABLE", msg, { cause: err });
  }
  return new ArkivError("UNKNOWN", msg, { cause: err });
}
