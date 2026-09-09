import { getCredential } from "@/lib/session";
import type {
  AuthPrincipal,
  BandwidthPool,
  BandwidthPoolPayload,
  BandwidthRequest,
  BandwidthRequestPayload,
  Customer,
  CustomerPayload,
  ProblemDetail,
} from "@/lib/types";

export const SPRING_API_URL = process.env.SPRING_API_URL || "http://localhost:8080";

export class ApiRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

interface FetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Override the stored session credential (used by the login check). */
  credential?: string;
}

/**
 * Server-side call into Spring Boot. The API uses HTTP Basic on every request,
 * so the credential is read from the httpOnly cookie here and never reaches the
 * browser. Because these calls are server-to-server, no CORS config is needed
 * on the backend.
 */
export async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { body, credential, headers, ...rest } = options;
  const auth = credential ?? (await getCredential());

  const res = await fetch(`${SPRING_API_URL}${path}`, {
    ...rest,
    headers: {
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(auth ? { Authorization: `Basic ${auth}` } : {}),
      ...(headers as Record<string, string> | undefined),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  return handle<T>(res);
}

export async function handle<T>(res: Response): Promise<T> {
  const text = await res.text();
  const data = text ? safeJson(text) : null;

  if (!res.ok) {
    throw new ApiRequestError(problemMessage(data, res.status), res.status);
  }

  return (data ?? (null as unknown)) as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { detail: text };
  }
}

/**
 * Turns an RFC 9457 ProblemDetail into a message worth showing. `detail`
 * carries the useful part (which fields failed, how much bandwidth was short).
 */
export function problemMessage(data: unknown, status: number): string {
  if (data && typeof data === "object") {
    const p = data as ProblemDetail & Record<string, unknown>;
    if (typeof p.detail === "string" && p.detail.trim()) return p.detail;
    if (typeof p.title === "string" && p.title.trim()) return p.title;
    if (typeof p.message === "string" && p.message.trim()) return p.message as string;
  }
  return defaultMessageFor(status);
}

export function defaultMessageFor(status: number): string {
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
      return `Request failed with status ${status}`;
  }
}

/** Tolerates both a bare array and a Spring `Page<T>` envelope. */
function unwrapList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const content = (data as Record<string, unknown>).content;
    if (Array.isArray(content)) return content as T[];
  }
  return [];
}

/* --------------------------------- Auth -------------------------------- */

/** Verifies a base64 "user:pass" credential. Returns null when rejected. */
export async function verifyCredential(credential: string): Promise<AuthPrincipal> {
  return apiFetch<AuthPrincipal>("/api/auth/login", { method: "POST", credential });
}

export async function whoAmI(): Promise<AuthPrincipal> {
  return apiFetch<AuthPrincipal>("/api/auth/me");
}

/* ------------------------------ Customers ------------------------------ */

export async function listCustomers(): Promise<Customer[]> {
  return unwrapList<Customer>(await apiFetch<unknown>("/api/customers"));
}

export async function getCustomer(id: number | string): Promise<Customer> {
  return apiFetch<Customer>(`/api/customers/${id}`);
}

/**
 * Registration returns `generatedPassword` exactly once when the admin did not
 * supply one — it is never retrievable again, so the UI must surface it.
 */
export async function createCustomer(
  payload: CustomerPayload,
): Promise<Customer & { generatedPassword?: string }> {
  return apiFetch<Customer & { generatedPassword?: string }>("/api/customers", {
    method: "POST",
    body: payload,
  });
}

/** The signed-in customer's own record. */
export async function getMyProfile(): Promise<Customer> {
  return apiFetch<Customer>("/api/customers/me");
}

/* --------------------------- Bandwidth pools --------------------------- */

export async function listPools(): Promise<BandwidthPool[]> {
  return unwrapList<BandwidthPool>(await apiFetch<unknown>("/api/bandwidth/pools"));
}

export async function getPool(id: number | string): Promise<BandwidthPool> {
  return apiFetch<BandwidthPool>(`/api/bandwidth/pools/${id}`);
}

export async function createPool(payload: BandwidthPoolPayload): Promise<BandwidthPool> {
  return apiFetch<BandwidthPool>("/api/bandwidth/pools", { method: "POST", body: payload });
}

/** Changing totals below what is already allocated is rejected with 422. */
export async function updatePool(
  id: number | string,
  payload: BandwidthPoolPayload,
): Promise<BandwidthPool> {
  return apiFetch<BandwidthPool>(`/api/bandwidth/pools/${id}`, {
    method: "PUT",
    body: payload,
  });
}

/* -------------------------- Bandwidth requests ------------------------- */

/** Admin-only: every request in the system. */
export async function listRequests(): Promise<BandwidthRequest[]> {
  return unwrapList<BandwidthRequest>(await apiFetch<unknown>("/api/bandwidth/requests"));
}

/** The signed-in customer's own requests. */
export async function listMyRequests(): Promise<BandwidthRequest[]> {
  return unwrapList<BandwidthRequest>(await apiFetch<unknown>("/api/bandwidth/requests/mine"));
}

export async function createRequest(
  payload: BandwidthRequestPayload,
): Promise<BandwidthRequest> {
  return apiFetch<BandwidthRequest>("/api/bandwidth/requests", {
    method: "POST",
    body: payload,
  });
}

export async function approveRequest(id: number, note?: string): Promise<BandwidthRequest> {
  return apiFetch<BandwidthRequest>(`/api/bandwidth/requests/${id}/approve`, {
    method: "POST",
    body: note ? { note } : {},
  });
}

export async function rejectRequest(id: number, note: string): Promise<BandwidthRequest> {
  return apiFetch<BandwidthRequest>(`/api/bandwidth/requests/${id}/reject`, {
    method: "POST",
    body: { note },
  });
}
