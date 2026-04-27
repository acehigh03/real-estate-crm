import { NextResponse } from "next/server";
import { z } from "zod";

import { getRouteUser } from "@/lib/route-user";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const createCampaignSchema = z.object({
  name: z.string().trim().min(1, "Campaign name is required"),
  campaign_type: z.enum(["cash_offer", "foreclosure_help", "probate", "tax_sale", "custom"]),
  first_sms_template: z.string().trim().min(1, "First SMS template is required"),
  followup_1_template: z.string().trim().optional().nullable(),
  followup_2_template: z.string().trim().optional().nullable(),
  followup_3_template: z.string().trim().optional().nullable(),
  template_variant: z.string().trim().min(1).optional().nullable(),
  status: z.string().trim().min(1).optional()
});

export async function GET() {
  const { user } = await getRouteUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ campaigns: data ?? [] });
}

export async function POST(request: Request) {
  const { user } = await getRouteUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createCampaignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      campaign_type: parsed.data.campaign_type,
      first_sms_template: parsed.data.first_sms_template,
      followup_1_template: parsed.data.followup_1_template ?? null,
      followup_2_template: parsed.data.followup_2_template ?? null,
      followup_3_template: parsed.data.followup_3_template ?? null,
      template_variant: parsed.data.template_variant ?? null,
      status: parsed.data.status ?? "active"
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ campaign: data }, { status: 201 });
}
