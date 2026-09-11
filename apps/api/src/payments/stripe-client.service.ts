import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

/**
 * Thin wrapper so the rest of the payments module depends on one injectable
 * instead of constructing `new Stripe(...)` in several places. Doesn't throw
 * at boot if the key is missing — every real API call still gets attempted,
 * and Stripe itself returns a clear auth error rather than the app crashing
 * on startup just because payments aren't configured yet in this environment.
 */
@Injectable()
export class StripeClientService {
  readonly client: Stripe;
  private readonly logger = new Logger(StripeClientService.name);

  constructor(private readonly config: ConfigService) {
    const secretKey = this.config.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      this.logger.warn(
        'STRIPE_SECRET_KEY is not set — payment endpoints will fail until it is configured.',
      );
    }
    this.client = new Stripe(secretKey || 'sk_test_not_configured');
  }

  get webhookSecret(): string {
    return this.config.get<string>('STRIPE_WEBHOOK_SECRET') ?? '';
  }
}
