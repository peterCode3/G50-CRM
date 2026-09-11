import type { InputHTMLAttributes, ReactNode } from "react";

export function TextField({
  label,
  icon,
  hint,
  className = "",
  ...props
}: {
  label: string;
  icon?: ReactNode;
  hint?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`group flex flex-col gap-1.5 text-sm ${className}`}>
      <span className="font-medium text-teal-900">{label}</span>
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute top-1/2 left-2.5 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-teal-50 text-teal-500 transition-colors group-focus-within:bg-gold-100 group-focus-within:text-gold-900">
            {icon}
          </span>
        )}
        <input
          className={`w-full rounded-md border-2 border-teal-200 py-2.5 outline-none transition-all duration-150 focus:border-gold-500 focus:ring-4 focus:ring-gold-500/15 disabled:bg-teal-50/60 disabled:text-teal-500 ${
            icon ? "pl-11 pr-3" : "px-3"
          }`}
          {...props}
        />
      </div>
      {hint && <span className="text-xs text-teal-700/70">{hint}</span>}
    </label>
  );
}
