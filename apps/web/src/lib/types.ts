export interface Location {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  description: string | null;
  images: string[];
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
  status: "CONFIRMED" | "CANCELLED" | "WAITLISTED" | "COMPLETED" | "NO_SHOW";
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
