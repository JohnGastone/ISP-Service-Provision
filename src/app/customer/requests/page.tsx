import { listMyRequests, listPools } from "@/lib/api";
import { safeLoad } from "@/lib/safe";
import { formatDate, formatMbps } from "@/lib/bandwidth";
import {
  Card,
  CardHeader,
  EmptyState,
  ErrorNotice,
  PageHeading,
  StatusBadge,
  Td,
  Th,
} from "@/components/ui";
import MyRequestForm from "./MyRequestForm";
import type { BandwidthPool, BandwidthRequest } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "My requests" };

export default async function CustomerRequestsPage() {
  const [requests, pools] = await Promise.all([
    safeLoad<BandwidthRequest[]>(listMyRequests, []),
    // Listing pools is admin-only, so this is expected to fail for customers —
    // the form falls back to a plain pool-id field.
    safeLoad<BandwidthPool[]>(listPools, []),
  ]);

  const hasPending = requests.data.some((r) => r.status === "PENDING");

  return (
    <>
      <PageHeading
        title="My requests"
        subtitle="Ask for a bandwidth allocation and track the decision."
      />

      {requests.error ? (
        <div className="mb-6">
          <ErrorNotice message={requests.error} />
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader title="Request history" subtitle="Newest first" />
            {requests.data.length === 0 ? (
              <EmptyState
                title="No requests yet"
                description="Use the form to submit your first bandwidth request."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50/80">
                    <tr>
                      <Th>Submitted</Th>
                      <Th>Requested</Th>
                      <Th>Status</Th>
                      <Th>Decided</Th>
                      <Th>Note</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {requests.data.map((r) => (
                      <tr key={r.id}>
                        <Td className="text-slate-500">{formatDate(r.requestedAt)}</Td>
                        <Td className="tabular-nums">
                          {formatMbps(r.requestedDownloadMbps)} ↓
                          <br />
                          <span className="text-slate-500">
                            {formatMbps(r.requestedUploadMbps)} ↑
                          </span>
                        </Td>
                        <Td>
                          <StatusBadge status={r.status} />
                        </Td>
                        <Td className="text-slate-500">{formatDate(r.decidedAt)}</Td>
                        <Td className="text-slate-500">{r.decisionNote ?? "—"}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="lg:col-span-1">
          <MyRequestForm pools={pools.data} hasPending={hasPending} />
        </div>
      </div>
    </>
  );
}
