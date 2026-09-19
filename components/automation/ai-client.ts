/** Streams a suggested drip message from /api/ai/write-drip-message, calling onText with the text so far. */
export async function streamDripMessage(
  body: { workflow_name: string; step_number: number; delay_minutes: number; prior_messages: string[] },
  onText: (text: string) => void,
  signal?: AbortSignal
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const response = await fetch("/api/ai/write-drip-message", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    if (!response.ok || !response.body) {
      const data = await response.json().catch(() => null);
      return { ok: false, error: data?.error ?? "The AI writer is unavailable right now." };
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let text = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
      onText(text);
    }
    text += decoder.decode();
    onText(text);
    return text.trim() ? { ok: true } : { ok: false, error: "The AI returned an empty message. Try again." };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return { ok: false, error: "" };
    return { ok: false, error: "Couldn't reach the AI writer. Check your connection and try again." };
  }
}
