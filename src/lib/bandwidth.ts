import type { BandwidthPool, PoolAvailability, ServiceRequest } from "@/lib/types";

/**
 * Remaining capacity in a pool. `total*` is what the admin funded the pool with,
 * `*Allocated` is what approved requests already hold.
 */
export function availability(pool: BandwidthPool): PoolAvailability {
  const uploadRemaining = pool.totalUpload - pool.uploadAllocated;
  const downloadRemaining = pool.totalDownload - pool.downloadAllocated;
  return {
    uploadRemaining,
    downloadRemaining,
    uploadUsedPct: pool.totalUpload > 0 ? (pool.uploadAllocated / pool.totalUpload) * 100 : 0,
    downloadUsedPct:
      pool.totalDownload > 0 ? (pool.downloadAllocated / pool.totalDownload) * 100 : 0,
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
 * within what is left in the pool. The backend must enforce this too — this
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
      )}, only ${formatMbps(uploadRemaining)} left.`,
    );
  }
  if (downloadShortfall > 0) {
    reasons.push(
      `Download short by ${formatMbps(downloadShortfall)} — requested ${formatMbps(
        requestedDownload,
      )}, only ${formatMbps(downloadRemaining)} left.`,
    );
  }

  return {
    ok: uploadShortfall === 0 && downloadShortfall === 0,
    uploadShortfall,
    downloadShortfall,
    reasons,
  };
}

export function checkRequest(pool: BandwidthPool, request: ServiceRequest): AllocationCheck {
  return checkAllocation(pool, request.requestedUpload, request.requestedDownload);
}

/** Pool state if every listed request were approved — used on the queue screen. */
export function projectedAfter(
  pool: BandwidthPool,
  requests: ServiceRequest[],
): BandwidthPool {
  return requests.reduce<BandwidthPool>(
    (acc, r) => ({
      ...acc,
      uploadAllocated: acc.uploadAllocated + r.requestedUpload,
      downloadAllocated: acc.downloadAllocated + r.requestedDownload,
    }),
    pool,
  );
}

export function formatMbps(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1000) {
    const gbps = value / 1000;
    return `${trim(gbps)} Gbps`;
  }
  return `${trim(value)} Mbps`;
}

function trim(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

export function formatDate(value?: string): string {
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
