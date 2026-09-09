/**
 * Shapes mirroring the Spring Boot API exactly.
 * All bandwidth figures are Mbps.
 */

export type Role = "ADMIN" | "CUSTOMER";

/** GET /api/auth/me and POST /api/auth/login */
export interface AuthPrincipal {
  username: string;
  admin: boolean;
}

/** What this app stores in the session cookie for display and routing. */
export interface AuthUser {
  username: string;
  fullName: string;
  role: Role;
}

/**
 * Customer as RETURNED by the API — location is flattened to `district` /
 * `region` at the top level.
 */
export interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  district: string;
  region: string;
}

/**
 * Customer as ACCEPTED by the API — note the nested `location`, which does not
 * match the response shape.
 */
export interface CustomerPayload {
  name: string;
  email: string;
  phone: string;
  location: { district: string; region: string };
}

/**
 * Pool. The `*Allocated` and `*Remaining` figures are computed by the backend
 * from approved requests and are read-only.
 */
export interface BandwidthPool {
  id: number;
  totalUploadMbps: number;
  totalDownloadMbps: number;
  uploadAllocatedMbps: number;
  downloadAllocatedMbps: number;
  uploadRemainingMbps: number;
  downloadRemainingMbps: number;
}

/** POST and PUT /api/bandwidth/pools — totals only. */
export interface BandwidthPoolPayload {
  totalUploadMbps: number;
  totalDownloadMbps: number;
}

export type RequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface BandwidthRequest {
  id: number;
  customerId: number;
  poolId: number;
  requestedUploadMbps: number;
  requestedDownloadMbps: number;
  status: RequestStatus;
  requestedAt: string;
  decidedAt: string | null;
  decisionNote: string | null;
}

export interface BandwidthRequestPayload {
  customerId: number;
  poolId: number;
  requestedUploadMbps: number;
  requestedDownloadMbps: number;
}

/** Derived pool figures — computed client-side so the UI can preview a decision. */
export interface PoolAvailability {
  uploadRemaining: number;
  downloadRemaining: number;
  uploadUsedPct: number;
  downloadUsedPct: number;
}

/** RFC 9457 ProblemDetail, as returned by every error path. */
export interface ProblemDetail {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  timestamp?: string;
}
