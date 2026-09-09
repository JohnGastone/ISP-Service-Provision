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

  const [values, setValues] = useState({ username: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update(key: "username" | "password", value: string) {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    // Password managers autofill the DOM inputs without firing React's
    // onChange, which would leave the controlled state empty and silently fail
    // validation. Read what the form actually holds, falling back to state.
    const formData = new FormData(event.currentTarget);
    const submitted = {
      username: (formData.get("username") as string | null) ?? values.username,
      password: (formData.get("password") as string | null) ?? values.password,
    };

    // Keep the visible inputs and state in step with what was submitted.
    if (submitted.username !== values.username || submitted.password !== values.password) {
      setValues(submitted);
    }

    const parsed = loginSchema.safeParse(submitted);
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
      setFormError(
        error instanceof ClientApiError
          ? error.message
          : "Something went wrong. Please try again.",
      );
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {formError ? <ErrorNotice message={formError} /> : null}

      <Field
        label="Email or username"
        htmlFor="username"
        error={errors.username}
        hint="Customers sign in with their email address"
      >
        <Input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          autoFocus
          placeholder="you@example.co.tz"
          value={values.username}
          invalid={Boolean(errors.username)}
          onChange={(e) => update("username", e.target.value)}
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
