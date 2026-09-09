"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select } from "@/components/form";
import { Card, CardHeader, ErrorNotice } from "@/components/ui";
import { ClientApiError, api } from "@/lib/client-api";
import { TZ_REGIONS, districtsFor, formatTzPhone, toE164 } from "@/lib/tz";
import { customerSchema, fieldErrorsOf } from "@/lib/validation";
import type { Customer } from "@/lib/types";

export default function CustomerForm() {
  const router = useRouter();

  const [values, setValues] = useState({
    name: "",
    email: "",
    phone: "",
    region: "",
    district: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [issued, setIssued] = useState<{
    name: string;
    email: string;
    password: string;
  } | null>(null);

  const districts = districtsFor(values.region);

  function update(key: keyof typeof values, value: string) {
    setValues((v) => {
      // Changing region invalidates any district chosen under the old one.
      if (key === "region") return { ...v, region: value, district: "" };
      return { ...v, [key]: value };
    });
    setErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
    setFormError(null);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const parsed = customerSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrorsOf(parsed.error));
      return;
    }

    // The API accepts a nested `location` even though it returns it flattened.
    const payload = {
      name: parsed.data.name,
      email: parsed.data.email,
      phone: toE164(parsed.data.phone),
      location: { region: parsed.data.region, district: parsed.data.district },
    };

    setSubmitting(true);
    try {
      const created = await api<Customer & { generatedPassword?: string }>("/api/customers", {
        method: "POST",
        body: payload,
      });

      // The generated password is returned once and never again — hold the
      // admin on this page so it can be copied and handed over.
      if (created?.generatedPassword) {
        setIssued({
          name: created.name,
          email: created.email,
          password: created.generatedPassword,
        });
        setValues({ name: "", email: "", phone: "", region: "", district: "" });
        setSubmitting(false);
        return;
      }

      router.push(`/admin/customers?created=${encodeURIComponent(created?.name ?? "Customer")}`);
      router.refresh();
    } catch (error) {
      if (error instanceof ClientApiError) {
        setFormError(error.message);
        // A duplicate email is reported in the ProblemDetail text; surface it
        // on the field the admin needs to change.
        if (/email/i.test(error.message) && /exist/i.test(error.message)) {
          setErrors((e) => ({ ...e, email: "A customer with this email already exists" }));
        }
      } else {
        setFormError("Something went wrong. Please try again.");
      }
      setSubmitting(false);
    }
  }

  if (issued) {
    return <CredentialHandoff issued={issued} onDone={() => setIssued(null)} />;
  }

  return (
    <Card>
      <CardHeader
        title="Register a customer"
        subtitle="Name, email, a Tanzanian mobile number and the service location."
      />

      <form onSubmit={onSubmit} noValidate className="space-y-5 px-6 py-5">
        {formError ? <ErrorNotice message={formError} /> : null}

        <Field label="Full name" htmlFor="name" error={errors.name}>
          <Input
            id="name"
            name="name"
            autoComplete="organization"
            placeholder="Asha Juma Mwinyi"
            value={values.name}
            invalid={Boolean(errors.name)}
            onChange={(e) => update("name", e.target.value)}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Email address" htmlFor="email" error={errors.email}>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="ops@acme.co.tz"
              value={values.email}
              invalid={Boolean(errors.email)}
              onChange={(e) => update("email", e.target.value)}
            />
          </Field>

          <Field
            label="Phone number"
            htmlFor="phone"
            error={errors.phone}
            hint={
              values.phone && !errors.phone
                ? `Sent as ${toE164(values.phone)}`
                : "Tanzanian mobile, e.g. 0712345678 or +255712345678"
            }
          >
            <Input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="0712345678"
              value={values.phone}
              invalid={Boolean(errors.phone)}
              onChange={(e) => update("phone", e.target.value)}
            />
          </Field>
        </div>

        <fieldset className="grid gap-5 sm:grid-cols-2">
          <legend className="sr-only">Service location</legend>

          <Field label="Region" htmlFor="region" error={errors.region}>
            <Select
              id="region"
              name="region"
              value={values.region}
              invalid={Boolean(errors.region)}
              onChange={(e) => update("region", e.target.value)}
            >
              <option value="">Select a region…</option>
              {TZ_REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="District"
            htmlFor="district"
            error={errors.district}
            hint={values.region ? undefined : "Choose a region first"}
          >
            <Select
              id="district"
              name="district"
              value={values.district}
              disabled={!values.region}
              invalid={Boolean(errors.district)}
              onChange={(e) => update("district", e.target.value)}
            >
              <option value="">
                {values.region ? "Select a district…" : "Select a region first"}
              </option>
              {districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          </Field>
        </fieldset>

        <div className="flex items-center gap-3 border-t border-slate-100 pt-5">
          <Button type="submit" loading={submitting}>
            Register customer
          </Button>
          <Button type="button" variant="secondary" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}

/**
 * One-time display of the sign-in credentials the API generated. The password
 * is not retrievable afterwards, so this deliberately blocks the flow until the
 * admin confirms they have copied it.
 */
function CredentialHandoff({
  issued,
  onDone,
}: {
  issued: { name: string; email: string; password: string };
  onDone: () => void;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(
        `Email: ${issued.email}\nPassword: ${issued.password}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard can be blocked; the values stay visible for manual copying.
      setCopied(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title={`${issued.name} registered`}
        subtitle="Share these sign-in details with the customer now."
      />
      <div className="space-y-5 px-6 py-5">
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong className="font-semibold">This password is shown only once.</strong> It cannot
          be retrieved later — copy it before leaving this page.
        </div>

        <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <dt className="text-sm font-semibold text-slate-500">Email</dt>
            <dd className="font-mono text-sm text-slate-900">{issued.email}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <dt className="text-sm font-semibold text-slate-500">Password</dt>
            <dd className="select-all font-mono text-sm font-semibold text-slate-900">
              {issued.password}
            </dd>
          </div>
        </dl>

        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="secondary" onClick={copy}>
            {copied ? "Copied" : "Copy credentials"}
          </Button>
          <Button type="button" onClick={onDone}>
            Register another
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              router.push("/admin/customers");
              router.refresh();
            }}
          >
            Done
          </Button>
        </div>
      </div>
    </Card>
  );
}

/** Kept for the details view, which renders the flattened response shape. */
export function formatCustomerPhone(phone: string): string {
  return formatTzPhone(phone);
}
