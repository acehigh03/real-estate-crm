// Sample data for the dashboard preview (/dashboard?demo=1).
//
// Entirely fictional: invented sellers, addresses and 555-01xx phone numbers. It exists only in
// memory for the preview — nothing here is ever written to the database — and it is never used
// for a real account's dashboard.
import { BOARD_STAGES, type BoardCard, type BoardStageKey, type DashboardView } from "@/lib/dashboard-view";

export function makeDemoView(now: Date): DashboardView {
  const ago = (hours: number) => new Date(now.getTime() - hours * 3_600_000).toISOString();
  const day = (offset: number) => {
    const date = new Date(now.getTime() + offset * 86_400_000);
    return date.toISOString();
  };

  let counter = 0;
  const card = (
    name: string,
    address: string,
    over: Partial<BoardCard> = {}
  ): BoardCard => ({
    id: `demo-${++counter}`,
    name,
    address,
    phone: `+1713555${String(100 + counter).padStart(4, "0")}`,
    tag: null,
    lastContactAt: null,
    dealValue: null,
    flag: null,
    ...over,
  });

  const columns: Record<BoardStageKey, { total: number; value: number; cards: BoardCard[] }> = {
    new: {
      total: 12,
      value: 0,
      cards: [
        card("Marcus Trevino", "2234 Cullen Blvd, Houston", { tag: "Tax Sale", lastContactAt: null }),
        card("Helen Wu", "718 Wilcrest Dr, Houston", { tag: "Probate", lastContactAt: null }),
        card("Isaiah Grant", "5502 Bellfort St, Houston", { tag: "Pre-foreclosure", lastContactAt: null }),
        card("Rosa Delgado", "9310 Hillcroft Ave, Houston", { tag: "Absentee owner", lastContactAt: null }),
        card("Owen Fitzgerald", "1421 Telephone Rd, Houston", { tag: "Tax Sale", lastContactAt: null }),
      ],
    },
    skip_traced: {
      total: 5,
      value: 0,
      cards: [
        card("Calvin Ross", "3317 Airline Dr, Houston", { tag: "Probate", lastContactAt: null }),
        card("Tasha Monroe", "6605 Lyons Ave, Houston", { tag: "Tax Sale", lastContactAt: null }),
        card("Bernard Cole", "812 Crosstimbers St, Houston", { tag: "Pre-foreclosure", lastContactAt: null }),
      ],
    },
    contacted: {
      total: 21,
      value: 96_000,
      cards: [
        card("Patricia Okonkwo", "9201 Fondren Rd, Houston", { tag: "Probate", lastContactAt: ago(30), dealValue: 24_000, flag: { kind: "overdue", label: "Follow-up overdue" } }),
        card("Gloria Sampson", "6710 Scott St, Houston", { tag: "Tax Sale", lastContactAt: ago(52), dealValue: 18_500, flag: { kind: "due", label: "Follow-up today" } }),
        card("Walter Jennings", "4109 Mykawa Rd, Houston", { tag: "Absentee owner", lastContactAt: ago(76), dealValue: 31_000 }),
        card("Denise Carter", "2705 Reed Rd, Houston", { tag: "Pre-foreclosure", lastContactAt: ago(98), dealValue: 22_500 }),
        card("Priya Patel", "7823 Bissonnet St, Houston", { tag: "Probate", lastContactAt: ago(120) }),
        card("Hector Ramirez", "1918 Lockwood Dr, Houston", { tag: "Tax Sale", lastContactAt: ago(150) }),
      ],
    },
    negotiating: {
      total: 9,
      value: 148_500,
      cards: [
        card("Darnell Williams", "4812 Almeda Rd, Houston", { tag: "Pre-foreclosure", lastContactAt: ago(1.2), dealValue: 42_000, flag: { kind: "reply", label: "Replied" } }),
        card("Jerome Castillo", "1148 Griggs Rd, Houston", { tag: "Tax Sale", lastContactAt: ago(3), dealValue: 36_500, flag: { kind: "deadline", label: "Deadline in 6 days" } }),
        card("Maria Santos", "3620 Cavalcade St, Houston", { tag: "Probate", lastContactAt: ago(5), dealValue: 28_000, flag: { kind: "reply", label: "Replied" } }),
        card("Terrence Brooks", "8834 Long Point Rd, Houston", { tag: "Absentee owner", lastContactAt: ago(26), dealValue: 25_000 }),
        card("Linda Park", "5216 Selinsky Rd, Houston", { tag: "Pre-foreclosure", lastContactAt: ago(48), dealValue: 17_000 }),
      ],
    },
    offer_sent: {
      total: 6,
      value: 118_000,
      cards: [
        card("Angela Nguyen", "2901 Bellaire Blvd, Houston", { tag: "Tax Sale", lastContactAt: ago(22), dealValue: 34_000, flag: { kind: "deadline", label: "Deadline in 12 days" } }),
        card("Ray Holloway", "610 Kelley St, Houston", { tag: "Probate", lastContactAt: ago(40), dealValue: 29_500 }),
        card("Yolanda Price", "7420 Harrisburg Blvd, Houston", { tag: "Pre-foreclosure", lastContactAt: ago(64), dealValue: 31_500, flag: { kind: "overdue", label: "Follow-up overdue" } }),
        card("Samuel Ortiz", "1305 Clinton Dr, Houston", { tag: "Absentee owner", lastContactAt: ago(90), dealValue: 23_000 }),
      ],
    },
    under_contract: {
      total: 2,
      value: 64_000,
      cards: [
        card("Beatrice Lang", "4407 Braeswood Blvd, Houston", { tag: "Probate", lastContactAt: ago(10), dealValue: 38_000 }),
        card("Corey Hendricks", "9012 Gulf Fwy, Houston", { tag: "Tax Sale", lastContactAt: ago(34), dealValue: 26_000 }),
      ],
    },
    closed: {
      total: 3,
      value: 71_500,
      cards: [
        card("Vivian Moss", "3510 Dixie Dr, Houston", { tag: "Probate", lastContactAt: ago(200), dealValue: 27_500 }),
        card("Malcolm Reyes", "5822 Martin Luther King Blvd, Houston", { tag: "Tax Sale", lastContactAt: ago(310), dealValue: 44_000 }),
      ],
    },
  };

  const item = (leadId: string, name: string, address: string, detail: string, at: string | null) => ({
    leadId,
    name,
    address,
    phone: "+17135550142",
    detail,
    at,
  });

  return {
    kpis: {
      newLeads: { value: 12, delta: 5, spark: [1, 0, 2, 1, 0, 3, 1, 2, 1, 2, 0, 3, 2, 4], hint: "not contacted yet" },
      unreadReplies: { value: 6, delta: 2, spark: [0, 1, 0, 2, 1, 1, 0, 2, 1, 3, 2, 1, 4, 3], hint: "sellers waiting on you" },
      followUpsDue: { value: 8, delta: null, spark: null, hint: "3 overdue" },
      offersSent: { value: 6, delta: null, spark: null, hint: "4 awaiting reply" },
      contracts: { value: 2, delta: null, spark: null, hint: "under contract" },
      pipelineValue: { value: 386_500, delta: null, spark: null, hint: "across 34 leads" },
    },
    attentionCount: 9,
    totals: { leads: 58, hot: 7, contacted: 41 },
    board: BOARD_STAGES.map((stage) => ({
      key: stage.key,
      label: stage.label,
      total: columns[stage.key].total,
      value: columns[stage.key].value,
      cards: columns[stage.key].cards,
    })),
    actions: {
      replies: {
        count: 6,
        items: [
          item("demo-13", "Darnell Williams", "4812 Almeda Rd", "“Yeah that works, what time can you come by?”", ago(1.2)),
          item("demo-15", "Maria Santos", "3620 Cavalcade St", "“I already talked to my sister, call me tonight”", ago(5)),
          item("demo-14", "Jerome Castillo", "1148 Griggs Rd", "“Let me think about it”", ago(3)),
        ],
      },
      overdue: {
        count: 3,
        items: [
          item("demo-7", "Patricia Okonkwo", "9201 Fondren Rd", "Follow-up overdue", ago(72)),
          item("demo-25", "Yolanda Price", "7420 Harrisburg Blvd", "Follow-up overdue", ago(30)),
        ],
      },
      upcoming: {
        count: 4,
        items: [
          item("demo-8", "Gloria Sampson", "6710 Scott St", "Follow-up scheduled", day(0.15)),
          item("demo-16", "Terrence Brooks", "8834 Long Point Rd", "Follow-up scheduled", day(1)),
          item("demo-9", "Walter Jennings", "4109 Mykawa Rd", "Follow-up scheduled", day(2.3)),
        ],
      },
      offers: {
        count: 4,
        items: [
          item("demo-21", "Angela Nguyen", "2901 Bellaire Blvd", "Offer sent — no reply yet", ago(22)),
          item("demo-22", "Ray Holloway", "610 Kelley St", "Offer sent — no reply yet", ago(40)),
        ],
      },
      hot: {
        count: 2,
        items: [item("demo-15", "Maria Santos", "3620 Cavalcade St", "Hot lead — no offer yet", null)],
      },
      atRisk: {
        count: 2,
        items: [
          item("demo-14", "Jerome Castillo", "1148 Griggs Rd", "Deadline in 6 days", null),
          item("demo-21", "Angela Nguyen", "2901 Bellaire Blvd", "Deadline in 12 days", null),
        ],
      },
    },
    conversations: [
      { leadId: "demo-13", name: "Darnell Williams", snippet: "Yeah that works, what time can you come by?", direction: "inbound", at: ago(1.2), sentiment: "interested", unread: true },
      { leadId: "demo-14", name: "Jerome Castillo", snippet: "Let me think about it", direction: "inbound", at: ago(3), sentiment: "maybe", unread: true },
      { leadId: "demo-15", name: "Maria Santos", snippet: "I already talked to my sister, call me tonight", direction: "inbound", at: ago(5), sentiment: "interested", unread: true },
      { leadId: "demo-21", name: "Angela Nguyen", snippet: "Hi Angela, just checking you saw the offer we sent over.", direction: "outbound", at: ago(22), sentiment: "maybe", unread: false },
      { leadId: "demo-7", name: "Patricia Okonkwo", snippet: "I already have an agent, please stop texting", direction: "inbound", at: ago(30), sentiment: "not_interested", unread: false },
      { leadId: "demo-9", name: "Walter Jennings", snippet: "Not sure yet — can you send more details?", direction: "inbound", at: ago(36), sentiment: "review", unread: false },
    ],
    activity: [
      { id: "a1", at: ago(0.2), kind: "lead", title: "New lead: Owen Fitzgerald", detail: "1421 Telephone Rd, Houston", leadId: "demo-5" },
      { id: "a2", at: ago(1.2), kind: "reply", title: "Reply from Darnell Williams", detail: "Yeah that works, what time can you come by?", leadId: "demo-13" },
      { id: "a3", at: ago(1.6), kind: "text", title: "Text sent to Helen Wu", detail: "Hi Helen, I'm a local buyer interested in 718 Wilcrest…", leadId: "demo-2" },
      { id: "a4", at: ago(3), kind: "reply", title: "Reply from Jerome Castillo", detail: "Let me think about it", leadId: "demo-14" },
      { id: "a5", at: ago(3.4), kind: "text", title: "Text sent to Isaiah Grant", detail: "Hi Isaiah, would you consider a cash offer…", leadId: "demo-3" },
      { id: "a6", at: ago(5), kind: "reply", title: "Reply from Maria Santos", detail: "I already talked to my sister, call me tonight", leadId: "demo-15" },
      { id: "a7", at: ago(6.5), kind: "text", title: "Text sent to Rosa Delgado", detail: "Hi Rosa, quick question about 9310 Hillcroft…", leadId: "demo-4" },
      { id: "a8", at: ago(8), kind: "lead", title: "New lead: Tasha Monroe", detail: "6605 Lyons Ave, Houston", leadId: "demo-7" },
    ],
    series: {
      days: Array.from({ length: 14 }, (_, index) => new Date(now.getTime() - (13 - index) * 86_400_000).toISOString().slice(0, 10)),
      contacted: [6, 9, 7, 12, 10, 4, 3, 11, 14, 12, 9, 15, 13, 11],
      replies: [1, 2, 1, 3, 2, 0, 1, 3, 4, 3, 2, 5, 4, 6],
      newLeads: [1, 0, 2, 1, 0, 3, 1, 2, 1, 2, 0, 3, 2, 4],
    },
    sample: true,
  };
}
