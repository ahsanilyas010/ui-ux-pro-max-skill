import { describe, expect, it } from "vitest";
import { normalisePkMobile, formatPkMobileLocal } from "../app/lib/cod/phone";

describe("normalisePkMobile", () => {
  it.each([
    ["03001234567", "+923001234567"],
    ["0300 1234567", "+923001234567"],
    ["0300-123-4567", "+923001234567"],
    ["3001234567", "+923001234567"],
    ["+923001234567", "+923001234567"],
    ["+92 300 1234567", "+923001234567"],
    ["923001234567", "+923001234567"],
    ["00923451234567", "+923451234567"],
  ])("accepts %s", (input, out) => expect(normalisePkMobile(input)).toBe(out));

  it.each(["", "0421234567", "042-35761234", "0300123456", "030012345678", "02001234567", "+971501234567", "abc", "0092 21 111"])(
    "rejects %s",
    (input) => expect(normalisePkMobile(input)).toBeNull(),
  );
  it("rejects non strings", () => expect(normalisePkMobile(undefined)).toBeNull());
  it("formats local", () => expect(formatPkMobileLocal("+923001234567")).toBe("0300 1234567"));
});
