const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";

/** Uploaded image URLs are API-relative ("/uploads/xyz.png") — resolve for <img src>. */
export function resolveImageUrl(url: string): string {
  return url.startsWith("http") ? url : `${API_URL}${url}`;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message =
      body?.message ?? (Array.isArray(body?.message) ? body.message.join(", ") : res.statusText);
    throw new ApiError(res.status, typeof message === "string" ? message : "Request failed");
  }

  return res.json() as Promise<T>;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  globalRole: "HQ_ADMIN" | "LOCATION_ADMIN" | "COACH" | "CUSTOMER";
  locations: { locationId: string; role: "LOCATION_ADMIN" | "COACH" | "CUSTOMER" }[];
  phone: string | null;
  dateOfBirth: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  homeLocationId: string | null;
  gender: string | null;
  referredBy: string | null;
  homePhone: string | null;
  workPhone: string | null;
  profileComplete: boolean;
}
