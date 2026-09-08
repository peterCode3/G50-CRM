export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-teal-100 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium tracking-wide text-teal-700 uppercase">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-teal-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-teal-700/70">{hint}</p>}
    </div>
  );
}
