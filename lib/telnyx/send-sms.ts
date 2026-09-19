import { logError } from "@/lib/errors";

interface SendTelnyxMessageParams {
  to: string;
  text: string;
  /** Sender number; defaults to TELNYX_PHONE_NUMBER. */
  from?: string;
}

export class TelnyxSendError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "TelnyxSendError";
    this.status = status;
  }
}

const TELNYX_TIMEOUT_MS = 15_000;

/**
 * Reads an env var the way a human meant it. Values pasted into a host dashboard often carry
 * surrounding quotes, spaces or a trailing newline; any of those turns a valid Telnyx key into
 * a 401 ("Bearer \"KEY...\"") or an invalid header.
 */
function readEnv(...names: string[]) {
  for (const name of names) {
    const raw = process.env[name];
    if (raw === undefined) continue;
    const cleaned = raw.trim().replace(/^(["'])([\s\S]*)\1$/, "$2").trim();
    if (cleaned) return cleaned;
  }
  return undefined;
}

export async function sendTelnyxMessage({ to, text, from }: SendTelnyxMessageParams) {
  const apiKey = readEnv("TELNYX_API_KEY");
  const fromNumber = from ?? readEnv("TELNYX_PHONE_NUMBER", "TELNYX_FROM_NUMBER");
  const messagingProfileId = readEnv("TELNYX_MESSAGING_PROFILE_ID");

  if (!apiKey || !fromNumber) {
    console.error("[telnyx] send aborted: TELNYX_API_KEY and/or TELNYX_PHONE_NUMBER is not set");
    throw new TelnyxSendError(
      "Telnyx is not configured. Add TELNYX_API_KEY and TELNYX_PHONE_NUMBER before sending messages.",
      500
    );
  }

  const body: Record<string, string> = {
    from: fromNumber,
    to,
    text,
  };
  if (messagingProfileId) {
    body.messaging_profile_id = messagingProfileId;
  }

  let response: Response;
  try {
    response = await fetch(`${(process.env.TELNYX_API_BASE ?? "https://api.telnyx.com").replace(/\/$/, "")}/v2/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TELNYX_TIMEOUT_MS),
    });
  } catch (error) {
    logError("telnyx", error, { step: "send request failed (network/timeout)", to });
    throw new TelnyxSendError("Could not reach Telnyx. Please try again.", 503);
  }

  if (!response.ok) {
    let errorMessage = "Telnyx send failed.";

    // Read the body once as text: calling .json() and then falling back to .text()
    // would throw "body already used" and hide the real Telnyx error.
    const rawBody = (await response.text().catch(() => "")).trim();
    try {
      const errorPayload = JSON.parse(rawBody) as {
        errors?: Array<{ title?: string; detail?: string; code?: string }>;
      };
      const firstError = errorPayload.errors?.[0];
      if (firstError) {
        errorMessage = firstError.detail ?? firstError.title ?? firstError.code ?? errorMessage;
      }
    } catch {
      if (rawBody) errorMessage = rawBody.slice(0, 300);
    }

    console.error("[telnyx] send failed", { status: response.status, to, error: errorMessage });
    throw new TelnyxSendError(errorMessage, response.status);
  }

  let payload: { data?: { id: string; to: Array<{ status: string }> } };
  try {
    payload = await response.json();
  } catch (error) {
    logError("telnyx", error, { step: "send succeeded but response was not JSON", to });
    throw new TelnyxSendError("Telnyx returned an unreadable response.", 502);
  }

  if (!payload.data?.id) {
    console.error("[telnyx] send response missing message id", { to });
    throw new TelnyxSendError("Telnyx returned an unexpected response.", 502);
  }

  return payload.data;
}
