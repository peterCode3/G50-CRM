import { Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/types.js';
import { WaitlistService } from './waitlist.service.js';

@Controller('waitlist')
export class WaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  @Get('my')
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.waitlistService.findMine(user);
  }

  // No @Roles() — ownership is checked in the service.
  @Post(':id/claim')
  claim(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.waitlistService.claim(id, user);
  }
}
