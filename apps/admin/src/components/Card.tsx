export function Card({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-teal-100 bg-white shadow-sm ${className}`}>
      {title && (
        <div className="flex items-center justify-between border-b border-teal-50 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-teal-900">{title}</h2>
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}
