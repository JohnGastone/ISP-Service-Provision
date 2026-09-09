"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input } from "@/components/form";
import { Card, CardHeader, ErrorNotice } from "@/components/ui";
import { ClientApiError, api } from "@/lib/client-api";
import { formatMbps } from "@/lib/bandwidth";
import { bandwidthPoolSchema, fieldErrorsOf } from "@/lib/validation";
import type { BandwidthPool } from "@/lib/types";

type Props =
  | { mode: "create"; pool?: undefined }
  | { mode: "top-up"; pool: BandwidthPool };

export default function PoolManager(props: Props) {
  return props.mode === "create" ? <CreatePool /> : <TopUpPool pool={props.pool} />;
}

function CreatePool() {
  const router = useRouter();
  const [values, setValues] = useState({ name: "", totalDownload: "", totalUpload: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update(key: keyof typeof values, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const parsed = bandwidthPoolSchema.safeParse({
      name: values.name.trim() || undefined,
      totalDownload: toNumber(values.totalDownload),
      totalUpload: toNumber(values.totalUpload),
    });

    if (!parsed.success) {
      setErrors(fieldErrorsOf(parsed.error));
      return;
    }

    setSubmitting(true);
    try {
      await api("/api/bandwidth-pools", { method: "POST", body: parsed.data });
      setValues({ name: "", totalDownload: "", totalUpload: "" });
      router.refresh();
    } catch (error) {
      setFormError(error instanceof ClientApiError ? error.message : "Could not create the pool.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="sticky top-24">
      <CardHeader title="Create a pool" subtitle="Capacity the ISP has purchased upstream" />
      <form onSubmit={onSubmit} noValidate className="space-y-5 px-6 py-5">
        {formError ? <ErrorNotice message={formError} /> : null}

        <Field label="Pool name" htmlFor="pool-name" error={errors.name} hint="Optional, e.g. Dar Metro Fibre">
          <Input
            id="pool-name"
            value={values.name}
            invalid={Boolean(errors.name)}
            placeholder="Dar Metro Fibre"
            onChange={(e) => update("name", e.target.value)}
          />
        </Field>

        <Field label="Total download (Mbps)" htmlFor="total-download" error={errors.totalDownload}>
          <Input
            id="total-download"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            placeholder="10000"
            value={values.totalDownload}
            invalid={Boolean(errors.totalDownload)}
            onChange={(e) => update("totalDownload", e.target.value)}
          />
        </Field>

        <Field label="Total upload (Mbps)" htmlFor="total-upload" error={errors.totalUpload}>
          <Input
            id="total-upload"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            placeholder="5000"
            value={values.totalUpload}
            invalid={Boolean(errors.totalUpload)}
            onChange={(e) => update("totalUpload", e.target.value)}
          />
        </Field>

        <Button type="submit" loading={submitting} className="w-full">
          Create pool
        </Button>
      </form>
    </Card>
  );
}

function TopUpPool({ pool }: { pool: BandwidthPool }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [addDownload, setAddDownload] = useState("");
  const [addUpload, setAddUpload] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const down = toNumber(addDownload) ?? 0;
    const up = toNumber(addUpload) ?? 0;

    if (down <= 0 && up <= 0) {
      setFormError("Enter an amount to add to at least one direction.");
      return;
    }
    if (down < 0 || up < 0) {
      setFormError("Top-up amounts cannot be negative.");
      return;
    }

    setSubmitting(true);
    try {
      await api(`/api/bandwidth-pools/${pool.id}/top-up`, {
        method: "POST",
        body: { addUpload: up, addDownload: down },
      });
      setAddDownload("");
      setAddUpload("");
      setOpen(false);
      router.refresh();
    } catch (error) {
      setFormError(error instanceof ClientApiError ? error.message : "Could not top up the pool.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <div className="border-t border-slate-200 pt-4">
        <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
          Add capacity
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4 border-t border-slate-200 pt-4">
      {formError ? <ErrorNotice message={formError} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Add download (Mbps)"
          htmlFor={`add-download-${pool.id}`}
          hint={`Currently ${formatMbps(pool.totalDownload)}`}
        >
          <Input
            id={`add-download-${pool.id}`}
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            placeholder="0"
            value={addDownload}
            onChange={(e) => setAddDownload(e.target.value)}
          />
        </Field>

        <Field
          label="Add upload (Mbps)"
          htmlFor={`add-upload-${pool.id}`}
          hint={`Currently ${formatMbps(pool.totalUpload)}`}
        >
          <Input
            id={`add-upload-${pool.id}`}
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            placeholder="0"
            value={addUpload}
            onChange={(e) => setAddUpload(e.target.value)}
          />
        </Field>
      </div>

      <div className="flex gap-3">
        <Button type="submit" loading={submitting}>
          Add capacity
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setOpen(false);
            setFormError(null);
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** "" → undefined so the schema reports "required" rather than "must be a number". */
function toNumber(raw: string): number | undefined {
  if (raw.trim() === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : Number.NaN;
}
