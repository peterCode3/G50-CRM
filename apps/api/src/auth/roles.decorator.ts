import { SetMetadata } from '@nestjs/common';
import type { GlobalRole, LocationRole } from '@g50golf/db';

export const ROLES_KEY = 'roles';

/**
 * Marks a route as requiring one of the given roles. HQ_ADMIN always passes
 * (treated as a superuser). Roles that also exist as a LocationRole
 * (LOCATION_ADMIN, COACH, CUSTOMER) are additionally satisfied by a matching
 * per-location role, scoped to the `locationId` route param if present.
 */
export const Roles = (...roles: (GlobalRole | LocationRole)[]) =>
  SetMetadata(ROLES_KEY, roles);
