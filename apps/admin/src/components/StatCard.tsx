export function StatCard({
  label,
  value,
  hint,
  delayMs = 0,
}: {
  label: string;
  value: string | number;
  hint?: string;
  /** Stagger entrance when several StatCards render together in a row. */
  delayMs?: number;
}) {
  return (
    <div
      style={{ animationDelay: `${delayMs}ms` }}
      className="animate-fade-in-up rounded-lg border border-teal-100 bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-md"
    >
      <p className="text-xs font-medium tracking-wide text-teal-700 uppercase">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-teal-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-teal-700/70">{hint}</p>}
    </div>
  );
}
