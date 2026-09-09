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
import NewRequestForm from "./NewRequestForm";
import type { BandwidthPool, ServiceRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CustomerRequestsPage() {
  const [requests, pools] = await Promise.all([
    safeLoad<ServiceRequest[]>(listMyRequests, []),
    // Customers may not be permitted to list pools; the form copes with an empty list.
    safeLoad<BandwidthPool[]>(listPools, []),
  ]);

  const hasPending = requests.data.some((r) => r.status === "PENDING");

  return (
    <>
      <PageHeading
        title="My requests"
        subtitle="Ask for a new bandwidth allocation and track the decision."
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
                  <thead className="bg-slate-50">
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
                        <Td className="text-slate-500">{formatDate(r.createdAt)}</Td>
                        <Td className="tabular-nums">
                          {formatMbps(r.requestedDownload)} ↓
                          <br />
                          <span className="text-slate-500">{formatMbps(r.requestedUpload)} ↑</span>
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
          <NewRequestForm pools={pools.data} hasPending={hasPending} />
        </div>
      </div>
    </>
  );
}
