import { createHash } from "node:crypto";

export const DEDUPE_WINDOW_MS = 15 * 60 * 1000;

export interface DedupeLine {
  variantId: string | number;
  quantity: number;
}

/** sha256(shop|phone|sorted variantId:qty). Same basket + phone = same order inside the window. */
export function dedupeHash(shop: string, phone: string, lines: DedupeLine[]): string {
  const merged = new Map<string, number>();
  for (const l of lines) {
    const id = String(l.variantId);
    merged.set(id, (merged.get(id) ?? 0) + l.quantity);
  }
  const body = [...merged.entries()]
    .map(([id, q]) => `${id}:${q}`)
    .sort()
    .join(",");
  return createHash("sha256").update(`${shop}|${phone}|${body}`).digest("hex");
}

/**
 * CodOrder.dedupeHash is unique. Inside the window a repeat returns the existing order. Outside the
 * window the old row's hash is replaced with saltedHash() so the same basket can be ordered again.
 */
export function saltedHash(hash: string, at: number): string {
  return createHash("sha256").update(`${hash}|${at}`).digest("hex");
}

export function isWithinWindow(createdAt: Date, now = Date.now()): boolean {
  return now - createdAt.getTime() < DEDUPE_WINDOW_MS;
}
