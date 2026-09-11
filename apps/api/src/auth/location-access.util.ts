import { ForbiddenException } from '@nestjs/common';
import { GlobalRole, LocationRole } from '@g50golf/db';
import type { AuthenticatedUser } from './types.js';

/**
 * Precise per-resource check for routes addressed by a bare id (no `locationId`
 * in the URL for `RolesGuard` to check against). HQ_ADMIN always passes;
 * everyone else must have a LOCATION_ADMIN row at the resource's actual
 * `locationId`. Use this alongside a coarse `@Roles(HQ_ADMIN, LOCATION_ADMIN)`
 * at the route — see Phase 2 notes in docs/BUILD-ROADMAP.md for the pattern.
 */
export function assertManagesLocation(user: AuthenticatedUser, locationId: string): void {
  if (user.globalRole === GlobalRole.HQ_ADMIN) {
    return;
  }
  const manages = user.locations.some(
    (l) => l.locationId === locationId && l.role === LocationRole.LOCATION_ADMIN,
  );
  if (!manages) {
    throw new ForbiddenException('You do not manage this location');
  }
}

/**
 * Same idea as `assertManagesLocation`, but also lets through the coach
 * actually assigned to this specific session — a coach isn't a
 * LOCATION_ADMIN, but they still need to see/manage their own session's
 * roster and attendance.
 */
export function assertCanManageSession(
  user: AuthenticatedUser,
  session: { locationId: string; coachId: string | null },
): void {
  if (session.coachId === user.id) {
    return;
  }
  assertManagesLocation(user, session.locationId);
}
