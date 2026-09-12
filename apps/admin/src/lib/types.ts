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
  images: string[];
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
  images: string[];
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
  images: string[];
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

export interface ReportOverview {
  range: { from: string; to: string };
  bookings: {
    total: number;
    byStatus: Record<"CONFIRMED" | "CANCELLED" | "WAITLISTED" | "COMPLETED" | "NO_SHOW", number>;
  };
  attendance: {
    total: number;
    byStatus: Record<AttendanceStatus, number>;
    attendanceRate: number | null;
  };
  revenue: {
    total: string;
    byDay: { date: string; amount: string }[];
  };
  classUtilisation: {
    serviceId: string;
    serviceName: string;
    type: "CLASS" | "APPOINTMENT";
    totalBooked: number;
    totalCapacity: number | null;
    utilisationPct: number | null;
  }[];
  coachActivity: {
    coachId: string;
    name: string;
    sessionsRun: number;
    bookingsHandled: number;
    attendanceMarked: number;
  }[];
  memberships: { activeCount: number; expiredOrCancelledCount: number };
}

export type BookingStatus = "CONFIRMED" | "CANCELLED" | "WAITLISTED" | "COMPLETED" | "NO_SHOW";

export interface AdminBooking {
  id: string;
  sessionId: string;
  userId: string;
  status: BookingStatus;
  priceCharged: string | null;
  createdAt: string;
  cancelledAt: string | null;
  cancellationReason: string | null;
  user: { id: string; firstName: string; lastName: string; email: string };
  location: { id: string; name: string };
  session: { startTime: string; endTime: string; service: { id: string; name: string; type: "CLASS" | "APPOINTMENT" } };
}

export interface CustomerSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  _count: { bookings: number };
}

export interface CustomerDetail {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  dateOfBirth: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  homeLocationId: string | null;
  gender: string | null;
  isActive: boolean;
  createdAt: string;
  bookings: (Omit<AdminBooking, "user">)[];
  memberships: {
    id: string;
    status: "ACTIVE" | "EXPIRED" | "CANCELLED";
    startDate: string;
    endDate: string | null;
    plan: MembershipPlan;
  }[];
  creditBalances: {
    id: string;
    creditsRemaining: number;
    expiresAt: string | null;
    package: CreditPackage | null;
  }[];
}

export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED";
export type PaymentPurpose = "BOOKING" | "MEMBERSHIP" | "PACKAGE";

export interface AdminPayment {
  id: string;
  userId: string;
  bookingId: string | null;
  amount: string;
  currency: string;
  status: PaymentStatus;
  purpose: PaymentPurpose;
  provider: string;
  providerRef: string | null;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string; email: string };
  booking: {
    location: { id: string; name: string };
    session: { service: { name: string } };
  } | null;
}
