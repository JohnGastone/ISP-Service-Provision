import type { BandwidthPool, BandwidthRequest, PoolAvailability } from "@/lib/types";

/**
 * Remaining capacity. The backend computes `*RemainingMbps` from approved
 * requests, so those are authoritative; the subtraction is only a fallback for
 * payloads that omit them.
 */
export function availability(pool: BandwidthPool): PoolAvailability {
  const uploadRemaining =
    pool.uploadRemainingMbps ?? pool.totalUploadMbps - pool.uploadAllocatedMbps;
  const downloadRemaining =
    pool.downloadRemainingMbps ?? pool.totalDownloadMbps - pool.downloadAllocatedMbps;

  return {
    uploadRemaining,
    downloadRemaining,
    uploadUsedPct:
      pool.totalUploadMbps > 0 ? (pool.uploadAllocatedMbps / pool.totalUploadMbps) * 100 : 0,
    downloadUsedPct:
      pool.totalDownloadMbps > 0
        ? (pool.downloadAllocatedMbps / pool.totalDownloadMbps) * 100
        : 0,
  };
}

export interface AllocationCheck {
  ok: boolean;
  uploadShortfall: number;
  downloadShortfall: number;
  reasons: string[];
}

/**
 * The approval guard: a request may only be approved when BOTH directions fit
 * within what is left in the pool. The backend enforces this too (422) — this
 * mirrors it so the admin sees the outcome before submitting the decision.
 */
export function checkAllocation(
  pool: BandwidthPool,
  requestedUpload: number,
  requestedDownload: number,
): AllocationCheck {
  const { uploadRemaining, downloadRemaining } = availability(pool);
  const uploadShortfall = Math.max(0, requestedUpload - uploadRemaining);
  const downloadShortfall = Math.max(0, requestedDownload - downloadRemaining);
  const reasons: string[] = [];

  if (uploadShortfall > 0) {
    reasons.push(
      `Upload short by ${formatMbps(uploadShortfall)} — requested ${formatMbps(
        requestedUpload,
      )}, only ${formatMbps(uploadRemaining)} remaining.`,
    );
  }
  if (downloadShortfall > 0) {
    reasons.push(
      `Download short by ${formatMbps(downloadShortfall)} — requested ${formatMbps(
        requestedDownload,
      )}, only ${formatMbps(downloadRemaining)} remaining.`,
    );
  }

  return {
    ok: uploadShortfall === 0 && downloadShortfall === 0,
    uploadShortfall,
    downloadShortfall,
    reasons,
  };
}

export function checkRequest(pool: BandwidthPool, request: BandwidthRequest): AllocationCheck {
  return checkAllocation(pool, request.requestedUploadMbps, request.requestedDownloadMbps);
}

export function formatMbps(value: number): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1000) return `${trim(value / 1000)} Gbps`;
  return `${trim(value)} Mbps`;
}

function trim(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
