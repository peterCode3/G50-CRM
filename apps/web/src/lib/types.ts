export interface Location {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  description: string | null;
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
  isActive: boolean;
}

export interface SessionWithAvailability {
  id: string;
  serviceId: string;
  locationId: string;
  startTime: string;
  endTime: string;
  capacity: number | null;
  bookedCount: number;
  spotsLeft: number | null;
  isCancelled: boolean;
}

export interface Booking {
  id: string;
  sessionId: string;
  status: "CONFIRMED" | "CANCELLED" | "WAITLISTED" | "COMPLETED" | "NO_SHOW";
  priceCharged: string | null;
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
