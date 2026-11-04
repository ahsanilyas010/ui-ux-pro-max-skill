export type CodErrorCode =
  | "validation"
  | "sold_out"
  | "rate_limited"
  | "blocked"
  | "disabled"
  | "bad_request"
  | "forbidden"
  | "internal";

export class CodError extends Error {
  constructor(
    public code: CodErrorCode,
    public status: number,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export function json(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  if (!headers.has("Cache-Control")) headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(body), { ...init, headers });
}

export function errorResponse(err: unknown): Response {
  if (err instanceof CodError) {
    const headers: Record<string, string> = {};
    if (err.code === "rate_limited") headers["Retry-After"] = String(err.details?.retryAfter ?? 600);
    return json({ ok: false, code: err.code, message: err.message, ...err.details }, { status: err.status, headers });
  }
  return json({ ok: false, code: "internal", message: "Something went wrong. Please try again." }, { status: 500 });
}
