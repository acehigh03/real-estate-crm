import { redirect } from "next/navigation";

type QueryValue = string | string[] | undefined;

/**
 * Retains every historical Messenger deep link while routing daily work through Inbox.
 */
export default async function MessengerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, QueryValue>>;
}) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(await searchParams)) {
    if (Array.isArray(value)) value.forEach((item) => params.append(key, item));
    else if (value) params.set(key, value);
  }

  redirect(`/inbox${params.size ? `?${params.toString()}` : ""}`);
}
