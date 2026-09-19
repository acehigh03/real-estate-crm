import { NextResponse } from "next/server";

import { withErrorHandling } from "@/lib/api";
import { getUnreadBadgeCount } from "@/lib/dashboard";
import { getRouteUser } from "@/lib/route-user";

export const dynamic = "force-dynamic";

/** GET /api/messages/unread-count — live number for the sidebar's Messenger badge. */
export const GET = withErrorHandling("api/messages/unread-count", async () => {
  const { user } = await getRouteUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ count: await getUnreadBadgeCount() });
});
