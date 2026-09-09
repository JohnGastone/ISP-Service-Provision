import { describe, expect, it } from "vitest";
import {
  TZ_PHONE_REGEX,
  TZ_REGIONS,
  districtsFor,
  formatTzPhone,
  isValidLocation,
  isValidTzPhone,
  normalizePhoneInput,
  toE164,
} from "@/lib/tz";

describe("Tanzanian phone validation", () => {
  it.each([
    "0712345678",
    "0654111222",
    "255712345678",
    "+255712345678",
    "0762000111",
    "0678000111",
  ])("accepts %s", (input) => {
    expect(isValidTzPhone(input)).toBe(true);
  });

  it.each([
    ["0812345678", "prefix digit must be 6 or 7"],
    ["0512345678", "prefix digit must be 6 or 7"],
    ["071234567", "too short"],
    ["07123456789", "too long"],
    ["+254712345678", "Kenyan country code"],
    ["", "empty"],
    ["07abcdefgh", "non-numeric"],
    ["+255812345678", "valid country code but bad network digit"],
  ])("rejects %s (%s)", (input) => {
    expect(isValidTzPhone(input)).toBe(false);
  });

  it("tolerates spaces, hyphens and parentheses", () => {
    expect(isValidTzPhone("0712 345 678")).toBe(true);
    expect(isValidTzPhone("0712-345-678")).toBe(true);
    expect(isValidTzPhone("(0712) 345 678")).toBe(true);
  });

  it("exposes a regex that matches only normalised input", () => {
    expect(TZ_PHONE_REGEX.test("0712345678")).toBe(true);
    expect(TZ_PHONE_REGEX.test("0712 345 678")).toBe(false);
  });
});

describe("normalizePhoneInput", () => {
  it("strips formatting characters only", () => {
    expect(normalizePhoneInput("(0712) 345-678")).toBe("0712345678");
    expect(normalizePhoneInput("+255 712 345 678")).toBe("+255712345678");
  });
});

describe("toE164", () => {
  it.each([
    ["0712345678", "+255712345678"],
    ["255712345678", "+255712345678"],
    ["+255712345678", "+255712345678"],
    ["0712 345 678", "+255712345678"],
  ])("converts %s to %s", (input, expected) => {
    expect(toE164(input)).toBe(expected);
  });

  it("is idempotent", () => {
    expect(toE164(toE164("0712345678"))).toBe("+255712345678");
  });
});

describe("formatTzPhone", () => {
  it.each([
    ["+255712345678", "0712 345 678"],
    ["255712345678", "0712 345 678"],
    ["0712345678", "0712 345 678"],
    ["+255654111222", "0654 111 222"],
  ])("displays %s as %s", (input, expected) => {
    expect(formatTzPhone(input)).toBe(expected);
  });

  it("returns the input unchanged when it is not a 9-digit national number", () => {
    expect(formatTzPhone("12345")).toBe("12345");
  });
});

describe("regions and districts", () => {
  it("lists regions sorted and includes the Zanzibar regions", () => {
    expect(TZ_REGIONS).toEqual([...TZ_REGIONS].sort());
    expect(TZ_REGIONS).toContain("Dar es Salaam");
    expect(TZ_REGIONS).toContain("Mjini Magharibi");
  });

  it("returns districts for a known region", () => {
    expect(districtsFor("Dar es Salaam")).toContain("Kinondoni");
    expect(districtsFor("Kilimanjaro")).toContain("Moshi Municipal");
  });

  it("returns an empty list for an unknown region rather than throwing", () => {
    expect(districtsFor("Atlantis")).toEqual([]);
  });

  it("validates that a district belongs to its region", () => {
    expect(isValidLocation("Dar es Salaam", "Kinondoni")).toBe(true);
    // Kinondoni is in Dar es Salaam, not Kilimanjaro.
    expect(isValidLocation("Kilimanjaro", "Kinondoni")).toBe(false);
    expect(isValidLocation("", "")).toBe(false);
  });

  it("gives every region at least one district", () => {
    for (const region of TZ_REGIONS) {
      expect(districtsFor(region).length).toBeGreaterThan(0);
    }
  });
});
