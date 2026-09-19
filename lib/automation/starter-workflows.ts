// Three starter drips, created once per user the first time they open /drips with none.
// They start as DRAFTS: nothing can send until the user reads them and activates one.
// Step 1 carries no opt-out text here — the sender appends "Reply STOP to opt out." to step 1 only.
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

type Admin = SupabaseClient<Database>;

const DAY = 1440;

export const STARTER_WORKFLOWS: Array<{ name: string; steps: Array<{ delay_minutes: number; message: string }> }> = [
  {
    name: "Cash Offer — 5 Touch",
    steps: [
      { delay_minutes: 0, message: "Hi [[first_name]], this is Sam, a local investor. Would you consider a cash offer for [[address]]?" },
      { delay_minutes: 2 * DAY, message: "Hey [[first_name]], Sam again. Still interested in [[address]]. No pressure, happy to share a number." },
      { delay_minutes: 3 * DAY, message: "[[first_name]], I can close fast and cover closing costs on [[address]]. Worth a quick chat?" },
      { delay_minutes: 5 * DAY, message: "Hi [[first_name]], if the timing isn't right for [[address]] just tell me and I'll check back later." },
      { delay_minutes: 7 * DAY, message: "Last note from me, [[first_name]]. If you ever want an offer on [[address]], text me here anytime. - Sam" },
    ],
  },
  {
    name: "Probate Outreach — 4 Touch",
    steps: [
      { delay_minutes: 0, message: "Hi [[first_name]], this is Sam, a local investor. I'm sorry for your loss. Are you handling [[address]]?" },
      { delay_minutes: 3 * DAY, message: "Hi [[first_name]], Sam here. Selling [[address]] as-is can save a lot of hassle. Want to hear how?" },
      { delay_minutes: 5 * DAY, message: "[[first_name]], I work with families on inherited homes and keep it simple. Open to a no-obligation offer on [[address]]?" },
      { delay_minutes: 10 * DAY, message: "Hi [[first_name]], I'll leave it with you. If [[address]] is ever on your mind, I'm one text away. - Sam" },
    ],
  },
  {
    name: "Tax Sale Rescue — 4 Touch",
    steps: [
      { delay_minutes: 0, message: "Hi [[first_name]], this is Sam, a local investor. I saw [[address]] may have back taxes. Can I help?" },
      { delay_minutes: 1 * DAY, message: "Hey [[first_name]], Sam again. There may still be time to settle things on [[address]] before a sale. Want to talk?" },
      { delay_minutes: 3 * DAY, message: "[[first_name]], I can make a cash offer on [[address]] and close before the deadline. Interested?" },
      { delay_minutes: 6 * DAY, message: "Hi [[first_name]], checking in one last time about [[address]]. Just reply if you'd like a fair offer. - Sam" },
    ],
  },
];

/**
 * Idempotent: does nothing if the user already has any workflow, and the unique (user_id, name)
 * index makes a double-load race harmless. Returns how many workflows it created.
 */
export async function ensureStarterWorkflows(admin: Admin, userId: string): Promise<number> {
  const { count, error: countError } = await admin.from("drip_workflows").select("id", { count: "exact", head: true }).eq("user_id", userId);
  if (countError || (count ?? 0) > 0) return 0;

  let created = 0;
  for (const starter of STARTER_WORKFLOWS) {
    const { data: workflow, error } = await admin
      .from("drip_workflows")
      .upsert({ user_id: userId, name: starter.name, status: "draft", continue_after_reply: false }, { onConflict: "user_id,name", ignoreDuplicates: true })
      .select("id")
      .maybeSingle();
    if (error || !workflow) continue; // lost a race to another load: it already exists
    const { error: stepsError } = await admin.from("drip_steps").insert(
      starter.steps.map((step, index) => ({ workflow_id: workflow.id, step_number: index + 1, delay_minutes: step.delay_minutes, message: step.message }))
    );
    if (stepsError) {
      await admin.from("drip_workflows").delete().eq("id", workflow.id);
      continue;
    }
    created += 1;
  }
  return created;
}
