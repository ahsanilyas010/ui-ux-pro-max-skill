import { describe, expect, it } from "vitest";
import { validateLines, subtotalOf, type VariantInfo } from "../app/lib/cod/variants";

type Over = Partial<Omit<VariantInfo, "product">> & { product?: Partial<VariantInfo["product"]> };
const v = (over: Over = {}): VariantInfo => ({
  id: "1",
  gid: "gid://shopify/ProductVariant/1",
  title: "M",
  price: 249900,
  availableForSale: true,
  inventoryQuantity: 3,
  inventoryPolicy: "DENY",
  ...over,
  product: { id: "p", title: "Polo", vendor: "Boss", handle: "polo", status: "ACTIVE", published: true, imageUrl: null, ...over.product },
});

describe("validateLines", () => {
  const lines = [{ variantId: "1", quantity: 2 }];
  it("passes valid", () => expect(validateLines(lines, new Map([["1", v()]]))).toEqual([]));
  it("missing", () => expect(validateLines(lines, new Map())[0].reason).toBe("missing"));
  it("draft product", () => expect(validateLines(lines, new Map([["1", v({ product: { status: "DRAFT" } })]]))[0].reason).toBe("inactive"));
  it("unpublished", () => expect(validateLines(lines, new Map([["1", v({ product: { published: false } })]]))[0].reason).toBe("unpublished"));
  it("sold out", () => expect(validateLines(lines, new Map([["1", v({ availableForSale: false })]]))[0].reason).toBe("sold_out"));
  it("quantity above stock under DENY", () => {
    const p = validateLines([{ variantId: "1", quantity: 4 }], new Map([["1", v()]]));
    expect(p[0]).toMatchObject({ reason: "insufficient_stock", available: 3 });
  });
  it("split lines cannot bypass stock", () => {
    const p = validateLines([{ variantId: "1", quantity: 2 }, { variantId: "1", quantity: 2 }], new Map([["1", v()]]));
    expect(p[0].reason).toBe("insufficient_stock");
  });
  it("CONTINUE policy ignores stock", () => {
    expect(validateLines([{ variantId: "1", quantity: 9 }], new Map([["1", v({ inventoryPolicy: "CONTINUE" })]]))).toEqual([]);
  });
  it("subtotal", () => expect(subtotalOf([{ variantId: "1", quantity: 2 }], new Map([["1", v()]]))).toBe(499800));
});
