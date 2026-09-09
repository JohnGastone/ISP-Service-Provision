"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Field, Input } from "@/components/form";
import { ErrorNotice } from "@/components/ui";
import { ClientApiError, local } from "@/lib/client-api";
import { fieldErrorsOf, loginSchema } from "@/lib/validation";
import { homeFor } from "@/lib/session-shared";
import type { AuthUser } from "@/lib/types";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next");

  const [values, setValues] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update(key: "email" | "password", value: string) {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const parsed = loginSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrorsOf(parsed.error));
      return;
    }

    setSubmitting(true);
    try {
      const { user } = await local<{ user: AuthUser }>("/api/auth/login", {
        method: "POST",
        body: parsed.data,
      });

      // Only honour an internal redirect target, never an absolute URL.
      const target =
        nextUrl && nextUrl.startsWith("/") && !nextUrl.startsWith("//")
          ? nextUrl
          : homeFor(user.role);

      router.replace(target);
      router.refresh();
    } catch (error) {
      if (error instanceof ClientApiError) {
        setFormError(error.message);
        if (error.fieldErrors) setErrors(error.fieldErrors);
      } else {
        setFormError("Something went wrong. Please try again.");
      }
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {formError ? <ErrorNotice message={formError} /> : null}

      <Field label="Email address" htmlFor="email" error={errors.email}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          placeholder="you@example.com"
          value={values.email}
          invalid={Boolean(errors.email)}
          onChange={(e) => update("email", e.target.value)}
        />
      </Field>

      <Field label="Password" htmlFor="password" error={errors.password}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={values.password}
          invalid={Boolean(errors.password)}
          onChange={(e) => update("password", e.target.value)}
        />
      </Field>

      <Button type="submit" loading={submitting} className="w-full">
        {submitting ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
