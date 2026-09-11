import type { ButtonHTMLAttributes } from "react";

const VARIANTS = {
  primary: "bg-gold-500 text-teal-900 hover:bg-gold-700 shadow-sm hover:shadow-md",
  secondary: "border-2 border-teal-600 bg-teal-50/60 text-teal-800 hover:bg-teal-100",
  ghost: "text-teal-700 hover:bg-teal-50",
} as const;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS;
}

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return (
    <button
      className={`rounded-md px-4 py-2 text-sm font-semibold transition-all duration-150 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
