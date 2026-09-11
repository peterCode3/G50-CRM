import type { ButtonHTMLAttributes } from "react";

const VARIANTS = {
  primary:
    "bg-gradient-to-r from-gold-300 to-gold-600 text-teal-900 shadow-md shadow-gold-900/20 hover:-translate-y-0.5 hover:from-gold-300 hover:to-gold-500 hover:shadow-lg hover:shadow-gold-900/30",
  secondary:
    "border-2 border-teal-300 text-teal-700 hover:-translate-y-0.5 hover:border-teal-400 hover:bg-teal-50 hover:shadow-md",
  ghost: "text-teal-700 hover:bg-teal-50",
  danger:
    "border-2 border-red-200 text-red-600 hover:-translate-y-0.5 hover:border-red-300 hover:bg-red-50 hover:shadow-md",
} as const;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS;
}

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return (
    <button
      className={`rounded-md px-4 py-2 text-sm font-semibold transition-all duration-200 active:translate-y-0 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:active:scale-100 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
