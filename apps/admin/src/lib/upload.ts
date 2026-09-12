import { ApiError } from "./api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";

/**
 * Separate from apiFetch on purpose — apiFetch always forces a JSON
 * Content-Type header, which would break a multipart upload (the browser
 * needs to set its own boundary when the body is FormData).
 */
export async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_URL}/uploads/image`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body?.message ?? "Upload failed");
  }

  const data = (await res.json()) as { url: string };
  return data.url;
}

/** Uploaded image URLs are API-relative ("/uploads/xyz.png") — resolve for <img src>. */
export function resolveImageUrl(url: string): string {
  return url.startsWith("http") ? url : `${API_URL}${url}`;
}

