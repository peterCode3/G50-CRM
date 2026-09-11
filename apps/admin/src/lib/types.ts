export interface DayHours {
  closed: boolean;
  open: string;
  close: string;
}

export type OpeningHours = Record<
  "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday",
  DayHours
>;

export interface Location {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  description: string | null;
  logoUrl: string | null;
  openingHours: OpeningHours | null;
  isActive: boolean;
}

export interface ServiceTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  type: "CLASS" | "APPOINTMENT";
  defaultDurationMinutes: number;
  defaultCapacity: number | null;
  defaultPrice: string;
  defaultMemberPrice: string | null;
  isActive: boolean;
}

export interface Service {
  id: string;
  templateId: string | null;
  locationId: string;
  name: string;
  description: string | null;
  category: string | null;
  type: "CLASS" | "APPOINTMENT";
  durationMinutes: number;
  capacity: number | null;
  price: string;
  memberPrice: string | null;
  isActive: boolean;
}

export interface StaffMember {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "LOCATION_ADMIN" | "COACH" | "CUSTOMER";
}

export interface MySession {
  id: string;
  startTime: string;
  endTime: string;
  capacity: number | null;
  isCancelled: boolean;
  service: Service;
  location: Location;
}

export interface Session {
  id: string;
  serviceId: string;
  locationId: string;
  coachId: string | null;
  startTime: string;
  endTime: string;
  capacity: number | null;
  bookedCount: number;
  spotsLeft: number | null;
  isCancelled: boolean;
}

export interface MembershipPlan {
  id: string;
  locationId: string | null;
  name: string;
  type: "FREE_PAYG" | "LOCATION" | "GLOBAL" | "JUNIOR" | "CORPORATE";
  price: string;
  billingPeriod: "NONE" | "WEEKLY" | "MONTHLY" | "QUARTERLY" | "ANNUAL";
  crossLocationAccess: boolean;
  bookingWindowDays: number | null;
  includedCredits: number | null;
  isActive: boolean;
}

export interface CreditPackage {
  id: string;
  locationId: string | null;
  name: string;
  creditsIncluded: number;
  price: string;
  eligibleServiceType: "CLASS" | "APPOINTMENT" | null;
  expiryDays: number | null;
  isActive: boolean;
}

export type AttendanceStatus = "ATTENDED" | "ABSENT" | "LATE_CANCEL" | "NO_SHOW";

export interface RosterEntry {
  bookingId: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  bookingStatus: string;
  attendanceStatus: AttendanceStatus | null;
}
