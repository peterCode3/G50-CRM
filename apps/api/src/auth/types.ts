import type { GlobalRole, LocationRole } from '@g50golf/db';

export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  globalRole: GlobalRole;
  locations: { locationId: string; role: LocationRole }[];
}
