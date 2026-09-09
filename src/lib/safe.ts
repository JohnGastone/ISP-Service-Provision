import { ApiRequestError } from "@/lib/api";

export interface Loaded<T> {
  data: T;
  error: string | null;
}

/**
 * Runs a loader and degrades to a fallback instead of throwing, so one
 * unavailable endpoint does not blank out a whole dashboard.
 */
export async function safeLoad<T>(loader: () => Promise<T>, fallback: T): Promise<Loaded<T>> {
  try {
    return { data: await loader(), error: null };
  } catch (error) {
    const message =
      error instanceof ApiRequestError
        ? error.message
        : "Could not reach the API service. Check that the Spring Boot backend is running.";
    return { data: fallback, error: message };
  }
}
