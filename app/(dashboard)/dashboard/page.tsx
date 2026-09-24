import { redirect } from "next/navigation";

/** Inbox is the operating home. Keep this route for old bookmarks and links. */
export default function DashboardPage() {
  redirect("/inbox");
}
