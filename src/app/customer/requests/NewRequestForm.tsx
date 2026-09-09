"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select } from "@/components/form";
import { Card, CardHeader, ErrorNotice } from "@/components/ui";
import { ClientApiError, api } from "@/lib/client-api";
import { fieldErrorsOf, serviceRequestSchema } from "@/lib/validation";
import type { BandwidthPool } from "@/lib/types";

export default function NewRequestForm({
  pools,
  hasPending,
}: {
  pools: BandwidthPool[];
  hasPending: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState({
    poolId: pools.length === 1 ? String(pools[0].id) : "",
    requestedDownload: "",
    requestedUpload: "",
    note: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function update(key: keyof typeof values, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
    setSuccess(false);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    setSuccess(false);

    const parsed = serviceRequestSchema.safeParse({
      poolId: values.poolId ? Number(values.poolId) : Number.NaN,
      requestedDownload: toNumber(values.requestedDownload),
      requestedUpload: toNumber(values.requestedUpload),
      note: values.note.trim() || undefined,
    });

    if (!parsed.success) {
      setErrors(fieldErrorsOf(parsed.error));
      return;
    }

    setSubmitting(true);
    try {
      await api("/api/service-requests", { method: "POST", body: parsed.data });
      setValues((v) => ({ ...v, requestedDownload: "", requestedUpload: "", note: "" }));
      setSuccess(true);
      router.refresh();
    } catch (error) {
      if (error instanceof ClientApiError) {
        setFormError(error.message);
        if (error.fieldErrors) setErrors(error.fieldErrors);
      } else {
        setFormError("Could not submit your request. Please try again.");
      }
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

        {pools.length > 1 ? (
          <Field label="Service pool" htmlFor="poolId" error={errors.poolId}>
            <Select
              id="poolId"
              value={values.poolId}
              invalid={Boolean(errors.poolId)}
              onChange={(e) => update("poolId", e.target.value)}
            >
              <option value="">Select a pool…</option>
              {pools.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name ?? `Pool #${p.id}`}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <Field
            label="Service pool"
            htmlFor="poolId"
            error={errors.poolId}
            hint={pools.length === 1 ? pools[0].name ?? `Pool #${pools[0].id}` : undefined}
          >
            <Input
              id="poolId"
              type="number"
              min="1"
              step="1"
              placeholder="1"
              value={values.poolId}
              invalid={Boolean(errors.poolId)}
              readOnly={pools.length === 1}
              onChange={(e) => update("poolId", e.target.value)}
            />
          </Field>
        )}

        <Field
          label="Download (Mbps)"
          htmlFor="requestedDownload"
          error={errors.requestedDownload}
        >
          <Input
            id="requestedDownload"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            placeholder="50"
            value={values.requestedDownload}
            invalid={Boolean(errors.requestedDownload)}
            onChange={(e) => update("requestedDownload", e.target.value)}
          />
        </Field>

        <Field label="Upload (Mbps)" htmlFor="requestedUpload" error={errors.requestedUpload}>
          <Input
            id="requestedUpload"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            placeholder="20"
            value={values.requestedUpload}
            invalid={Boolean(errors.requestedUpload)}
            onChange={(e) => update("requestedUpload", e.target.value)}
          />
        </Field>

        <Field label="Note" htmlFor="note" error={errors.note} hint="Optional — why you need this">
          <Input
            id="note"
            placeholder="Adding two more workstations"
            value={values.note}
            invalid={Boolean(errors.note)}
            onChange={(e) => update("note", e.target.value)}
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
