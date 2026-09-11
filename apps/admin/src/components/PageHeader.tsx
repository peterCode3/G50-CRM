export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-teal-100 bg-white px-8 py-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-teal-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-teal-700">{description}</p>}
      </div>
      {action}
    </div>
  );
}
