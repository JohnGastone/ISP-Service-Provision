"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select } from "@/components/form";
import { Card, CardHeader, ErrorNotice } from "@/components/ui";
import { ClientApiError, api } from "@/lib/client-api";
import { availability, formatMbps } from "@/lib/bandwidth";
import { fieldErrorsOf, myRequestSchema } from "@/lib/validation";
import type { BandwidthPool } from "@/lib/types";

export default function MyRequestForm({
  pools,
  hasPending,
}: {
  pools: BandwidthPool[];
  hasPending: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState({
    poolId: pools.length === 1 ? String(pools[0].id) : "",
    requestedDownloadMbps: "",
    requestedUploadMbps: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function update(key: keyof typeof values, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
    setSuccess(false);
    setFormError(null);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    setSuccess(false);

    const parsed = myRequestSchema.safeParse({
      poolId: values.poolId ? Number(values.poolId) : Number.NaN,
      requestedDownloadMbps: toNumber(values.requestedDownloadMbps),
      requestedUploadMbps: toNumber(values.requestedUploadMbps),
    });

    if (!parsed.success) {
      setErrors(fieldErrorsOf(parsed.error));
      return;
    }

    setSubmitting(true);
    try {
      await api("/api/bandwidth/requests", { method: "POST", body: parsed.data });
      setValues((v) => ({ ...v, requestedDownloadMbps: "", requestedUploadMbps: "" }));
      setSuccess(true);
      router.refresh();
    } catch (error) {
      setFormError(
        error instanceof ClientApiError ? error.message : "Could not submit your request.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="sticky top-24">
      <CardHeader
        title="New request"
        subtitle="The administrator reviews available capacity before approving."
      />
      <form onSubmit={onSubmit} noValidate className="space-y-5 px-6 py-5">
        {formError ? <ErrorNotice message={formError} /> : null}

        {success ? (
          <div
            role="status"
            className="rounded-xl border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-800"
          >
            Request submitted. You will see the decision in your history.
          </div>
        ) : null}

        {hasPending ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            You already have a request awaiting a decision.
          </div>
        ) : null}

        {/* Customers cannot list pools, so fall back to entering the id. */}
        {pools.length > 0 ? (
          <Field label="Service pool" htmlFor="poolId" error={errors.poolId}>
            <Select
              id="poolId"
              value={values.poolId}
              invalid={Boolean(errors.poolId)}
              onChange={(e) => update("poolId", e.target.value)}
            >
              <option value="">Select a pool…</option>
              {pools.map((p) => {
                const a = availability(p);
                return (
                  <option key={p.id} value={p.id}>
                    Pool #{p.id} — {formatMbps(a.downloadRemaining)} ↓ /{" "}
                    {formatMbps(a.uploadRemaining)} ↑ free
                  </option>
                );
              })}
            </Select>
          </Field>
        ) : (
          <Field
            label="Service pool"
            htmlFor="poolId"
            error={errors.poolId}
            hint="The pool number given to you by the ISP"
          >
            <Input
              id="poolId"
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              placeholder="1"
              value={values.poolId}
              invalid={Boolean(errors.poolId)}
              onChange={(e) => update("poolId", e.target.value)}
            />
          </Field>
        )}

        <Field
          label="Download (Mbps)"
          htmlFor="requestedDownloadMbps"
          error={errors.requestedDownloadMbps}
        >
          <Input
            id="requestedDownloadMbps"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            placeholder="50"
            value={values.requestedDownloadMbps}
            invalid={Boolean(errors.requestedDownloadMbps)}
            onChange={(e) => update("requestedDownloadMbps", e.target.value)}
          />
        </Field>

        <Field
          label="Upload (Mbps)"
          htmlFor="requestedUploadMbps"
          error={errors.requestedUploadMbps}
        >
          <Input
            id="requestedUploadMbps"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            placeholder="20"
            value={values.requestedUploadMbps}
            invalid={Boolean(errors.requestedUploadMbps)}
            onChange={(e) => update("requestedUploadMbps", e.target.value)}
          />
        </Field>

        <Button type="submit" loading={submitting} className="w-full">
          Submit request
        </Button>
      </form>
    </Card>
  );
}

function toNumber(raw: string): number | undefined {
  if (raw.trim() === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : Number.NaN;
}
