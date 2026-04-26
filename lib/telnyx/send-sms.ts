interface SendTelnyxMessageParams {
  to: string;
  text: string;
}

export async function sendTelnyxMessage({ to, text }: SendTelnyxMessageParams) {
  const apiKey = process.env.TELNYX_API_KEY;
  const fromNumber =
    process.env.TELNYX_FROM_NUMBER ?? process.env.TELNYX_PHONE_NUMBER;
  const messagingProfileId = process.env.TELNYX_MESSAGING_PROFILE_ID;

  if (!apiKey || !fromNumber) {
    throw new Error("Telnyx env vars not configured");
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
    const errorText = await response.text();
    throw new Error(`Telnyx send failed: ${errorText}`);
  }

  const payload = await response.json();
  return payload.data as {
    id: string;
    to: Array<{ status: string }>;
  };
}
