"use client";

/**
 * Browser-side calls. Every request goes through /api/proxy/* so the JWT stays
 * in the httpOnly cookie and is attached server-side.
 */

export class ClientApiError extends Error {
  status: number;
  fieldErrors?: Record<string, string>;

  constructor(message: string, status: number, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = "ClientApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

async function request<T>(url: string, init: Omit<RequestInit, "body"> & { body?: unknown } = {}): Promise<T> {
  const { body, headers, ...rest } = init;

  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(headers as Record<string, string> | undefined),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ClientApiError("Network error — could not reach the server", 0);
  }

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!res.ok) {
    const d = (data ?? {}) as Record<string, unknown>;
    // A 401 means the session lapsed — send the user back to sign in.
    if (res.status === 401 && typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new ClientApiError(
      (typeof d.message === "string" && d.message) || `Request failed (${res.status})`,
      res.status,
      (d.fieldErrors as Record<string, string> | undefined) ?? springFieldErrors(d),
    );
  }

  return data as T;
}

function springFieldErrors(d: Record<string, unknown>): Record<string, string> | undefined {
  if (!Array.isArray(d.errors)) return undefined;
  const out: Record<string, string> = {};
  for (const e of d.errors) {
    if (e && typeof e === "object") {
      const { field, defaultMessage, message } = e as Record<string, unknown>;
      if (typeof field === "string") out[field] = String(defaultMessage ?? message ?? "Invalid value");
    }
  }
  return Object.keys(out).length ? out : undefined;
}

/** Calls a Spring Boot path, e.g. api("/api/customers"). */
export function api<T>(path: string, init?: Omit<RequestInit, "body"> & { body?: unknown }): Promise<T> {
  const clean = path.startsWith("/") ? path.slice(1) : path;
  return request<T>(`/api/proxy/${clean}`, init);
}

/** Calls a route handler on this Next app, e.g. local("/api/auth/login"). */
export function local<T>(path: string, init?: Omit<RequestInit, "body"> & { body?: unknown }): Promise<T> {
  return request<T>(path, init);
}
