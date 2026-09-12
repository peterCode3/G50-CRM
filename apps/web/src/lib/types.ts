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

export interface Service {
  id: string;
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

export interface SessionWithAvailability {
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
  coach: { id: string; firstName: string; lastName: string } | null;
}

export interface Booking {
  id: string;
  sessionId: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "WAITLISTED" | "COMPLETED" | "NO_SHOW";
  priceCharged: string | null;
  userMembershipId: string | null;
  createdAt: string;
  cancelledAt: string | null;
  session: SessionWithAvailability & {
    service: Service;
    location: Location;
  };
}

export interface WaitlistEntry {
  id: string;
  sessionId: string;
  position: number;
  status: "WAITING" | "NOTIFIED" | "CLAIMED" | "EXPIRED";
  notifiedAt: string | null;
  session: SessionWithAvailability & {
    service: Service;
    location: Location;
  };
}

export interface MembershipPlan {
  id: string;
  locationId: string | null;
  name: string;
  type: "FREE_PAYG" | "LOCATION" | "GLOBAL" | "JUNIOR" | "CORPORATE";
  price: string;
  billingPeriod: "NONE" | "WEEKLY" | "MONTHLY" | "QUARTERLY" | "ANNUAL";
  crossLocationAccess: boolean;
  includedCredits: number | null;
  isActive: boolean;
}

export interface UserMembership {
  id: string;
  planId: string;
  startDate: string;
  endDate: string | null;
  autoRenew: boolean;
  status: "ACTIVE" | "EXPIRED" | "CANCELLED";
  plan: MembershipPlan;
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

export interface CreditBalance {
  id: string;
  packageId: string | null;
  creditsRemaining: number;
  expiresAt: string | null;
  package: CreditPackage | null;
}

export type BookingPaymentMethod = "FULL_PRICE" | "MEMBERSHIP" | "CREDIT";

export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED";
export type PaymentPurpose = "BOOKING" | "MEMBERSHIP" | "PACKAGE";

export interface PaymentSummary {
  id: string;
  amount: string;
  currency: string;
  status: PaymentStatus;
  purpose: PaymentPurpose;
  createdAt: string;
}

export interface PaymentReceipt extends PaymentSummary {
  provider: string;
  providerRef: string | null;
  user: { firstName: string; lastName: string; email: string };
  booking: {
    location: { name: string };
    session: { startTime: string; service: { name: string; type: "CLASS" | "APPOINTMENT" } };
  } | null;
  userMembership: { plan: { name: string } } | null;
  creditBalance: { package: { name: string } | null } | null;
}
