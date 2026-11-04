import { describe, expect, it } from "vitest";
import { matchCity, isJunkCity, levenshtein, CITY_LIST, provinceCode } from "../app/lib/cod/cities";

describe("matchCity", () => {
  it("has at least 150 cities", () => expect(CITY_LIST.length).toBeGreaterThanOrEqual(150));
  it.each([
    ["karachi", "Karachi"],
    ["  KHI ", "Karachi"],
    ["Lhr", "Lahore"],
    ["pindi", "Rawalpindi"],
    ["Lyallpur", "Faisalabad"],
    ["Pekhawar", "Peshawar"],
    ["rahim yar khan", "Rahim Yar Khan"],
    ["Swat", "Mingora"],
  ])("alias %s", (input, city) => {
    const m = matchCity(input);
    expect(m.city).toBe(city);
    expect(m.verified).toBe(true);
  });
  it("fuzzy matches typos within distance", () => {
    expect(matchCity("Islamabaad").city).toBe("Islamabad");
    expect(matchCity("Gujranwla").city).toBe("Gujranwala");
    expect(matchCity("Sheikhupra").verified).toBe(true);
  });
  it("does not fuzzy match unrelated words", () => {
    const m = matchCity("Springfield");
    expect(m.verified).toBe(false);
    expect(m.city).toBe("Springfield");
  });
  it("Other is unverified", () => expect(matchCity("other")).toEqual({ city: "Other", province: null, verified: false }));
  it("province codes", () => {
    expect(matchCity("Lahore").province).toBe("Punjab");
    expect(provinceCode("Sindh")).toBe("SD");
    expect(provinceCode(null)).toBeUndefined();
  });
});

describe("isJunkCity", () => {
  it.each(["a", "123", "test", "asdfgh", "xxxxx", "bcdfg", "no"])("junk: %s", (c) => expect(isJunkCity(c)).toBe(true));
  it.each(["Karachi", "Small Village", "Mian Channu"])("not junk: %s", (c) => expect(isJunkCity(c)).toBe(false));
});

describe("levenshtein", () => {
  it("computes", () => {
    expect(levenshtein("kitten", "sitting", 5)).toBe(3);
    expect(levenshtein("a", "a")).toBe(0);
  });
});
