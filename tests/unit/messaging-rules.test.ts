import { describe, expect, it } from "vitest";

import { pickSenderNumber, renderTemplate, senderNumbers } from "../../lib/automation/rules";
import { classifyInboundSms } from "../../lib/ai/classify-lead";
import { prepareOutboundMessage, withStopLanguage } from "../../lib/utils";

describe("SMS compliance rules", () => {
  it("adds STOP language to the first outbound message only", () => {
    expect(prepareOutboundMessage("Hi Sam", 0)).toBe("Hi Sam Reply STOP to opt out.");
    expect(prepareOutboundMessage("Following up", 1)).toBe("Following up");
  });

  it("does not duplicate existing STOP language", () => {
    expect(withStopLanguage("Hi. Reply STOP to opt out.")).toBe("Hi. Reply STOP to opt out.");
  });

  it("recognizes carrier opt-out keywords without matching ordinary words", () => {
    expect(classifyInboundSms("STOP").messageClassification).toBe("STOP_DNC");
    expect(classifyInboundSms("Please stop texting me").messageClassification).toBe("STOP_DNC");
    expect(classifyInboundSms("I stopped by yesterday").messageClassification).not.toBe("STOP_DNC");
  });
});

describe("sender pooling and templates", () => {
  it("keeps a lead on one valid pooled number", () => {
    const numbers = senderNumbers("+17135550101,+17135550102,+17135550103");
    const first = pickSenderNumber("lead-123", numbers);
    expect(numbers).toContain(first);
    expect(pickSenderNumber("lead-123", numbers)).toBe(first);
  });

  it("renders supported lead fields", () => {
    expect(renderTemplate("Hi [[first_name]], is [[address]] yours?", { first_name: "John", property_address: "123 Main St" }))
      .toBe("Hi John, is 123 Main St yours?");
  });
});
