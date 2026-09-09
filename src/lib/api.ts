import "server-only";
import { getToken } from "@/lib/session";
import type {
  BandwidthPool,
  BandwidthPoolPayload,
  Customer,
  CustomerPayload,
  ServiceRequest,
} from "@/lib/types";

export const SPRING_API_URL = process.env.SPRING_API_URL || "http://localhost:8080";

export class ApiRequestError extends Error {
  status: number;
  fieldErrors?: Record<string, string>;

  constructor(message: string, status: number, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

interface FetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Skip attaching the bearer token (login/refresh). */
  anonymous?: boolean;
}

/**
 * Server-side call into Spring Boot. The JWT lives in an httpOnly cookie, so it
 * is read here rather than on the client.
 */
export async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { body, anonymous, headers, ...rest } = options;
  const token = anonymous ? null : await getToken();

  const res = await fetch(`${SPRING_API_URL}${path}`, {
    ...rest,
    headers: {
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
    throw new ApiRequestError(
      extractMessage(data) ?? `Request failed with status ${res.status}`,
      res.status,
      extractFieldErrors(data),
    );
  }

  return (data ?? (null as unknown)) as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

/** Handles both plain `{message}` bodies and Spring's default error body. */
function extractMessage(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  for (const key of ["message", "error", "detail", "title"]) {
    if (typeof d[key] === "string" && d[key]) return d[key] as string;
  }
  return null;
}

/** Maps Spring validation errors (`errors: [{field, defaultMessage}]`) to a flat record. */
function extractFieldErrors(data: unknown): Record<string, string> | undefined {
  if (!data || typeof data !== "object") return undefined;
  const errors = (data as Record<string, unknown>).errors;
  if (!Array.isArray(errors)) return undefined;

  const out: Record<string, string> = {};
  for (const e of errors) {
    if (e && typeof e === "object") {
      const { field, defaultMessage, message } = e as Record<string, unknown>;
      if (typeof field === "string") {
        out[field] = String(defaultMessage ?? message ?? "Invalid value");
      }
    }
  }
  return Object.keys(out).length ? out : undefined;
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

/* ------------------------------ Customers ------------------------------ */

export async function listCustomers(): Promise<Customer[]> {
  return unwrapList<Customer>(await apiFetch<unknown>("/api/customers"));
}

export async function getCustomer(id: number | string): Promise<Customer> {
  return apiFetch<Customer>(`/api/customers/${id}`);
}

export async function getMyProfile(): Promise<Customer> {
  return apiFetch<Customer>("/api/customers/me");
}

export async function createCustomer(payload: CustomerPayload): Promise<Customer> {
  return apiFetch<Customer>("/api/customers", { method: "POST", body: payload });
}

export async function updateCustomer(
  id: number | string,
  payload: CustomerPayload,
): Promise<Customer> {
  return apiFetch<Customer>(`/api/customers/${id}`, { method: "PUT", body: payload });
}

export async function deleteCustomer(id: number | string): Promise<void> {
  await apiFetch<void>(`/api/customers/${id}`, { method: "DELETE" });
}

/* --------------------------- Bandwidth pools --------------------------- */

export async function listPools(): Promise<BandwidthPool[]> {
  return unwrapList<BandwidthPool>(await apiFetch<unknown>("/api/bandwidth-pools"));
}

export async function getPool(id: number | string): Promise<BandwidthPool> {
  return apiFetch<BandwidthPool>(`/api/bandwidth-pools/${id}`);
}

export async function createPool(payload: BandwidthPoolPayload): Promise<BandwidthPool> {
  return apiFetch<BandwidthPool>("/api/bandwidth-pools", { method: "POST", body: payload });
}

export async function updatePool(
  id: number | string,
  payload: BandwidthPoolPayload,
): Promise<BandwidthPool> {
  return apiFetch<BandwidthPool>(`/api/bandwidth-pools/${id}`, {
    method: "PUT",
    body: payload,
  });
}

/** Adds capacity to an existing pool without touching what is already allocated. */
export async function topUpPool(
  id: number | string,
  addUpload: number,
  addDownload: number,
): Promise<BandwidthPool> {
  return apiFetch<BandwidthPool>(`/api/bandwidth-pools/${id}/top-up`, {
    method: "POST",
    body: { addUpload, addDownload },
  });
}

/* --------------------------- Service requests -------------------------- */

export async function listRequests(status?: string): Promise<ServiceRequest[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return unwrapList<ServiceRequest>(await apiFetch<unknown>(`/api/service-requests${qs}`));
}

export async function listMyRequests(): Promise<ServiceRequest[]> {
  return unwrapList<ServiceRequest>(await apiFetch<unknown>("/api/service-requests/mine"));
}

export async function getRequest(id: number | string): Promise<ServiceRequest> {
  return apiFetch<ServiceRequest>(`/api/service-requests/${id}`);
}
