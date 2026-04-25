import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { parseLeadCsv } from "@/lib/csv/parse-leads";
import { getRouteUser } from "@/lib/route-user";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const supabaseAdmin = getSupabaseAdmin();
  const { user } = await getRouteUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "CSV file is required" }, { status: 400 });
  }

  const csvText = await file.text();
  const parsedRows = parseLeadCsv(csvText);

  const payload = parsedRows.map((row) => ({
    ...row,
    user_id: user.id
  }));

  const { data, error } = await supabaseAdmin
    .from("leads")
    .upsert(payload, { onConflict: "user_id,phone_normalized" })
    .select("id, user_id, notes_summary");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const noteRows = (data ?? [])
    .filter((lead) => lead.notes_summary)
    .map((lead) => ({
      lead_id: lead.id,
      user_id: lead.user_id,
      body: lead.notes_summary as string
    }));

  if (noteRows.length) {
    await supabaseAdmin.from("notes").insert(noteRows);
  }

  revalidatePath("/dashboard");
  revalidatePath("/leads");
  revalidatePath("/inbox");

  return NextResponse.json({ success: true, inserted: payload.length });
}
