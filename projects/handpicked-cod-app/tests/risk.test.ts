import { describe, expect, it } from "vitest";
import { assessRisk, type RiskInput } from "../app/lib/cod/risk";

const base: RiskInput = {
  isNewPhone: true,
  cityVerified: true,
  rawCity: "Lahore",
  subtotal: 500000,
  maxSubtotal: 6000000,
  highValueCap: 1500000,
  refusals: 0,
  variantOrders24h: 0,
};

describe("assessRisk", () => {
  it("clean new phone is only tagged new-phone", () => {
    const r = assessRisk(base);
    expect(r.tags).toEqual(["risk:new-phone"]);
    expect(r.needsConfirmation).toBe(false);
    expect(r.advanceRequired).toBe(false);
  });
  it("junk city needs confirmation", () => {
    const r = assessRisk({ ...base, cityVerified: false, rawCity: "asdf" });
    expect(r.tags).toContain("risk:junk-city");
    expect(r.tags).toContain("needs-confirmation");
    expect(r.advanceRequired).toBe(false);
  });
  it("unverified but plausible city alone does not hold the order", () => {
    const r = assessRisk({ ...base, cityVerified: false, rawCity: "Small Village" });
    expect(r.tags).toContain("risk:city-unverified");
    expect(r.needsConfirmation).toBe(false);
  });
  it("high value new phone requires advance", () => {
    const r = assessRisk({ ...base, subtotal: 1500001 });
    expect(r.advanceRequired).toBe(true);
    expect(r.tags).toEqual(expect.arrayContaining(["risk:high-value", "needs-confirmation", "advance-required"]));
  });
  it("exactly at the cap is allowed", () => expect(assessRisk({ ...base, subtotal: 1500000 }).advanceRequired).toBe(false));
  it("returning phone high value is not held", () => {
    const r = assessRisk({ ...base, isNewPhone: false, subtotal: 2000000 });
    expect(r.needsConfirmation).toBe(false);
    expect(r.advanceRequired).toBe(false);
  });
  it("velocity flags new phones", () => {
    const r = assessRisk({ ...base, variantOrders24h: 3 });
    expect(r.tags).toContain("risk:velocity");
    expect(r.needsConfirmation).toBe(true);
  });
  it("repeat refusals hold even returning phones", () => {
    const r = assessRisk({ ...base, isNewPhone: false, refusals: 1 });
    expect(r.tags).toContain("risk:repeat-refusals");
    expect(r.needsConfirmation).toBe(true);
  });
});
