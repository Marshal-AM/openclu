/**
 * CDR HTTP client — fresh TCP per request (no stale keep-alive after long capture).
 */
const CDR_FETCH_TIMEOUT_MS = Number(process.env.CDR_FETCH_TIMEOUT_MS ?? "600000");
const MAX_ATTEMPTS = 4;
const RETRY_CODES = new Set(["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EPIPE", "UND_ERR_SOCKET"]);

function errnoCode(e: unknown): string {
  if (e instanceof Error && e.cause && typeof e.cause === "object" && "code" in e.cause) {
    return String((e.cause as NodeJS.ErrnoException).code);
  }
  if (e instanceof Error && "code" in e) {
    return String((e as NodeJS.ErrnoException).code);
  }
  return "";
}

function mergeHeaders(init?: RequestInit): Headers {
  const headers = new Headers(init?.headers);
  headers.set("Connection", "close");
  return headers;
}

export async function cdrFetch(url: string, init?: RequestInit, attempt = 1): Promise<Response> {
  try {
    return await fetch(url, {
      ...init,
      headers: mergeHeaders(init),
      signal: AbortSignal.timeout(CDR_FETCH_TIMEOUT_MS),
      keepalive: false,
    });
  } catch (e) {
    const code = errnoCode(e);
    if (attempt < MAX_ATTEMPTS && RETRY_CODES.has(code)) {
      const delay = 400 * attempt;
      console.log(
        `  [cli] CDR request retry ${attempt + 1}/${MAX_ATTEMPTS}${code ? ` (${code})` : ""}…`,
      );
      await new Promise((r) => setTimeout(r, delay));
      return cdrFetch(url, init, attempt + 1);
    }
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `CDR server request failed (${url})${code ? ` [${code}]` : ""}: ${msg}. ` +
        `Check the CDR server terminal for [cdr] ${init?.method ?? "GET"} ${new URL(url).pathname} and any errors.`,
    );
  }
}
