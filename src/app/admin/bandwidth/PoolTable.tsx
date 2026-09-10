"use client";

import { Fragment, useState } from "react";
import { Button } from "@/components/form";
import { CapacityMeter, Card, CardHeader, EmptyState, Td, Th, cn } from "@/components/ui";
import { availability, formatMbps } from "@/lib/bandwidth";
import { PoolTotalsForm } from "./PoolManager";
import type { BandwidthPool } from "@/lib/types";

/**
 * Compact list of pools. One row each, with the adjust form expanding inline so
 * the page stays short however many pools exist.
 */
export default function PoolTable({
  pools,
  allocationsByPool,
}: {
  pools: BandwidthPool[];
  allocationsByPool: Record<number, number>;
}) {
  const [editing, setEditing] = useState<number | null>(null);

  return (
    <Card>
      <CardHeader
        title="Pools"
        subtitle={`${pools.length} ${pools.length === 1 ? "pool" : "pools"} funded`}
      />

      {pools.length === 0 ? (
        <EmptyState
          title="No pools created yet"
          description="Create a pool using the form to start allocating bandwidth."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50/80">
              <tr>
                <Th>Pool</Th>
                <Th>Download</Th>
                <Th>Upload</Th>
                <Th className="text-right">Allocations</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pools.map((pool) => {
                const a = availability(pool);
                const open = editing === pool.id;
                const approved = allocationsByPool[pool.id] ?? 0;

                return (
                  <Fragment key={pool.id}>
                    <tr className={cn(open && "bg-slate-50/60")}>
                      <Td className="font-semibold text-slate-900">#{pool.id}</Td>
                      <Td>
                        <CapacityMeter
                          usedPct={a.downloadUsedPct}
                          remaining={a.downloadRemaining}
                          total={pool.totalDownloadMbps}
                        />
                      </Td>
                      <Td>
                        <CapacityMeter
                          usedPct={a.uploadUsedPct}
                          remaining={a.uploadRemaining}
                          total={pool.totalUploadMbps}
                        />
                      </Td>
                      <Td className="text-right tabular-nums text-slate-500">{approved}</Td>
                      <Td className="text-right">
                        <button
                          type="button"
                          onClick={() => setEditing(open ? null : pool.id)}
                          aria-expanded={open}
                          className="rounded-lg px-2.5 py-1.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50"
                        >
                          {open ? "Close" : "Adjust"}
                        </button>
                      </Td>
                    </tr>

                    {open ? (
                      <tr className="bg-slate-50/60">
                        <td colSpan={5} className="px-6 pb-5 pt-1">
                          <div className="max-w-2xl">
                            <PoolTotalsForm pool={pool} onCancel={() => setEditing(null)} />
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
