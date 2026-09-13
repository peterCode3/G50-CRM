const VARIANTS = {
  success: "bg-green-50 text-green-700",
  neutral: "bg-teal-50 text-teal-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-600",
  gold: "bg-gold-50 text-gold-900",
} as const;

export function Badge({
  children,
  variant = "neutral",
  className = "",
}: {
  children: React.ReactNode;
  variant?: keyof typeof VARIANTS;
  className?: string;
}) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${VARIANTS[variant]} ${className}`}>
      {children}
    </span>
  );
}
