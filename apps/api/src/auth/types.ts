import type { GlobalRole, LocationRole } from '@g50golf/db';

export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  globalRole: GlobalRole;
  locations: { locationId: string; role: LocationRole }[];
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
  /**
   * True once the fields WellnessLiving's "Complete profile information" gate
   * requires (phone, DOB, address, city, postal code, home location) are all
   * set — the frontend shows that gate before letting a golfer book until
   * this flips true.
   */
  profileComplete: boolean;
}
