import { describe, expect, it } from "vitest";
import {
  bandwidthPoolSchema,
  bandwidthRequestSchema,
  customerSchema,
  fieldErrorsOf,
  loginSchema,
  myRequestSchema,
  rejectSchema,
} from "@/lib/validation";

const validCustomer = {
  name: "Acme Corp",
  email: "ops@acme.co.tz",
  phone: "0712345678",
  region: "Dar es Salaam",
  district: "Kinondoni",
};

describe("loginSchema", () => {
  it("accepts a username or an email", () => {
    expect(loginSchema.safeParse({ username: "admin", password: "x" }).success).toBe(true);
    expect(
      loginSchema.safeParse({ username: "ops@acme.co.tz", password: "x" }).success,
    ).toBe(true);
  });

  it("rejects blank credentials", () => {
    expect(loginSchema.safeParse({ username: "", password: "x" }).success).toBe(false);
    expect(loginSchema.safeParse({ username: "admin", password: "" }).success).toBe(false);
  });

  it("trims surrounding whitespace from the username", () => {
    const parsed = loginSchema.parse({ username: "  admin  ", password: "x" });
    expect(parsed.username).toBe("admin");
  });
});

describe("customerSchema", () => {
  it("accepts a valid customer", () => {
    expect(customerSchema.safeParse(validCustomer).success).toBe(true);
  });

  it("normalises the phone number so the API receives digits only", () => {
    const parsed = customerSchema.parse({ ...validCustomer, phone: "0712 345 678" });
    expect(parsed.phone).toBe("0712345678");
  });

  it("rejects a non-Tanzanian phone number", () => {
    const result = customerSchema.safeParse({ ...validCustomer, phone: "+254712345678" });
    expect(result.success).toBe(false);
    expect(fieldErrorsOf(result.error!).phone).toMatch(/Tanzanian/i);
  });

  it("rejects an invalid email", () => {
    const result = customerSchema.safeParse({ ...validCustomer, email: "not-an-email" });
    expect(result.success).toBe(false);
    expect(fieldErrorsOf(result.error!).email).toBeDefined();
  });

  it("rejects a district that does not belong to the region", () => {
    const result = customerSchema.safeParse({
      ...validCustomer,
      region: "Kilimanjaro",
      district: "Kinondoni",
    });
    expect(result.success).toBe(false);
    expect(fieldErrorsOf(result.error!).district).toMatch(/belongs to the chosen region/i);
  });

  it("enforces the API's length limits", () => {
    expect(
      customerSchema.safeParse({ ...validCustomer, name: "ab" }).success,
    ).toBe(false); // too short
    expect(
      customerSchema.safeParse({ ...validCustomer, name: "a".repeat(201) }).success,
    ).toBe(false); // API caps at 200
    expect(
      customerSchema.safeParse({
        ...validCustomer,
        email: `${"a".repeat(250)}@x.co`,
      }).success,
    ).toBe(false); // API caps at 254
  });

  it("requires a region and district", () => {
    expect(customerSchema.safeParse({ ...validCustomer, region: "" }).success).toBe(false);
    expect(customerSchema.safeParse({ ...validCustomer, district: "" }).success).toBe(false);
  });
});

describe("bandwidthPoolSchema", () => {
  it("accepts zero totals, which the API permits", () => {
    const result = bandwidthPoolSchema.safeParse({
      totalUploadMbps: 0,
      totalDownloadMbps: 0,
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative totals", () => {
    const result = bandwidthPoolSchema.safeParse({
      totalUploadMbps: -1,
      totalDownloadMbps: 100,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing or non-numeric values", () => {
    expect(bandwidthPoolSchema.safeParse({ totalDownloadMbps: 100 }).success).toBe(false);
    expect(
      bandwidthPoolSchema.safeParse({
        totalUploadMbps: Number.NaN,
        totalDownloadMbps: 100,
      }).success,
    ).toBe(false);
  });
});

describe("bandwidthRequestSchema (admin, on behalf of a customer)", () => {
  const valid = {
    customerId: 1,
    poolId: 1,
    requestedUploadMbps: 400,
    requestedDownloadMbps: 500,
  };

  it("accepts a valid request", () => {
    expect(bandwidthRequestSchema.safeParse(valid).success).toBe(true);
  });

  it("requires a customer and a pool", () => {
    expect(bandwidthRequestSchema.safeParse({ ...valid, customerId: Number.NaN }).success).toBe(
      false,
    );
    expect(bandwidthRequestSchema.safeParse({ ...valid, poolId: Number.NaN }).success).toBe(
      false,
    );
  });

  it("requires both Mbps values to be greater than zero", () => {
    expect(
      bandwidthRequestSchema.safeParse({ ...valid, requestedUploadMbps: 0 }).success,
    ).toBe(false);
    expect(
      bandwidthRequestSchema.safeParse({ ...valid, requestedDownloadMbps: -5 }).success,
    ).toBe(false);
  });
});

describe("myRequestSchema (customer, own id forced by the API)", () => {
  it("does not require a customerId", () => {
    const result = myRequestSchema.safeParse({
      poolId: 1,
      requestedUploadMbps: 20,
      requestedDownloadMbps: 50,
    });
    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty("customerId");
  });

  it("still requires a pool and positive figures", () => {
    expect(
      myRequestSchema.safeParse({
        poolId: Number.NaN,
        requestedUploadMbps: 20,
        requestedDownloadMbps: 50,
      }).success,
    ).toBe(false);
    expect(
      myRequestSchema.safeParse({
        poolId: 1,
        requestedUploadMbps: 0,
        requestedDownloadMbps: 50,
      }).success,
    ).toBe(false);
  });
});

describe("rejectSchema", () => {
  it("requires a note, which the API mandates on reject", () => {
    expect(rejectSchema.safeParse({ note: "" }).success).toBe(false);
    expect(rejectSchema.safeParse({ note: "   " }).success).toBe(false);
    expect(rejectSchema.safeParse({ note: "duplicate request" }).success).toBe(true);
  });

  it("enforces the API's 500-character cap", () => {
    expect(rejectSchema.safeParse({ note: "a".repeat(500) }).success).toBe(true);
    expect(rejectSchema.safeParse({ note: "a".repeat(501) }).success).toBe(false);
  });
});

describe("fieldErrorsOf", () => {
  it("flattens issues into one message per field, keeping the first", () => {
    const result = customerSchema.safeParse({
      name: "",
      email: "bad",
      phone: "123",
      region: "",
      district: "",
    });
    const errors = fieldErrorsOf(result.error!);
    expect(errors.name).toBeDefined();
    expect(errors.email).toBeDefined();
    expect(errors.phone).toBeDefined();
    expect(Object.values(errors).every((m) => typeof m === "string")).toBe(true);
  });
});
