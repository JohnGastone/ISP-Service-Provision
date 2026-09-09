"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/form";
import { Card, ErrorNotice, StatusBadge, cn } from "@/components/ui";
import { ClientApiError, api } from "@/lib/client-api";
import { availability, checkRequest, formatDate, formatMbps } from "@/lib/bandwidth";
import { formatTzPhone } from "@/lib/tz";
import { rejectSchema } from "@/lib/validation";
import type { BandwidthPool, BandwidthRequest, Customer } from "@/lib/types";

export default function RequestRow({
  request,
  pool,
  customer,
}: {
  request: BandwidthRequest;
  pool: BandwidthPool | null;
  customer: Customer | null;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [showReject, setShowReject] = useState(false);
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pending = request.status === "PENDING";
  const check = pool ? checkRequest(pool, request) : null;
  const free = pool ? availability(pool) : null;
  // Without the pool we cannot verify capacity, so approval stays blocked.
  const canApprove = pending && Boolean(check?.ok);

  async function approve() {
    setError(null);
    setBusy("approve");
    try {
      await api(`/api/bandwidth/requests/${request.id}/approve`, {
        method: "POST",
        body: note.trim() ? { note: note.trim() } : {},
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Could not approve this request.");
      setBusy(null);
    }
  }

  async function reject() {
    setError(null);
    setNoteError(null);

    // The reject endpoint requires a note of at most 500 characters.
    const parsed = rejectSchema.safeParse({ note });
    if (!parsed.success) {
      setNoteError(parsed.error.issues[0]?.message ?? "A reason is required");
      return;
    }

    setBusy("reject");
    try {
      await api(`/api/bandwidth/requests/${request.id}/reject`, {
        method: "POST",
        body: { note: parsed.data.note },
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Could not reject this request.");
      setBusy(null);
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-base font-semibold text-slate-900">
              {customer?.name ?? `Customer #${request.customerId}`}
            </h3>
            <StatusBadge status={request.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {customer ? (
              <>
                {customer.email} · {formatTzPhone(customer.phone)} · {customer.district},{" "}
                {customer.region}
              </>
            ) : (
              "Customer details unavailable"
            )}
          </p>
        </div>
        <div className="text-right text-sm text-slate-500">
          <p>Request #{request.id}</p>
          <p>{formatDate(request.requestedAt)}</p>
        </div>
      </div>

      <div className="grid gap-5 px-6 py-5 sm:grid-cols-3">
        <Figure label="Requested download" value={formatMbps(request.requestedDownloadMbps)} />
        <Figure label="Requested upload" value={formatMbps(request.requestedUploadMbps)} />
        <Figure
          label="Pool"
          value={pool ? `#${pool.id}` : `#${request.poolId} (not found)`}
          hint={
            free
              ? `${formatMbps(free.downloadRemaining)} ↓ · ${formatMbps(
                  free.uploadRemaining,
                )} ↑ remaining`
              : "Capacity unknown"
          }
        />
      </div>

      {pending ? (
        <div className="border-t border-slate-100 px-6 py-4">
          {/* The capacity verdict, shown before the admin commits to a decision. */}
          <div
            className={cn(
              "rounded-xl px-4 py-3 text-sm",
              !pool
                ? "bg-slate-50 text-slate-700"
                : check?.ok
                  ? "bg-accent-50 text-accent-800"
                  : "bg-red-50 text-red-800",
            )}
          >
            {!pool ? (
              <p>
                Pool #{request.poolId} could not be loaded, so remaining capacity cannot be
                verified. Approval is disabled.
              </p>
            ) : check?.ok ? (
              <p>
                <strong className="font-semibold">Sufficient capacity.</strong> After approval:{" "}
                {formatMbps(free!.downloadRemaining - request.requestedDownloadMbps)} ↓ ·{" "}
                {formatMbps(free!.uploadRemaining - request.requestedUploadMbps)} ↑ would remain.
              </p>
            ) : (
              <div>
                <p className="font-semibold">Insufficient capacity — cannot approve.</p>
                <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
                  {check!.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
                <p className="mt-1.5">Raise the pool total, or reject the request.</p>
              </div>
            )}
          </div>

          {error ? (
            <div className="mt-4">
              <ErrorNotice message={error} />
            </div>
          ) : null}

          <div className="mt-4">
            <label
              htmlFor={`note-${request.id}`}
              className="block text-sm font-semibold text-slate-700"
            >
              {showReject ? "Reason for rejection" : "Decision note"}
              {showReject ? null : <span className="font-normal text-slate-400"> (optional)</span>}
            </label>
            <Input
              id={`note-${request.id}`}
              className="mt-1.5"
              maxLength={500}
              placeholder={showReject ? "e.g. duplicate request" : "e.g. approved for Q3"}
              value={note}
              invalid={Boolean(noteError)}
              onChange={(e) => {
                setNote(e.target.value);
                setNoteError(null);
              }}
            />
            {noteError ? <p className="mt-1.5 text-sm text-red-600">{noteError}</p> : null}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              type="button"
              onClick={approve}
              loading={busy === "approve"}
              disabled={!canApprove || busy !== null}
              title={canApprove ? undefined : "Not enough remaining bandwidth in the pool"}
            >
              Approve
            </Button>

            {showReject ? (
              <>
                <Button
                  type="button"
                  variant="danger"
                  onClick={reject}
                  loading={busy === "reject"}
                  disabled={busy !== null}
                >
                  Confirm rejection
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setShowReject(false);
                    setNoteError(null);
                  }}
                  disabled={busy !== null}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowReject(true)}
                disabled={busy !== null}
              >
                Reject
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="border-t border-slate-100 bg-slate-50/70 px-6 py-3 text-sm text-slate-600">
          Decided {formatDate(request.decidedAt)}
          {request.decisionNote ? ` — ${request.decisionNote}` : ""}
        </div>
      )}
    </Card>
  );
}

function Figure({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1.5 text-lg font-bold tabular-nums text-slate-900">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}
