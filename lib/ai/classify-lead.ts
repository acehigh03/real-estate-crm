import type { LeadClassification, LeadStatus } from "@/types/database";

interface MockClassificationInput {
  status: LeadStatus;
  notesSummary?: string | null;
  nextFollowUpAt?: string | null;
  inboundMessageCount?: number;
}

export interface MockClassificationResult {
  classification: LeadClassification;
  motivationScore: number;
}

// This is intentionally simple for Phase 1 so the call sites can stay stable
// when we later replace the internals with a real model provider.
export function classifyLeadMock({
  status,
  notesSummary,
  nextFollowUpAt,
  inboundMessageCount = 0,
}: MockClassificationInput): MockClassificationResult {
  if (status === "DNC") return { classification: "OPT_OUT", motivationScore: 0 };
  if (status === "Dead") return { classification: "DEAD", motivationScore: 5 };
  if (status === "Hot") return { classification: "HOT", motivationScore: 92 };

  const summary = (notesSummary ?? "").toLowerCase();
  const hasMotivationSignal =
    summary.includes("motivated") ||
    summary.includes("urgent") ||
    summary.includes("cash") ||
    summary.includes("offer") ||
    summary.includes("close");

  if (status === "Replied" || inboundMessageCount > 0 || hasMotivationSignal) {
    return { classification: "HOT", motivationScore: 88 };
  }

  if (status === "Contacted" || Boolean(nextFollowUpAt)) {
    return { classification: "WARM", motivationScore: 68 };
  }

  if (summary.length === 0 && status === "New") {
    return { classification: "UNKNOWN", motivationScore: 25 };
  }

  return { classification: "COLD", motivationScore: 40 };
}

export function getClassificationLabel(classification: LeadClassification) {
  switch (classification) {
    case "HOT":
      return "Hot";
    case "WARM":
      return "Warm";
    case "COLD":
      return "Cold";
    case "DEAD":
      return "Dead";
    case "OPT_OUT":
      return "Opt-out";
    case "UNKNOWN":
      return "Unknown";
  }
}
