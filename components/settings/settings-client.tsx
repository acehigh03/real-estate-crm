"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
];

interface SmsSettings {
  auto_send_enabled: boolean;
  send_window_start: string;
  send_window_end: string;
  timezone: string;
}

interface SettingsClientProps {
  initialSettings: SmsSettings;
}

export function SettingsClient({ initialSettings }: SettingsClientProps) {
  const [settings, setSettings] = useState<SmsSettings>({
    ...initialSettings,
    // Normalise to HH:MM so <input type="time"> works
    send_window_start: initialSettings.send_window_start.slice(0, 5),
    send_window_end: initialSettings.send_window_end.slice(0, 5),
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      const res = await fetch("/api/settings/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Failed to save.");
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="crm-page flex flex-1 flex-col overflow-hidden">
      <div className="crm-page-header flex shrink-0 items-center justify-between gap-4 px-6 py-4">
        <div>
          <h1 className="crm-header-title">Settings</h1>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-8">
        <div className="mx-auto max-w-xl">
          <form onSubmit={handleSubmit}>
            {/* SMS Automation card */}
            <div className="crm-card overflow-hidden rounded-[10px] border border-[#eaecf0] bg-white">
              <div className="border-b border-[#e8edf2] px-6 py-4">
                <h2 className="text-[14px] font-semibold text-[#1a1f36]">SMS Automation</h2>
                <p className="mt-0.5 text-[12px] text-[#6b7c93]">
                  Configure when outbound SMS messages are sent automatically.
                </p>
              </div>

              <div className="space-y-5 px-6 py-5">
                {/* Auto-send toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[13px] font-medium text-[#1a1f36]">Auto-send enabled</p>
                    <p className="text-[12px] text-[#6b7c93]">
                      Automatically send first-contact SMS within the send window.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setSettings((s) => ({ ...s, auto_send_enabled: !s.auto_send_enabled }))
                    }
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                      settings.auto_send_enabled ? "bg-[#00c08b]" : "bg-[#d1d5db]"
                    }`}
                    role="switch"
                    aria-checked={settings.auto_send_enabled}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 translate-x-0 rounded-full bg-white shadow ring-0 transition duration-200 ${
                        settings.auto_send_enabled ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Send window */}
                <div
                  className={`space-y-4 transition-opacity ${settings.auto_send_enabled ? "opacity-100" : "pointer-events-none opacity-40"}`}
                >
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1.5 block text-[12px] font-medium text-[#6b7c93] uppercase tracking-wide">
                        Window start
                      </label>
                      <Input
                        type="time"
                        value={settings.send_window_start}
                        onChange={(e) =>
                          setSettings((s) => ({ ...s, send_window_start: e.target.value }))
                        }
                        className="crm-input h-9 px-3"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[12px] font-medium text-[#6b7c93] uppercase tracking-wide">
                        Window end
                      </label>
                      <Input
                        type="time"
                        value={settings.send_window_end}
                        onChange={(e) =>
                          setSettings((s) => ({ ...s, send_window_end: e.target.value }))
                        }
                        className="crm-input h-9 px-3"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[12px] font-medium text-[#6b7c93] uppercase tracking-wide">
                      Timezone
                    </label>
                    <select
                      value={settings.timezone}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, timezone: e.target.value }))
                      }
                      className="crm-input h-9 w-full px-3"
                    >
                      {TIMEZONES.map((tz) => (
                        <option key={tz} value={tz}>
                          {tz.replace("_", " ")}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="border-t border-[#e8edf2] px-6 py-4">
                {error && (
                  <p className="mb-3 rounded-md bg-[#fef2f2] px-3 py-2 text-[12px] text-[#e5484d]">
                    {error}
                  </p>
                )}
                <div className="flex items-center gap-3">
                  <Button
                    type="submit"
                    disabled={saving}
                    className="h-9 rounded-[6px] border-none bg-[#00c08b] px-5 text-[13px] text-white hover:opacity-90 disabled:opacity-60"
                  >
                    {saving ? "Saving…" : "Save settings"}
                  </Button>
                  {saved && (
                    <span className="text-[12px] text-[#00c08b]">Saved successfully.</span>
                  )}
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
