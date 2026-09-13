"use client";

import { useRef, useState } from "react";
import { uploadImage, resolveImageUrl } from "@/lib/upload";
import { Spinner } from "./Spinner";

export function LogoUploader({
  logoUrl,
  onChange,
  label = "Logo",
}: {
  logoUrl: string;
  onChange: (logoUrl: string) => void;
  label?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      onChange(await uploadImage(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-teal-900">{label}</span>
      <div className="flex items-center gap-3">
        {logoUrl ? (
          <div className="group relative h-16 w-16 overflow-hidden rounded-lg border border-teal-100 bg-white p-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={resolveImageUrl(logoUrl)} alt="" className="h-full w-full object-contain" />
            <button
              type="button"
              onClick={() => onChange("")}
              className="absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-[10px] text-white opacity-0 transition group-hover:opacity-100"
              aria-label="Remove logo"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-lg border-2 border-dashed border-teal-300 text-teal-500 transition hover:border-gold-500 hover:text-gold-700 disabled:opacity-50"
          >
            {uploading ? (
              <Spinner />
            ) : (
              <>
                <span className="text-lg leading-none">+</span>
                <span className="text-[9px]">Upload</span>
              </>
            )}
          </button>
        )}
        {logoUrl && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="text-xs font-medium text-teal-700 hover:underline disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "Replace"}
          </button>
        )}
      </div>
      <p className="text-xs text-teal-700/70">
        A small brand mark shown next to the location name — separate from the photo gallery.
      </p>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={onFileSelected}
      />
    </div>
  );
}
