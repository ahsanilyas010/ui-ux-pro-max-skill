import { describe, expect, it } from "vitest";
import { computeShipping, computeTotals, paisaToDecimal, decimalToPaisa } from "../app/lib/cod/shipping";

const cfg = { freeThreshold: 300000, flatRate: 25000 };

describe("shipping", () => {
  it("charges flat rate below threshold", () => expect(computeShipping(299999, cfg)).toBe(25000));
  it("free at threshold", () => expect(computeShipping(300000, cfg)).toBe(0));
  it("free above threshold", () => expect(computeShipping(450000, cfg)).toBe(0));
  it("zero for empty", () => expect(computeShipping(0, cfg)).toBe(0));
  it("totals", () => expect(computeTotals(100000, cfg)).toEqual({ subtotal: 100000, shipping: 25000, total: 125000 }));
  it("money conversion", () => {
    expect(paisaToDecimal(125050)).toBe("1250.50");
    expect(decimalToPaisa("2499.00")).toBe(249900);
    expect(decimalToPaisa("19.99")).toBe(1999);
  });
});
