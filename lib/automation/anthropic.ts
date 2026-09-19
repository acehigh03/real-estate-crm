// Minimal Anthropic Messages API client (fetch only — no SDK dependency).
// ANTHROPIC_API_KEY must be set in the environment; ANTHROPIC_API_BASE / ANTHROPIC_MODEL are
// optional overrides (the base URL also lets tests point at a local fake).

export class AiNotConfiguredError extends Error {
  constructor() {
    super("AI isn't configured. Add ANTHROPIC_API_KEY to the environment.");
    this.name = "AiNotConfiguredError";
  }
}

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

function config() {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new AiNotConfiguredError();
  return {
    key,
    base: (process.env.ANTHROPIC_API_BASE ?? "https://api.anthropic.com").replace(/\/$/, ""),
    model: process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL,
  };
}

async function request(body: Record<string, unknown>, timeoutMs: number) {
  const { key, base, model } = config();
  const response = await fetch(`${base}/v1/messages`, {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model, ...body }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 200);
    throw new Error(`Anthropic API ${response.status}: ${detail}`);
  }
  return response;
}

/** One short completion, returned as text. */
export async function callClaude({ prompt, maxTokens = 200, timeoutMs = 10_000 }: { prompt: string; maxTokens?: number; timeoutMs?: number }) {
  const response = await request({ max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }, timeoutMs);
  const data = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
  return (data.content ?? []).filter((part) => part.type === "text").map((part) => part.text ?? "").join("").trim();
}

/** Streams a completion as plain-text chunks (SSE parsed server-side). */
export async function streamClaude({ prompt, maxTokens = 200, timeoutMs = 30_000 }: { prompt: string; maxTokens?: number; timeoutMs?: number }) {
  const response = await request({ max_tokens: maxTokens, stream: true, messages: [{ role: "user", content: prompt }] }, timeoutMs);
  const upstream = response.body;
  if (!upstream) throw new Error("Anthropic returned no stream");

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              const event = JSON.parse(payload) as { type?: string; delta?: { type?: string; text?: string } };
              if (event.type === "content_block_delta" && event.delta?.type === "text_delta" && event.delta.text) {
                controller.enqueue(encoder.encode(event.delta.text));
              }
            } catch {
              // ignore keep-alives / partial frames
            }
          }
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}
