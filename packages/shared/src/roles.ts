export const GLOBAL_ROLES = ["HQ_ADMIN", "LOCATION_ADMIN", "COACH", "CUSTOMER"] as const;
export type GlobalRole = (typeof GLOBAL_ROLES)[number];

export const LOCATION_ROLES = ["LOCATION_ADMIN", "COACH", "CUSTOMER"] as const;
export type LocationRole = (typeof LOCATION_ROLES)[number];

export const SERVICE_TYPES = ["CLASS", "APPOINTMENT"] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

export const BOOKING_STATUSES = [
  "CONFIRMED",
  "CANCELLED",
  "WAITLISTED",
  "COMPLETED",
  "NO_SHOW",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];
