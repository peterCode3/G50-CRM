import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/types.js';
import { CreditsService } from './credits.service.js';

@Controller('credit-balances')
export class MyCreditBalancesController {
  constructor(private readonly service: CreditsService) {}

  @Get('my')
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findMyBalances(user);
  }
}
