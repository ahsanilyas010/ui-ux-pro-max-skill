/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from "vitest";
import { buildOrderCreateInput, buildDraftInput, splitName, type CreateOrderParams } from "../app/lib/cod/order";
import { orderSchema, fieldErrors } from "../app/lib/cod/schema";

const params: CreateOrderParams = {
  path: "order_create",
  lines: [{ variantId: "111", quantity: 2 }],
  name: "Ali Raza Khan",
  phone: "+923001234567",
  email: "",
  city: "Lahore",
  province: "Punjab",
  address: "House 1, Street 2, DHA",
  note: "",
  tags: ["COD"],
  attributes: { cod_source: "pdp", utm_source: "" },
  subtotal: 500000,
  shipping: 0,
  total: 500000,
  idempotencyKey: "abc",
  test: false,
};

describe("orderCreate input", () => {
  const { order, options } = buildOrderCreateInput(params) as any;
  it("is a pending COD sale", () => {
    expect(order.financialStatus).toBe("PENDING");
    expect(order.transactions).toEqual([
      { kind: "SALE", status: "PENDING", gateway: "Cash on Delivery (COD)", amountSet: { shopMoney: { amount: "5000.00", currencyCode: "PKR" } }, test: false },
    ]);
  });
  it("decrements inventory obeying policy and sends no receipt", () => {
    expect(options).toMatchObject({ inventoryBehaviour: "DECREMENT_OBEYING_POLICY", sendReceipt: false });
  });
  it("omits sourceName, uses sourceIdentifier", () => {
    expect("sourceName" in order).toBe(false);
    expect(order.sourceIdentifier).toBe("abc");
  });
  it("names the shipping line", () => expect(order.shippingLines[0].title).toBe("Standard Delivery (PostEx)"));
  it("drops empty custom attributes", () => expect(order.customAttributes).toEqual([{ key: "cod_source", value: "pdp" }]));
  it("has PK address with province code", () => expect(order.shippingAddress).toMatchObject({ countryCode: "PK", provinceCode: "PB", firstName: "Ali", lastName: "Raza Khan" }));
  it("uses variant gids", () => expect(order.lineItems[0].variantId).toBe("gid://shopify/ProductVariant/111"));
});

describe("draft input", () => {
  it("adds payment terms when configured", () => {
    const { input } = buildDraftInput({ ...params, paymentTermsTemplateId: "gid://shopify/PaymentTermsTemplate/1" }) as any;
    expect(input.paymentTerms.paymentTermsTemplateId).toContain("PaymentTermsTemplate");
    expect(input.shippingLine.priceWithCurrency.currencyCode).toBe("PKR");
  });
});

describe("splitName", () => {
  it("single name", () => expect(splitName("Ali")).toEqual({ firstName: "Ali", lastName: "" }));
});

describe("orderSchema", () => {
  const valid = {
    lines: [{ variantId: 123, quantity: 1 }],
    name: "Ali Raza",
    phone: "0300 1234567",
    city: "Lahore",
    address: "House 1 Street 2 DHA",
    source: "pdp",
    renderedAt: 1,
  };
  it("accepts a valid payload and normalises variant ids", () => {
    const r = orderSchema.parse(valid);
    expect(r.lines[0].variantId).toBe("123");
  });
  it("reports field errors", () => {
    const r = orderSchema.safeParse({ ...valid, phone: "0421234567", address: "x" });
    expect(r.success).toBe(false);
    if (!r.success) expect(Object.keys(fieldErrors(r.error))).toEqual(expect.arrayContaining(["phone", "address"]));
  });
  it("falls back unknown source", () => expect(orderSchema.parse({ ...valid, source: "weird" }).source).toBe("pdp"));
});
