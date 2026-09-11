import type { ButtonHTMLAttributes } from "react";

const VARIANTS = {
  primary:
    "bg-gradient-to-r from-gold-300 to-gold-600 text-teal-900 shadow-md shadow-gold-900/20 hover:-translate-y-0.5 hover:from-gold-300 hover:to-gold-500 hover:shadow-lg hover:shadow-gold-900/30",
  secondary:
    "border-2 border-teal-600 bg-teal-50/60 text-teal-800 hover:-translate-y-0.5 hover:bg-teal-100 hover:shadow-md",
  ghost: "text-teal-700 hover:bg-teal-50",
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
