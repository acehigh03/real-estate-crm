import { getContactsData } from "@/lib/data";
import { ContactsClient } from "@/components/contacts/contacts-client";

export default async function ContactsPage() {
  let leads: Awaited<ReturnType<typeof getContactsData>>["leads"] = [];
  let messages: Awaited<ReturnType<typeof getContactsData>>["messages"] = [];

  try {
    ({ leads, messages } = await getContactsData());
  } catch (error) {
    console.error("contacts page data failed:", error);
  }

  return <ContactsClient initialLeads={leads} initialMessages={messages} />;
}
