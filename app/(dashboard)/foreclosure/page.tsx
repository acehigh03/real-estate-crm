"use client";
import { useState, useEffect } from "react";

const SUPABASE_URL = "https://wdbxxjfgitlxeoluvanf.supabase.co";
const SUPABASE_KEY = "sb_publishable_MOUuWYsrkyObvr-c487q3Q_duA0JBah";
const PAGE_SIZE = 20;
const today = new Date().toISOString().slice(0, 10);

type Lead = {
  id: number;
  case_number?: string;
  hcad_account?: string;
  address?: string;
  full_name?: string;
  taxes_owed?: string;
  property_value?: string;
  filing_date?: string;
  scraped_date?: string;
  status?: string;
  notes?: string;
};

function LeadRow({ r, onSave }: { r: Lead; onSave: (id: number, status: string, notes: string) => Promise<void> }) {
  const [localStatus, setLocalStatus] = useState(r.status || "New");
  const [localNotes, setLocalNotes] = useState(r.notes || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const isToday = r.scraped_date?.slice(0,10) === today;
  const fmt = (v?: string) => v || "—";
  const fmtDate = (d?: string) => d ? d.slice(0,10) : "—";
  const fmtMoney = (v?: string) => { if (!v) return "—"; const n = parseFloat(v); return isNaN(n) ? v : "$" + Math.round(n).toLocaleString(); };

  async function save() {
    setSaving(true);
    await onSave(r.id, localStatus, localNotes);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <tr className={isToday ? "bg-[#f0fdf4]" : "bg-white hover:bg-[#f8fafb]"}>
      <td className="px-3 py-2 border-b border-[#f0f2f5] truncate">{fmt(r.case_number)}</td>
      <td className="px-3 py-2 border-b border-[#f0f2f5] truncate">{fmt(r.hcad_account)}</td>
      <td className="px-3 py-2 border-b border-[#f0f2f5] truncate">{fmt(r.address)}</td>
      <td className="px-3 py-2 border-b border-[#f0f2f5] truncate">{fmt(r.full_name)}</td>
      <td className="px-3 py-2 border-b border-[#f0f2f5]">{fmtMoney(r.taxes_owed)}</td>
      <td className="px-3 py-2 border-b border-[#f0f2f5]">{fmtMoney(r.property_value)}</td>
      <td className="px-3 py-2 border-b border-[#f0f2f5]">{fmtDate(r.filing_date)}</td>
      <td className="px-3 py-2 border-b border-[#f0f2f5]">{fmtDate(r.scraped_date)}</td>
      <td className="px-3 py-2 border-b border-[#f0f2f5]">
        <select value={localStatus} onChange={e => setLocalStatus(e.target.value)}
          className="w-full text-[11px] px-1 py-1 border border-[#e8edf2] rounded-md bg-white focus:outline-none focus:border-[#00c08b]">
          {["New","Contacted","Interested","Not Interested","Follow Up"].map(s => <option key={s}>{s}</option>)}
        </select>
      </td>
      <td className="px-3 py-2 border-b border-[#f0f2f5]">
        <input type="text" value={localNotes} onChange={e => setLocalNotes(e.target.value)} placeholder="notes..."
          className="w-full text-[11px] px-2 py-1 border border-[#e8edf2] rounded-md bg-white focus:outline-none focus:border-[#00c08b]" />
      </td>
      <td className="px-3 py-2 border-b border-[#f0f2f5]">
        <button onClick={save} disabled={saving}
          className={"text-[11px] px-2 py-1 border rounded-md " + (saved ? "border-[#00c08b] text-[#00c08b] bg-[#f0fdf4]" : "border-[#e8edf2] text-[#6b7c93] hover:bg-[#f0f2f5]")}>
          {saving ? "..." : saved ? "Saved" : "Save"}
        </button>
      </td>
    </tr>
  );
}

export default function ForeclosurePage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filtered, setFiltered] = useState<Lead[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => { loadLeads(); }, []);

  useEffect(() => {
    let f = leads;
    if (search) f = f.filter(r => ["address","case_number","hcad_account","full_name"].some(k => (r[k as keyof Lead] as string || "").toLowerCase().includes(search.toLowerCase())));
    if (statusFilter) f = f.filter(r => (r.status || "New") === statusFilter);
    if (dateFrom) f = f.filter(r => r.scraped_date && r.scraped_date.slice(0,10) >= dateFrom);
    if (dateTo) f = f.filter(r => r.scraped_date && r.scraped_date.slice(0,10) <= dateTo);
    setFiltered(f);
    setPage(0);
  }, [search, statusFilter, dateFrom, dateTo, leads]);

  async function loadLeads() {
    const resp = await fetch(SUPABASE_URL + "/rest/v1/foreclosure_leads?select=*&order=scraped_date.desc&limit=1000", {
      headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY }
    });
    setLeads(await resp.json());
  }

  async function saveRow(id: number, status: string, notes: string) {
    await fetch(SUPABASE_URL + "/rest/v1/foreclosure_leads?id=eq." + id, {
      method: "PATCH",
      headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ status, notes })
    });
    setLeads(l => l.map(r => r.id === id ? { ...r, status, notes } : r));
  }

  function exportCSV() {
    const cols = ["id","case_number","hcad_account","full_name","address","filing_date","property_value","taxes_owed","scraped_date","status","notes"];
    const esc = (v: unknown) => { if (!v && v !== 0) return ""; const s = String(v); return s.includes(",") || s.includes('"') || s.includes("\n") ? "\"" + s.replace(/"/g, '\"\"') + "\""  : s; };
    const rows = [cols.join(","), ...filtered.map(r => cols.map(c => esc(r[c as keyof Lead])).join(","))];
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv" }));
    a.download = "foreclosure_leads_" + today + ".csv";
    a.click();
  }

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const slice = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const todayCount = leads.filter(r => r.scraped_date?.slice(0,10) === today).length;
  const intCount = leads.filter(r => r.status === "Interested").length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between border-b px-6 py-4">
        <h1 className="text-[15px] font-semibold text-[#1a1f36]">Foreclosure Leads</h1>
        <button onClick={exportCSV} className="text-[13px] px-3 py-1.5 border border-[#e8edf2] rounded-lg text-[#6b7c93] hover:bg-[#f0f2f5]">Export CSV</button>
      </div>
      <div className="p-6 overflow-auto flex-1">
        <div className="grid grid-cols-4 gap-3 mb-5">
          {[["Total Leads", leads.length],["Filtered", filtered.length],["New Today", todayCount],["Interested", intCount]].map(([l,v]) => (
            <div key={String(l)} className="bg-[#f8fafb] rounded-xl p-4 border border-[#e8edf2]">
              <p className="text-[11px] text-[#6b7c93] mb-1">{l}</p>
              <p className="text-[22px] font-semibold text-[#1a1f36]">{v}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          <input type="text" placeholder="Search address, case #, HCAD..." value={search} onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] px-3 py-1.5 border border-[#e8edf2] rounded-lg text-[13px] text-[#1a1f36] bg-white focus:outline-none focus:border-[#00c08b]" />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 border border-[#e8edf2] rounded-lg text-[13px] text-[#1a1f36] bg-white focus:outline-none">
            <option value="">All statuses</option>
            {["New","Contacted","Interested","Not Interested","Follow Up"].map(s => <option key={s}>{s}</option>)}
          </select>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-3 py-1.5 border border-[#e8edf2] rounded-lg text-[13px] bg-white focus:outline-none" />
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-3 py-1.5 border border-[#e8edf2] rounded-lg text-[13px] bg-white focus:outline-none" />
          <button onClick={() => { setSearch(""); setStatusFilter(""); setDateFrom(""); setDateTo(""); }} className="px-3 py-1.5 border border-[#e8edf2] rounded-lg text-[13px] text-[#6b7c93] hover:bg-[#f0f2f5]">Clear</button>
          <button onClick={loadLeads} className="px-3 py-1.5 border border-[#e8edf2] rounded-lg text-[13px] text-[#6b7c93] hover:bg-[#f0f2f5]">Refresh</button>
        </div>
        <div className="border border-[#e8edf2] rounded-xl overflow-x-auto">
          <table className="w-full text-[12px]" style={{tableLayout:"fixed"}}>
            <thead>
              <tr className="bg-[#f8fafb]">
                {["Case #","HCAD Acct","Address","Owner","Taxes Owed","Prop Value","Filing","Scraped","Status","Notes","Save"].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-[11px] font-medium text-[#6b7c93] border-b border-[#e8edf2] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slice.map(r => <LeadRow key={r.id} r={r} onSave={saveRow} />)}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-3 mt-4 text-[12px] text-[#6b7c93]">
          <button onClick={() => setPage(p => Math.max(0,p-1))} className="px-3 py-1.5 border border-[#e8edf2] rounded-lg hover:bg-[#f0f2f5]">Prev</button>
          <span>Page {page+1} of {Math.max(1,totalPages)}</span>
          <button onClick={() => setPage(p => Math.min(totalPages-1,p+1))} className="px-3 py-1.5 border border-[#e8edf2] rounded-lg hover:bg-[#f0f2f5]">Next</button>
          <span>{filtered.length} leads</span>
        </div>
      </div>
    </div>
  );
}