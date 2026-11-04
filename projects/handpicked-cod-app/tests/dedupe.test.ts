import { describe, expect, it } from "vitest";
import { dedupeHash, isWithinWindow, saltedHash, DEDUPE_WINDOW_MS } from "../app/lib/cod/dedupe";

describe("dedupe", () => {
  const phone = "+923001234567";
  it("is order independent", () => {
    const a = dedupeHash("s", phone, [{ variantId: 1, quantity: 1 }, { variantId: 2, quantity: 2 }]);
    const b = dedupeHash("s", phone, [{ variantId: "2", quantity: 2 }, { variantId: "1", quantity: 1 }]);
    expect(a).toBe(b);
  });
  it("merges split lines", () => {
    const a = dedupeHash("s", phone, [{ variantId: 1, quantity: 2 }]);
    const b = dedupeHash("s", phone, [{ variantId: 1, quantity: 1 }, { variantId: 1, quantity: 1 }]);
    expect(a).toBe(b);
  });
  it("differs by phone, shop, quantity", () => {
    const base = dedupeHash("s", phone, [{ variantId: 1, quantity: 1 }]);
    expect(dedupeHash("s", "+923009999999", [{ variantId: 1, quantity: 1 }])).not.toBe(base);
    expect(dedupeHash("t", phone, [{ variantId: 1, quantity: 1 }])).not.toBe(base);
    expect(dedupeHash("s", phone, [{ variantId: 1, quantity: 2 }])).not.toBe(base);
  });
  it("window", () => {
    const now = Date.now();
    expect(isWithinWindow(new Date(now - 60_000), now)).toBe(true);
    expect(isWithinWindow(new Date(now - DEDUPE_WINDOW_MS - 1), now)).toBe(false);
  });
  it("salted hash differs", () => expect(saltedHash("x", 1)).not.toBe(saltedHash("x", 2)));
});
