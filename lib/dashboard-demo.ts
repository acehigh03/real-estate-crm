// Fictional sample data for /dashboard?demo=1 — built in memory per request, never written anywhere.
import { BOARD_COLUMNS } from "@/lib/board";
import type { BoardLead, DashboardData } from "@/lib/dashboard";

export function makeDemoDashboard(now = new Date()): DashboardData {
  const ago = (hours: number) => new Date(now.getTime() - hours * 3_600_000).toISOString();
  const ahead = (hours: number) => new Date(now.getTime() + hours * 3_600_000).toISOString();
  const lead = (n: number, first: string, last: string, address: string, stage: BoardLead["stage"], value: number | null, contacted: string | null, followUp: string | null): BoardLead => ({
    id: `demo-${n}`, first_name: first, last_name: last, phone: `+1713555${String(1000 + n)}`, property_address: address, city: "Houston", stage, status: "New",
    deal_value: value, last_contacted_at: contacted, next_follow_up_at: followUp, deadline: null, tag: null, lead_source: "Demo", updated_at: ago(n), created_at: ago(n * 30),
  });
  const cols: Record<string, BoardLead[]> = {
    new: [lead(1, "Marcus", "Bell", "4410 Larkspur Ln", "New", null, null, null), lead(2, "Ana", "Ruiz", "902 Fenway Dr", "New", 118000, null, null)],
    skip_traced: [],
    contacted: [lead(3, "Priya", "Nair", "77 Cedar Hollow Ct", "Contacted", 142000, ago(20), ahead(20)), lead(4, "Tom", "Hale", "5120 Bayou Bend", "Replied", 96000, ago(90), ago(5))],
    negotiating: [lead(5, "Gloria", "Sampson", "310 Kelley St", "Offer Sent", 187000, ago(240), ago(30)), lead(6, "Dean", "Ortiz", "18 Willow Pass", "Hot Lead", 231000, ago(6), ahead(48))],
  };
  const board = BOARD_COLUMNS.map((column) => {
    const leads = cols[column.key] ?? [];
    return { key: column.key, label: column.label, emptyText: column.emptyText, emptyHref: column.emptyHref, count: leads.length, value: leads.reduce((sum, item) => sum + Number(item.deal_value ?? 0), 0), leads };
  });
  const pipelineValue = board.reduce((sum, column) => sum + column.value, 0);
  return {
    newLeads: 2, unreadReplies: 3, followUpsDue: 2, offersSent: 1, pipelineValue, board,
    conversations: [
      { lead_id: "demo-6", name: "Dean Ortiz", phone: "+17135551006", preview: "Yes, call me after 5. What number are you offering?", at: ago(0.4), unread: true, direction: "inbound" },
      { lead_id: "demo-4", name: "Tom Hale", phone: "+17135551004", preview: "Who is this?", at: ago(3), unread: true, direction: "inbound" },
      { lead_id: "demo-3", name: "Priya Nair", phone: "+17135551003", preview: "Hi Priya, just following up about 77 Cedar Hollow Ct.", at: ago(20), unread: false, direction: "outbound" },
    ],
    today: { textsSent: 18, repliesReceived: 5, events: [] },
    atRisk: { count: 2, value: 187000 + 96000, overdueFollowUps: 1, staleOffers: 1, deals: [] },
    stats: { contacted: 64, replies: 11, offersSent: 1, pipelineValue },
  };
}
