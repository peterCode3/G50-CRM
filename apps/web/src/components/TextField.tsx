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
    <label className={`flex flex-col gap-1.5 text-sm ${className}`}>
      <span className="font-medium text-teal-900">{label}</span>
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-teal-400">
            {icon}
          </span>
        )}
        <input
          className={`w-full rounded-md border border-teal-300 py-2.5 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 ${
            icon ? "pl-9 pr-3" : "px-3"
          }`}
          {...props}
        />
      </div>
      {hint && <span className="text-xs text-teal-700/70">{hint}</span>}
    </label>
  );
}
