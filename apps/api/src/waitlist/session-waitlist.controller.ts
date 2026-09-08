import { Controller, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/types.js';
import { WaitlistService } from './waitlist.service.js';

@Controller('sessions/:sessionId/waitlist')
export class SessionWaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  // No @Roles() — any authenticated user can join a waitlist for themselves.
  @Post()
  join(@Param('sessionId') sessionId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.waitlistService.join(sessionId, user);
  }
}
