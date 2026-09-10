import { listPools, listRequests } from "@/lib/api";
import { safeLoad } from "@/lib/safe";
import { availability, formatMbps } from "@/lib/bandwidth";
import { ErrorNotice, PageHeading, StatCard } from "@/components/ui";
import { CreatePool } from "./PoolManager";
import PoolTable from "./PoolTable";
import type { BandwidthPool, BandwidthRequest } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bandwidth pools" };

export default async function BandwidthPage() {
  const [pools, requests] = await Promise.all([
    safeLoad<BandwidthPool[]>(listPools, []),
    safeLoad<BandwidthRequest[]>(listRequests, []),
  ]);

  const totals = pools.data.reduce(
    (acc, p) => {
      const a = availability(p);
      return {
        upload: acc.upload + p.totalUploadMbps,
        download: acc.download + p.totalDownloadMbps,
        uploadFree: acc.uploadFree + a.uploadRemaining,
        downloadFree: acc.downloadFree + a.downloadRemaining,
      };
    },
    { upload: 0, download: 0, uploadFree: 0, downloadFree: 0 },
  );

  // How many approved allocations each pool currently carries.
  const allocationsByPool: Record<number, number> = {};
  for (const r of requests.data) {
    if (r.status === "APPROVED") {
      allocationsByPool[r.poolId] = (allocationsByPool[r.poolId] ?? 0) + 1;
    }
  }

  return (
    <>
      <PageHeading
        title="Bandwidth pools"
        subtitle="Fund pools with total capacity. Approved requests draw down what remains."
      />

      {pools.error ? (
        <div className="mb-6">
          <ErrorNotice message={pools.error} />
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total download" value={formatMbps(totals.download)} hint="Funded capacity" />
        <StatCard
          label="Download remaining"
          value={formatMbps(totals.downloadFree)}
          tone={totals.downloadFree <= 0 ? "danger" : "positive"}
          hint="Unallocated"
        />
        <StatCard label="Total upload" value={formatMbps(totals.upload)} hint="Funded capacity" />
        <StatCard
          label="Upload remaining"
          value={formatMbps(totals.uploadFree)}
          tone={totals.uploadFree <= 0 ? "danger" : "positive"}
          hint="Unallocated"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PoolTable pools={pools.data} allocationsByPool={allocationsByPool} />
        </div>

        <div className="lg:col-span-1">
          <CreatePool />
        </div>
      </div>
    </>
  );
}
