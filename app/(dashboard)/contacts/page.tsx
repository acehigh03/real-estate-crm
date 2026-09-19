import { redirect } from "next/navigation";

import { ContactsTable } from "@/components/contacts/contacts-table";
import { getAllLeads } from "@/lib/dashboard";
import { logError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let leads: Database["public"]["Tables"]["leads"]["Row"][] = [];
  let loadError = "";
  try {
    leads = await getAllLeads();
  } catch (error) {
    logError("contacts page", error);
    loadError = "Contacts couldn't be loaded. Please refresh.";
  }

  return <ContactsTable initialLeads={leads} loadError={loadError} />;
}
