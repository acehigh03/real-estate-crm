import type {
  LeadClassification,
  LeadPriority,
  LeadStage,
  LeadStatus,
  MessageClassification,
} from "@/types/database";

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

export interface InboundSmsClassificationResult {
  messageClassification: MessageClassification;
  leadClassification: LeadClassification;
  leadStatus: LeadStatus;
  leadStage: LeadStage;
  leadScore: number;
  priority: LeadPriority;
  isDnc: boolean;
  dncReason: string | null;
  shouldAlert: boolean;
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

export function classifyInboundSms(text: string): InboundSmsClassificationResult {
  const normalized = text.trim().toLowerCase();

  const stopSignals = ["stop", "unsubscribe", "cancel", "end", "quit", "stop all", "stopall"];
  if (stopSignals.some((signal) => normalized === signal || normalized.includes(signal))) {
    return {
      messageClassification: "STOP_DNC",
      leadClassification: "OPT_OUT",
      leadStatus: "DNC",
      leadStage: "DNC",
      leadScore: 0,
      priority: "low",
      isDnc: true,
      dncReason: "Lead replied with STOP/DNC language",
      shouldAlert: false,
    };
  }

  const notInterestedSignals = [
    "not interested",
    "no thanks",
    "remove me",
    "wrong number",
    "already sold",
    "sold it",
    "do not text",
  ];
  if (notInterestedSignals.some((signal) => normalized.includes(signal))) {
    return {
      messageClassification: "NOT_INTERESTED",
      leadClassification: "DEAD",
      leadStatus: "Dead",
      leadStage: "Closed",
      leadScore: 10,
      priority: "low",
      isDnc: false,
      dncReason: null,
      shouldAlert: false,
    };
  }

  const hotSignals = [
    "yes",
    "interested",
    "call me",
    "let's talk",
    "lets talk",
    "make an offer",
    "cash offer",
    "how much",
    "available today",
    "i'm ready",
    "ready to sell",
  ];
  if (hotSignals.some((signal) => normalized.includes(signal))) {
    return {
      messageClassification: "HOT",
      leadClassification: "HOT",
      leadStatus: "Hot",
      leadStage: "Hot Lead",
      leadScore: 92,
      priority: "high",
      isDnc: false,
      dncReason: null,
      shouldAlert: true,
    };
  }

  const warmSignals = [
    "maybe",
    "later",
    "next week",
    "send details",
    "tell me more",
    "what do you mean",
    "possibly",
    "can you explain",
  ];
  if (warmSignals.some((signal) => normalized.includes(signal))) {
    return {
      messageClassification: "WARM",
      leadClassification: "WARM",
      leadStatus: "Replied",
      leadStage: "Replied",
      leadScore: 68,
      priority: "medium",
      isDnc: false,
      dncReason: null,
      shouldAlert: false,
    };
  }

  return {
    messageClassification: "NEEDS_REVIEW",
    leadClassification: "WARM",
    leadStatus: "Replied",
    leadStage: "Follow Up",
    leadScore: 55,
    priority: "medium",
    isDnc: false,
    dncReason: null,
    shouldAlert: false,
  };
}
