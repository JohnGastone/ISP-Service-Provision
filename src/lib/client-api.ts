"use client";

/**
 * Browser-side calls. Every request goes through /api/proxy/* so the Basic
 * credential stays in the httpOnly cookie and is attached server-side.
 */

export class ClientApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ClientApiError";
    this.status = status;
  }
}

function messageFor(data: unknown, status: number): string {
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    // RFC 9457 ProblemDetail — `detail` carries the useful part.
    for (const key of ["detail", "title", "message"]) {
      if (typeof d[key] === "string" && (d[key] as string).trim()) return d[key] as string;
    }
  }
  switch (status) {
    case 400:
      return "The details supplied were rejected by the server.";
    case 401:
      return "Your session has expired. Please sign in again.";
    case 403:
      return "You do not have permission to do that.";
    case 404:
      return "That record could not be found.";
    case 409:
      return "This request has already been decided.";
    case 422:
      return "The request could not be fulfilled.";
    default:
      return `Request failed (${status})`;
  }
}

async function request<T>(
  url: string,
  init: Omit<RequestInit, "body"> & { body?: unknown } = {},
): Promise<T> {
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
      data = { detail: text };
    }
  }

  if (!res.ok) {
    // A 401 means the stored credential no longer works — sign in again.
    if (res.status === 401 && typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new ClientApiError(messageFor(data, res.status), res.status);
  }

  return data as T;
}

/** Calls a Spring Boot path, e.g. api("/api/customers"). */
export function api<T>(
  path: string,
  init?: Omit<RequestInit, "body"> & { body?: unknown },
): Promise<T> {
  const clean = path.startsWith("/") ? path.slice(1) : path;
  return request<T>(`/api/proxy/${clean}`, init);
}

/** Calls a route handler on this Next app, e.g. local("/api/auth/login"). */
export function local<T>(
  path: string,
  init?: Omit<RequestInit, "body"> & { body?: unknown },
): Promise<T> {
  return request<T>(path, init);
}
