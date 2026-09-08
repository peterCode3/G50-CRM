import { Injectable, type CanActivate, type ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GlobalRole } from '@g50golf/db';
import { ROLES_KEY } from './roles.decorator.js';
import type { AuthenticatedUser } from './types.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;

    if (!user) {
      throw new ForbiddenException('Not authenticated');
    }

    // HQ_ADMIN is a superuser: passes every role check regardless of location.
    // This is the ONLY global bypass — LOCATION_ADMIN/COACH/CUSTOMER are inherently
    // per-location concepts and must always be checked against actual UserLocation
    // rows, never against `user.globalRole` directly (that field only distinguishes
    // "HQ staff" from "everyone else" for login/UI purposes, it is not itself a grant
    // of location-scoped access).
    if (user.globalRole === GlobalRole.HQ_ADMIN) {
      return true;
    }

    const locationId = request.params?.locationId ?? request.body?.locationId;

    // With a locationId in the request, the match must be for that specific location.
    // Without one (e.g. browsing a global catalog like HQ service templates), any
    // matching role at any of the user's locations satisfies the check.
    const hasMatchingLocationRole = user.locations.some(
      (l) => requiredRoles.includes(l.role) && (!locationId || l.locationId === locationId),
    );

    if (hasMatchingLocationRole) {
      return true;
    }

    throw new ForbiddenException('Insufficient permissions for this action');
  }
}
