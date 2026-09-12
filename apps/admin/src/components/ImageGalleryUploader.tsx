"use client";

import { useRef, useState } from "react";
import { uploadImage, resolveImageUrl } from "@/lib/upload";
import { Spinner } from "./Spinner";

export function ImageGalleryUploader({
  images,
  onChange,
  label = "Photos",
}: {
  images: string[];
  onChange: (images: string[]) => void;
  label?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        uploaded.push(await uploadImage(file));
      }
      onChange([...images, ...uploaded]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function removeAt(index: number) {
    onChange(images.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-teal-900">{label}</span>
      <p className="text-xs text-teal-700/70">
        The first photo is used as the cover shown on cards.
      </p>
      <div className="flex flex-wrap gap-3">
        {images.map((url, i) => (
          <div
            key={url}
            className="group relative h-20 w-20 overflow-hidden rounded-md border border-teal-100"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={resolveImageUrl(url)} alt="" className="h-full w-full object-cover" />
            {i === 0 && (
              <span className="absolute inset-x-0 bottom-0 bg-teal-900/80 py-0.5 text-center text-[10px] font-medium text-white">
                Cover
              </span>
            )}
            <button
              type="button"
              onClick={() => removeAt(i)}
              className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs text-white opacity-0 transition group-hover:opacity-100"
              aria-label="Remove image"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-teal-300 text-teal-500 transition hover:border-gold-500 hover:text-gold-700 disabled:opacity-50"
        >
          {uploading ? (
            <Spinner />
          ) : (
            <>
              <span className="text-xl leading-none">+</span>
              <span className="text-[10px]">Add photo</span>
            </>
          )}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={onFilesSelected}
      />
    </div>
  );
}
