import { NextResponse } from "next/server";

import { withErrorHandling } from "@/lib/api";
import { getAuthedAdmin } from "@/lib/route-admin";

/** GET /api/messages/sentiments — { [telnyx message id]: sentiment } for the signed-in user's recent replies. */
export const GET = withErrorHandling("api/messages/sentiments", async () => {
  const auth = await getAuthedAdmin();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await auth.admin
    .from("reply_classifications")
    .select("message_id, sentiment")
    .eq("user_id", auth.user.id)
    .order("classified_at", { ascending: false })
    .limit(1000);
  // Before the automation migration is applied the table is missing: badges just don't show.
  if (error) return NextResponse.json({ sentiments: {} });
  const sentiments: Record<string, string> = {};
  for (const row of data ?? []) if (row.message_id && row.sentiment) sentiments[row.message_id] = row.sentiment;
  return NextResponse.json({ sentiments });
});
