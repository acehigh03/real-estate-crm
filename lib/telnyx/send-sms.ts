import { getEnv } from "@/lib/env";

interface SendTelnyxMessageParams {
  to: string;
  text: string;
}

export async function sendTelnyxMessage({ to, text }: SendTelnyxMessageParams) {
  const env = getEnv();
  const response = await fetch("https://api.telnyx.com/v2/messages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.TELNYX_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: env.TELNYX_FROM_NUMBER,
      to,
      text,
      messaging_profile_id: env.TELNYX_MESSAGING_PROFILE_ID
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Telnyx send failed: ${errorText}`);
  }

  const payload = await response.json();
  return payload.data;
}
