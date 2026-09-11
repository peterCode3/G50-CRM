"use client";

import { useEffect, useRef, useState } from "react";

export function DropdownMenu({
  items,
}: {
  items: { label: string; onClick: () => void; danger?: boolean }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="More actions"
        className="rounded-md p-1 text-teal-700/70 transition-all duration-150 hover:bg-teal-50 hover:text-teal-900 active:scale-90"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
          <circle cx="10" cy="4" r="1.5" />
          <circle cx="10" cy="10" r="1.5" />
          <circle cx="10" cy="16" r="1.5" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-44 origin-top-right animate-scale-in overflow-hidden rounded-md border border-teal-100 bg-white py-1 shadow-lg">
          {items.map((item) => (
            <button
              key={item.label}
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className={`block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-teal-50 ${
                item.danger ? "text-red-600" : "text-teal-900"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
