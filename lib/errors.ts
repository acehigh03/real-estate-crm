interface ErrorLike {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
  status?: number;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

function asErrorLike(error: unknown): ErrorLike {
  if (error && typeof error === "object") return error as ErrorLike;
  if (typeof error === "string") return { message: error };
  return {};
}

/**
 * True when PostgREST/Postgres says a table or column is missing — i.e. the database
 * schema is behind the code (unapplied migration or stale schema cache).
 */
export function isSchemaError(error: unknown) {
  const { code, message = "" } = asErrorLike(error);
  return (
    code === "PGRST204" || // column not found in schema cache
    code === "PGRST205" || // table not found in schema cache
    code === "42703" || // undefined_column
    code === "42P01" || // undefined_table
    /schema cache/i.test(message) ||
    /column .* does not exist/i.test(message) ||
    /relation .* does not exist/i.test(message)
  );
}

/**
 * Converts any thrown/returned Supabase, Telnyx or config error into a message that is safe
 * and useful to show to an end user. The raw error must be logged separately by the caller.
 */
export function userFacingError(error: unknown, fallback = "Something went wrong. Please try again.") {
  const err = asErrorLike(error);
  const message = err.message ?? "";

  if (error instanceof ConfigError) {
    return "The server is not configured correctly. Please contact support.";
  }
  if (isSchemaError(error)) {
    return "The CRM database is out of date. Ask an admin to apply the latest database migration, then try again.";
  }
  if (/invalid api key/i.test(message) || err.status === 401 || err.code === "PGRST301") {
    return "The server could not authenticate with the database. Please contact support.";
  }
  if (err.code === "23505") {
    return "That record already exists.";
  }
  if (err.code === "23502") {
    return "A required field is missing.";
  }
  if (err.code === "42501" || /row-level security/i.test(message)) {
    return "You don't have permission to do that.";
  }
  if (/fetch failed|network|ECONNREFUSED|ETIMEDOUT/i.test(message)) {
    return "Couldn't reach the database. Please check your connection and try again.";
  }

  return fallback;
}

export function logError(scope: string, error: unknown, context?: Record<string, unknown>) {
  const err = asErrorLike(error);
  console.error(`[${scope}]`, {
    message: err.message ?? String(error),
    code: err.code,
    details: err.details,
    hint: err.hint,
    ...context,
  });
}
