// Alias for the Telnyx webhook. The handler (signature check, save-first, always-200, then the
// automation pipeline) lives in /api/telnyx/inbound; either URL can be configured in Telnyx.
export { POST } from "@/app/api/telnyx/inbound/route";
