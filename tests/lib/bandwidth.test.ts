import { describe, expect, it } from "vitest";
import {
  availability,
  checkAllocation,
  checkRequest,
  formatDate,
  formatMbps,
} from "@/lib/bandwidth";
import type { BandwidthPool, BandwidthRequest } from "@/lib/types";

function pool(overrides: Partial<BandwidthPool> = {}): BandwidthPool {
  return {
    id: 1,
    totalUploadMbps: 1000,
    totalDownloadMbps: 1000,
    uploadAllocatedMbps: 900,
    downloadAllocatedMbps: 900,
    uploadRemainingMbps: 100,
    downloadRemainingMbps: 100,
    ...overrides,
  };
}

describe("availability", () => {
  it("trusts the backend's computed remaining figures", () => {
    // Deliberately inconsistent: remaining must win over the subtraction.
    const a = availability(pool({ uploadRemainingMbps: 42, downloadRemainingMbps: 7 }));
    expect(a.uploadRemaining).toBe(42);
    expect(a.downloadRemaining).toBe(7);
  });

  it("falls back to total minus allocated when remaining is absent", () => {
    const p = pool();
    delete (p as Partial<BandwidthPool>).uploadRemainingMbps;
    delete (p as Partial<BandwidthPool>).downloadRemainingMbps;

    const a = availability(p);
    expect(a.uploadRemaining).toBe(100);
    expect(a.downloadRemaining).toBe(100);
  });

  it("computes utilisation percentages", () => {
    const a = availability(pool());
    expect(a.uploadUsedPct).toBeCloseTo(90);
    expect(a.downloadUsedPct).toBeCloseTo(90);
  });

  it("reports zero utilisation for an unfunded pool rather than dividing by zero", () => {
    const a = availability(
      pool({
        totalUploadMbps: 0,
        totalDownloadMbps: 0,
        uploadAllocatedMbps: 0,
        downloadAllocatedMbps: 0,
        uploadRemainingMbps: 0,
        downloadRemainingMbps: 0,
      }),
    );
    expect(a.uploadUsedPct).toBe(0);
    expect(a.downloadUsedPct).toBe(0);
    expect(Number.isNaN(a.uploadUsedPct)).toBe(false);
  });
});

describe("checkAllocation — the approval guard", () => {
  it("approves when both directions fit", () => {
    const result = checkAllocation(pool(), 100, 100);
    expect(result.ok).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it("allows a request that exactly consumes the remainder", () => {
    expect(checkAllocation(pool(), 100, 100).ok).toBe(true);
  });

  it("blocks when upload alone exceeds capacity", () => {
    const result = checkAllocation(pool(), 101, 50);
    expect(result.ok).toBe(false);
    expect(result.uploadShortfall).toBe(1);
    expect(result.downloadShortfall).toBe(0);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons[0]).toContain("Upload short by 1 Mbps");
  });

  it("blocks when download alone exceeds capacity", () => {
    const result = checkAllocation(pool(), 50, 101);
    expect(result.ok).toBe(false);
    expect(result.downloadShortfall).toBe(1);
    expect(result.reasons[0]).toContain("Download short by 1 Mbps");
  });

  it("reports both shortfalls with exact figures", () => {
    // Mirrors the real scenario: 400/500 requested against 100/100 remaining.
    const result = checkAllocation(pool(), 400, 500);
    expect(result.ok).toBe(false);
    expect(result.uploadShortfall).toBe(300);
    expect(result.downloadShortfall).toBe(400);
    expect(result.reasons).toHaveLength(2);
    expect(result.reasons.join(" ")).toContain("Upload short by 300 Mbps");
    expect(result.reasons.join(" ")).toContain("Download short by 400 Mbps");
  });

  it("never reports a negative shortfall", () => {
    const result = checkAllocation(pool(), 1, 1);
    expect(result.uploadShortfall).toBe(0);
    expect(result.downloadShortfall).toBe(0);
  });

  it("blocks everything once a pool is fully allocated", () => {
    const full = pool({ uploadRemainingMbps: 0, downloadRemainingMbps: 0 });
    expect(checkAllocation(full, 1, 1).ok).toBe(false);
  });
});

describe("checkRequest", () => {
  it("maps the request's Mbps fields onto the allocation check", () => {
    const request: BandwidthRequest = {
      id: 11,
      customerId: 2,
      poolId: 1,
      requestedUploadMbps: 400,
      requestedDownloadMbps: 500,
      status: "PENDING",
      requestedAt: "2026-09-02T08:00:00Z",
      decidedAt: null,
      decisionNote: null,
    };

    const result = checkRequest(pool(), request);
    expect(result.ok).toBe(false);
    expect(result.uploadShortfall).toBe(300);
    expect(result.downloadShortfall).toBe(400);
  });
});

describe("formatMbps", () => {
  it.each([
    [0, "0 Mbps"],
    [50, "50 Mbps"],
    [999, "999 Mbps"],
    [1000, "1 Gbps"],
    [1500, "1.5 Gbps"],
    [10000, "10 Gbps"],
  ])("formats %s as %s", (input, expected) => {
    expect(formatMbps(input)).toBe(expected);
  });

  it("trims trailing zeros on fractional values", () => {
    expect(formatMbps(2.5)).toBe("2.5 Mbps");
    expect(formatMbps(2.0)).toBe("2 Mbps");
  });

  it("renders a dash for values that are not finite", () => {
    expect(formatMbps(Number.NaN)).toBe("—");
    expect(formatMbps(Number.POSITIVE_INFINITY)).toBe("—");
  });
});

describe("formatDate", () => {
  it("renders a dash for missing values", () => {
    expect(formatDate(undefined)).toBe("—");
    expect(formatDate(null)).toBe("—");
  });

  it("returns the raw string when it is not a parsable date", () => {
    expect(formatDate("not-a-date")).toBe("not-a-date");
  });

  it("formats an ISO timestamp", () => {
    const formatted = formatDate("2026-09-01T08:00:00Z");
    expect(formatted).toMatch(/2026/);
    expect(formatted).not.toBe("—");
  });
});
