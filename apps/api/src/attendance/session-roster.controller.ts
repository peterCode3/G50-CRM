import { Controller, Get, Param } from '@nestjs/common';
import { GlobalRole, LocationRole } from '@g50golf/db';
import { Roles } from '../auth/roles.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/types.js';
import { AttendanceService } from './attendance.service.js';

@Controller('sessions/:sessionId/roster')
export class SessionRosterController {
  constructor(private readonly attendanceService: AttendanceService) {}

  // Coarse gate: must be HQ, a location admin somewhere, or a coach — the
  // precise "is this YOUR session" check happens in the service, since a
  // coach isn't a LOCATION_ADMIN and there's no locationId param here for
  // RolesGuard to scope against directly.
  @Roles(GlobalRole.HQ_ADMIN, LocationRole.LOCATION_ADMIN, GlobalRole.COACH)
  @Get()
  getRoster(@Param('sessionId') sessionId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.attendanceService.getRoster(sessionId, user);
  }
}
