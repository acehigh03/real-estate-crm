interface SendTelnyxMessageParams {
  to: string;
  text: string;
}

export class TelnyxSendError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "TelnyxSendError";
    this.status = status;
  }
}

export async function sendTelnyxMessage({ to, text }: SendTelnyxMessageParams) {
  const apiKey = process.env.TELNYX_API_KEY;
  const fromNumber =
    process.env.TELNYX_FROM_NUMBER ?? process.env.TELNYX_PHONE_NUMBER;
  const messagingProfileId = process.env.TELNYX_MESSAGING_PROFILE_ID;

  if (!apiKey || !fromNumber) {
    throw new TelnyxSendError(
      "Telnyx is not configured. Add TELNYX_API_KEY and TELNYX_FROM_NUMBER before sending messages.",
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

  const response = await fetch("https://api.telnyx.com/v2/messages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let errorMessage = "Telnyx send failed.";

    try {
      const errorPayload = (await response.json()) as {
        errors?: Array<{ title?: string; detail?: string; code?: string }>;
      };
      const firstError = errorPayload.errors?.[0];
      if (firstError) {
        errorMessage = firstError.detail ?? firstError.title ?? firstError.code ?? errorMessage;
      }
    } catch {
      const errorText = (await response.text()).trim();
      if (errorText) {
        errorMessage = errorText;
      }
    }

    throw new TelnyxSendError(errorMessage, response.status);
  }

  const payload = await response.json();
  return payload.data as {
    id: string;
    to: Array<{ status: string }>;
  };
}
