import { NextResponse } from "next/server";

import { withErrorHandling } from "@/lib/api";
import { getAuthedAdmin } from "@/lib/route-admin";

/** GET /api/leads/search?q=  — the signed-in user's leads by name, phone or address (max 10). */
export const GET = withErrorHandling("api/leads/search", async (request: Request) => {
  const auth = await getAuthedAdmin();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Strip characters that would break PostgREST's or=(...) grammar.
  const q = (new URL(request.url).searchParams.get("q") ?? "").replace(/[%*,()"\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
  if (q.length < 2) return NextResponse.json({ leads: [] });

  const term = `*${q}*`;
  const { data, error } = await auth.admin
    .from("leads")
    .select("id, first_name, last_name, phone, property_address, city, is_dnc, status")
    .eq("user_id", auth.user.id)
    .or(`first_name.ilike.${term},last_name.ilike.${term},phone.ilike.${term},property_address.ilike.${term}`)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) return NextResponse.json({ error: "Search failed. Please try again." }, { status: 500 });
  return NextResponse.json({ leads: data ?? [] });
});
