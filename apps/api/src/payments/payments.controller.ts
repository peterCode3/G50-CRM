import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  type RawBodyRequest,
} from '@nestjs/common';
import type { Request } from 'express';
import { GlobalRole, LocationRole } from '@g50golf/db';
import { Public } from '../auth/public.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/types.js';
import { PaymentsService } from './payments.service.js';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('my')
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.paymentsService.findMine(user);
  }

  @Post('bookings/:bookingId/intent')
  createBookingIntent(
    @Param('bookingId') bookingId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentsService.createIntentForBooking(bookingId, user);
  }

  @Post('memberships/:userMembershipId/intent')
  createMembershipIntent(
    @Param('userMembershipId') userMembershipId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentsService.createIntentForMembership(userMembershipId, user);
  }

  @Post('credit-balances/:creditBalanceId/intent')
  createCreditBalanceIntent(
    @Param('creditBalanceId') creditBalanceId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentsService.createIntentForCreditBalance(creditBalanceId, user);
  }

  // Stripe calls this directly — no cookie, verified by signature instead.
  // Needs the exact raw request bytes (not the JSON-parsed body) to verify;
  // `rawBody: true` in main.ts's NestFactory.create keeps that available here
  // while every other route still gets the normal parsed body.
  @Public()
  @Post('webhook')
  handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!req.rawBody) {
      throw new BadRequestException('Missing raw request body');
    }
    return this.paymentsService.handleWebhookEvent(req.rawBody, signature);
  }

  @Roles(GlobalRole.HQ_ADMIN, LocationRole.LOCATION_ADMIN)
  @Post(':id/refund')
  refund(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.paymentsService.refund(id, user);
  }
}
