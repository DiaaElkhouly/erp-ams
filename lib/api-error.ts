/**
 * Framework-agnostic HTTP error, so a domain module can say what went wrong
 * without importing anything from next/server. `handleApiError` is the single
 * place that turns one of these into a response.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export function notFound(message: string) {
  return new ApiError(404, message);
}

/** The request was valid but conflicts with current state, e.g. a repeat transition. */
export function conflict(message: string, details?: unknown) {
  return new ApiError(409, message, details);
}