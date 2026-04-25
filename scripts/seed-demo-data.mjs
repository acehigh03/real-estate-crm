import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

async function loadEnvFile(filename) {
  try {
    const contents = await readFile(path.join(rootDir, filename), "utf8");

    for (const rawLine of contents.split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;

      const separatorIndex = line.indexOf("=");
      if (separatorIndex === -1) continue;

      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");

      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch {
    return;
  }
}

function daysFromToday(offset) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

async function main() {
  await loadEnvFile(".env.local");
  await loadEnvFile(".env");

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const demoUserEmail = process.env.DEMO_USER_EMAIL;

  if (!supabaseUrl || !serviceRoleKey || !demoUserEmail) {
    throw new Error(
      "Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or DEMO_USER_EMAIL. Add them to .env.local before running the seed."
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const {
    data: { users },
    error: userError
  } = await supabase.auth.admin.listUsers();

  if (userError) {
    throw userError;
  }

  const demoUser = users.find((user) => user.email?.toLowerCase() === demoUserEmail.toLowerCase());

  if (!demoUser) {
    throw new Error(
      `No Supabase Auth user found for ${demoUserEmail}. Sign up in the app first, then run this script again.`
    );
  }

  const { data: existingDemoLeads, error: existingError } = await supabase
    .from("leads")
    .select("id")
    .eq("user_id", demoUser.id)
    .eq("tag", "demo");

  if (existingError) {
    throw existingError;
  }

  const existingLeadIds = (existingDemoLeads ?? []).map((lead) => lead.id);

  if (existingLeadIds.length) {
    await supabase.from("followups").delete().in("lead_id", existingLeadIds);
    await supabase.from("notes").delete().in("lead_id", existingLeadIds);
    await supabase.from("messages").delete().in("lead_id", existingLeadIds);
    await supabase.from("leads").delete().in("id", existingLeadIds);
  }

  const leadPayload = [
    {
      user_id: demoUser.id,
      first_name: "Martha",
      last_name: "Hill",
      property_address: "1423 Cedar Ridge Dr, Dallas, TX 75217",
      mailing_address: "1423 Cedar Ridge Dr, Dallas, TX 75217",
      phone: "(214) 555-0101",
      phone_normalized: "+12145550101",
      email: "martha.demo@example.com",
      lead_source: "Demo Seed",
      status: "New",
      tag: "demo",
      notes_summary: "Inherited property. Open to a quick close.",
      follow_up_date: daysFromToday(1)
    },
    {
      user_id: demoUser.id,
      first_name: "Andre",
      last_name: "Coleman",
      property_address: "809 W Laurel St, San Antonio, TX 78212",
      mailing_address: "PO Box 4421, San Antonio, TX 78212",
      phone: "(210) 555-0102",
      phone_normalized: "+12105550102",
      email: "andre.demo@example.com",
      lead_source: "Driving for Dollars",
      status: "Contacted",
      tag: "demo",
      notes_summary: "Vacant for 6 months. Wants cash offer.",
      follow_up_date: daysFromToday(0)
    },
    {
      user_id: demoUser.id,
      first_name: "Lisa",
      last_name: "Nguyen",
      property_address: "5502 Spring Brook Ln, Houston, TX 77041",
      mailing_address: "5502 Spring Brook Ln, Houston, TX 77041",
      phone: "(832) 555-0103",
      phone_normalized: "+18325550103",
      email: "lisa.demo@example.com",
      lead_source: "SMS Reply",
      status: "Replied",
      tag: "demo",
      notes_summary: "Asked for price range and timeline.",
      follow_up_date: daysFromToday(0)
    },
    {
      user_id: demoUser.id,
      first_name: "Jerome",
      last_name: "Parker",
      property_address: "923 Elmwood Ave, Fort Worth, TX 76104",
      mailing_address: "923 Elmwood Ave, Fort Worth, TX 76104",
      phone: "(817) 555-0104",
      phone_normalized: "+18175550104",
      email: "jerome.demo@example.com",
      lead_source: "Cold Calling",
      status: "Hot",
      tag: "demo",
      notes_summary: "Motivated seller. Wants to close within 2 weeks.",
      follow_up_date: daysFromToday(0)
    },
    {
      user_id: demoUser.id,
      first_name: "Sandra",
      last_name: "Lopez",
      property_address: "311 Palm View Ct, Austin, TX 78744",
      mailing_address: "311 Palm View Ct, Austin, TX 78744",
      phone: "(512) 555-0105",
      phone_normalized: "+15125550105",
      email: "sandra.demo@example.com",
      lead_source: "Website Form",
      status: "DNC",
      tag: "demo",
      notes_summary: "Opted out previously.",
      follow_up_date: null
    }
  ];

  const { data: insertedLeads, error: insertError } = await supabase
    .from("leads")
    .insert(leadPayload)
    .select("*");

  if (insertError) {
    throw insertError;
  }

  const leadsByPhone = new Map(insertedLeads.map((lead) => [lead.phone_normalized, lead]));

  const notesPayload = [
    {
      user_id: demoUser.id,
      lead_id: leadsByPhone.get("+12105550102").id,
      body: "Left voicemail on first attempt."
    },
    {
      user_id: demoUser.id,
      lead_id: leadsByPhone.get("+18325550103").id,
      body: "Seller replied and asked for ballpark offer range."
    },
    {
      user_id: demoUser.id,
      lead_id: leadsByPhone.get("+18175550104").id,
      body: "Strong motivation signal. Prioritize follow-up this morning."
    }
  ];

  const messagePayload = [
    {
      user_id: demoUser.id,
      lead_id: leadsByPhone.get("+12105550102").id,
      direction: "outbound",
      body: "Hi Andre, are you open to an offer on your property? Reply STOP to opt out.",
      to_number: "+12105550102",
      status: "delivered",
      telnyx_message_id: "demo-outbound-1"
    },
    {
      user_id: demoUser.id,
      lead_id: leadsByPhone.get("+18325550103").id,
      direction: "outbound",
      body: "Hi Lisa, would you consider a cash offer for your property? Reply STOP to opt out.",
      to_number: "+18325550103",
      status: "delivered",
      telnyx_message_id: "demo-outbound-2"
    },
    {
      user_id: demoUser.id,
      lead_id: leadsByPhone.get("+18325550103").id,
      direction: "inbound",
      body: "Yes, what price range are you thinking?",
      to_number: "+18325550103",
      status: "received",
      telnyx_message_id: "demo-inbound-1"
    },
    {
      user_id: demoUser.id,
      lead_id: leadsByPhone.get("+18175550104").id,
      direction: "outbound",
      body: "Hi Jerome, I can make an as-is offer and close quickly. Reply STOP to opt out.",
      to_number: "+18175550104",
      status: "delivered",
      telnyx_message_id: "demo-outbound-3"
    }
  ];

  const followupPayload = [
    {
      user_id: demoUser.id,
      lead_id: leadsByPhone.get("+12145550101").id,
      due_date: daysFromToday(1),
      note: "Send first outreach tomorrow morning."
    },
    {
      user_id: demoUser.id,
      lead_id: leadsByPhone.get("+12105550102").id,
      due_date: daysFromToday(0),
      note: "Second touch after voicemail."
    },
    {
      user_id: demoUser.id,
      lead_id: leadsByPhone.get("+18175550104").id,
      due_date: daysFromToday(0),
      note: "Call hot lead before noon."
    }
  ];

  const [{ error: notesError }, { error: messagesError }, { error: followupsError }] = await Promise.all([
    supabase.from("notes").insert(notesPayload),
    supabase.from("messages").insert(messagePayload),
    supabase.from("followups").insert(followupPayload)
  ]);

  if (notesError) throw notesError;
  if (messagesError) throw messagesError;
  if (followupsError) throw followupsError;

  console.log(`Seeded ${insertedLeads.length} demo leads for ${demoUserEmail}.`);
  console.log("You can now sign in and test the dashboard, inbox, notes, and follow-ups.");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
