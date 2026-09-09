import { z } from "zod";
import { TZ_PHONE_REGEX, isValidLocation, normalizePhoneInput } from "@/lib/tz";

/** HTTP Basic: admins sign in with a username, customers with their email. */
export const loginSchema = z.object({
  username: z.string().trim().min(1, "Enter your email address or username"),
  password: z.string().min(1, "Password is required"),
});

export const customerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(3, "Name must be at least 3 characters")
      .max(200, "Name must be 200 characters or fewer"),
    email: z
      .string()
      .trim()
      .min(1, "Email is required")
      .email("Enter a valid email address")
      .max(254, "Email must be 254 characters or fewer"),
    phone: z
      .string()
      .trim()
      .min(1, "Phone number is required")
      .transform(normalizePhoneInput)
      .refine((v) => TZ_PHONE_REGEX.test(v), {
        message: "Enter a valid Tanzanian mobile number, e.g. 0712345678 or +255712345678",
      }),
    region: z.string().min(1, "Region is required").max(100),
    district: z.string().min(1, "District is required").max(100),
  })
  .refine((v) => isValidLocation(v.region, v.district), {
    message: "Select a district that belongs to the chosen region",
    path: ["district"],
  });

const mbps = (label: string, { allowZero = false } = {}) => {
  const base = z.number({ invalid_type_error: `${label} must be a number` });
  return (allowZero
    ? base.min(0, `${label} cannot be negative`)
    : base.positive(`${label} must be greater than zero`)
  ).max(10_000_000, `${label} looks unrealistic`);
};

/** POST/PUT /api/bandwidth/pools — the API requires both totals >= 0. */
export const bandwidthPoolSchema = z.object({
  totalUploadMbps: mbps("Total upload", { allowZero: true }),
  totalDownloadMbps: mbps("Total download", { allowZero: true }),
});

/** POST /api/bandwidth/requests — both Mbps values must be > 0. */
export const bandwidthRequestSchema = z.object({
  customerId: z.number({ invalid_type_error: "Select a customer" }).int().positive("Select a customer"),
  poolId: z.number({ invalid_type_error: "Select a pool" }).int().positive("Select a bandwidth pool"),
  requestedUploadMbps: mbps("Requested upload"),
  requestedDownloadMbps: mbps("Requested download"),
});

/**
 * A customer submitting for themselves — the API forces the customer id from
 * the authenticated principal and ignores any sent in the body.
 */
export const myRequestSchema = z.object({
  poolId: z.number({ invalid_type_error: "Select a pool" }).int().positive("Select a bandwidth pool"),
  requestedUploadMbps: mbps("Requested upload"),
  requestedDownloadMbps: mbps("Requested download"),
});

/** The reject endpoint requires a note of at most 500 characters. */
export const rejectSchema = z.object({
  note: z
    .string()
    .trim()
    .min(1, "A reason is required to reject a request")
    .max(500, "Reason must be 500 characters or fewer"),
});

/** Flattens a ZodError into the `{ field: message }` shape the forms render. */
export function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
