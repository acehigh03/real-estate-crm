import { NextResponse } from "next/server";

import { logError, userFacingError } from "@/lib/errors";

/**
 * Wraps a route handler so an unexpected throw (bad env, Supabase client failure, a bug)
 * becomes a logged, JSON 500 instead of an empty HTML error page.
 */
export function withErrorHandling<Args extends unknown[]>(
  scope: string,
  handler: (...args: Args) => Promise<Response>
) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      logError(scope, error);
      return NextResponse.json({ error: userFacingError(error) }, { status: 500 });
    }
  };
}

/** Parses a JSON request body; returns undefined when it is missing or malformed. */
export async function readJson(request: Request): Promise<unknown | undefined> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}
