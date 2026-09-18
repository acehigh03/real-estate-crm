import { ScraperClient } from "@/components/scraper/scraper-client";

// Auth is enforced by the (dashboard) layout; data is loaded client-side, page by page,
// from /api/scraper/leads so the 16,000+ rows are never sent at once.
export default function ScraperPage() {
  return <ScraperClient />;
}
