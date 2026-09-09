import { z } from "zod";
import { TZ_PHONE_REGEX, isValidLocation, normalizePhoneInput } from "@/lib/tz";

export const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const customerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(3, "Name must be at least 3 characters")
      .max(120, "Name is too long"),
    email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
    phone: z
      .string()
      .trim()
      .min(1, "Phone number is required")
      .transform(normalizePhoneInput)
      .refine((v) => TZ_PHONE_REGEX.test(v), {
        message: "Enter a valid Tanzanian mobile number, e.g. 0712345678 or +255712345678",
      }),
    region: z.string().min(1, "Region is required"),
    district: z.string().min(1, "District is required"),
  })
  .refine((v) => isValidLocation(v.region, v.district), {
    message: "Select a district that belongs to the chosen region",
    path: ["district"],
  });

export type CustomerFormValues = z.input<typeof customerSchema>;

const mbps = (label: string) =>
  z
    .number({ invalid_type_error: `${label} must be a number` })
    .positive(`${label} must be greater than zero`)
    .max(1_000_000, `${label} looks unrealistic`);

export const bandwidthPoolSchema = z.object({
  name: z.string().trim().max(80).optional(),
  totalUpload: mbps("Total upload"),
  totalDownload: mbps("Total download"),
});

export const serviceRequestSchema = z.object({
  poolId: z.number().int().positive("Select a bandwidth pool"),
  requestedUpload: mbps("Requested upload"),
  requestedDownload: mbps("Requested download"),
  note: z.string().trim().max(500).optional(),
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
