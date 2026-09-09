/**
 * Shapes mirroring the Spring Boot API payloads.
 * All bandwidth figures are Mbps.
 */

export type Role = "ADMIN" | "CUSTOMER";

export interface AuthUser {
  id: number;
  fullName: string;
  email: string;
  role: Role;
  /** Present when role is CUSTOMER — links the login to its customer record. */
  customerId?: number;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export interface Location {
  district: string;
  region: string;
}

export interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  location: Location;
  status?: "ACTIVE" | "SUSPENDED";
  createdAt?: string;
}

export type CustomerPayload = Omit<Customer, "id" | "createdAt">;

export interface BandwidthPool {
  id: number;
  name?: string;
  totalUpload: number;
  totalDownload: number;
  uploadAllocated: number;
  downloadAllocated: number;
}

export type BandwidthPoolPayload = Omit<
  BandwidthPool,
  "id" | "uploadAllocated" | "downloadAllocated"
> & {
  uploadAllocated?: number;
  downloadAllocated?: number;
};

export type RequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface ServiceRequest {
  id: number;
  customer: Pick<Customer, "id" | "name" | "email" | "phone">;
  poolId: number;
  requestedUpload: number;
  requestedDownload: number;
  status: RequestStatus;
  createdAt: string;
  decidedAt?: string;
  decisionNote?: string;
}

export interface ApiError {
  message: string;
  status: number;
  fieldErrors?: Record<string, string>;
}

/** Derived pool figures — computed on the client so the UI can preview a decision. */
export interface PoolAvailability {
  uploadRemaining: number;
  downloadRemaining: number;
  uploadUsedPct: number;
  downloadUsedPct: number;
}
