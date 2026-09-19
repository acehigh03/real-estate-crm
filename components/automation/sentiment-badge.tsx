import type { ReplySentimentValue } from "@/lib/automation/rules";

export const SENTIMENT_LABEL: Record<ReplySentimentValue, string> = {
  interested: "Interested",
  maybe: "Maybe",
  not_interested: "Not Interested",
  stop: "STOP",
  question: "Question",
};

const SENTIMENT_CLASS: Record<ReplySentimentValue, string> = {
  interested: "border-emerald-200 bg-emerald-50 text-emerald-700",
  maybe: "border-yellow-200 bg-yellow-50 text-yellow-800",
  not_interested: "border-slate-200 bg-slate-100 text-slate-600",
  stop: "border-red-200 bg-red-50 text-red-700",
  question: "border-blue-200 bg-blue-50 text-blue-700",
};

export function isSentiment(value: string | null | undefined): value is ReplySentimentValue {
  return !!value && value in SENTIMENT_LABEL;
}

export function SentimentBadge({ sentiment, className = "" }: { sentiment: string | null | undefined; className?: string }) {
  if (!isSentiment(sentiment)) return null;
  return <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-4 ${SENTIMENT_CLASS[sentiment]} ${className}`}>{SENTIMENT_LABEL[sentiment]}</span>;
}

/** Sentiment for an inbound message: the AI classification if we have one, else a STOP the webhook already flagged. */
export function messageSentiment(
  msg: { direction: string; telnyx_message_id: string | null; classification: string | null },
  sentiments: Record<string, string>
): string | null {
  if (msg.direction !== "inbound") return null;
  const stored = msg.telnyx_message_id ? sentiments[msg.telnyx_message_id] : undefined;
  if (stored) return stored;
  return msg.classification === "STOP_DNC" ? "stop" : null;
}
