import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

/**
 * Fire-and-forget by design: a failed email must never break the booking/
 * payment/waitlist operation that triggered it, so every failure is caught
 * and logged here rather than propagated. Without RESEND_API_KEY configured,
 * sends are logged instead of attempted — lets every calling flow (and its
 * tests) work the same whether or not email is actually wired up yet.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    this.resend = apiKey ? new Resend(apiKey) : null;
    this.from = this.config.get<string>('MAIL_FROM') ?? 'G50.Golf <onboarding@resend.dev>';

    if (!this.resend) {
      this.logger.warn('RESEND_API_KEY is not set — emails will be logged, not sent.');
    }
  }

  async send(to: string, subject: string, html: string): Promise<void> {
    if (!this.resend) {
      this.logger.log(`[mail:not-configured] to=${to} subject="${subject}"`);
      return;
    }
    try {
      await this.resend.emails.send({ from: this.from, to, subject, html });
    } catch (err) {
      this.logger.error(`Failed to send email to ${to}: ${(err as Error).message}`);
    }
  }
}
