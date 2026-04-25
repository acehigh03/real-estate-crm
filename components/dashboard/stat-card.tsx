interface StatCardProps {
  label: string;
  value: string | number;
  hint: string;
}

export function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <div className="rounded-3xl border border-border bg-white p-6 shadow-card">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-3 text-4xl font-semibold tracking-tight">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{hint}</p>
    </div>
  );
}
