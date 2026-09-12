import { Injectable } from '@nestjs/common';
import { MailService } from './mail.service.js';
import {
  accountStatusChangedEmail,
  appointmentRequestedEmail,
  bookingCancellationEmail,
  bookingConfirmationEmail,
  bookingDeclinedEmail,
  bookingReminderEmail,
  membershipConfirmationEmail,
  newAppointmentRequestForCoachEmail,
  packageConfirmationEmail,
  paymentConfirmationEmail,
  waitlistAvailableEmail,
} from './templates.js';

interface Recipient {
  email: string;
  firstName: string;
}

/**
 * High-level notification triggers, one per spec §15 event — the thing
 * booking/payment/waitlist services actually call, so they don't need to
 * know about MailService or the template functions directly.
 */
@Injectable()
export class NotificationsService {
  constructor(private readonly mail: MailService) {}

  bookingConfirmed(to: Recipient, serviceName: string, startTime: Date) {
    const { subject, html } = bookingConfirmationEmail({
      firstName: to.firstName,
      serviceName,
      startTime,
    });
    return this.mail.send(to.email, subject, html);
  }

  bookingReminder(to: Recipient, serviceName: string, startTime: Date) {
    const { subject, html } = bookingReminderEmail({ firstName: to.firstName, serviceName, startTime });
    return this.mail.send(to.email, subject, html);
  }

  bookingCancelled(to: Recipient, serviceName: string, startTime: Date) {
    const { subject, html } = bookingCancellationEmail({
      firstName: to.firstName,
      serviceName,
      startTime,
    });
    return this.mail.send(to.email, subject, html);
  }

  waitlistAvailable(to: Recipient, serviceName: string, startTime: Date) {
    const { subject, html } = waitlistAvailableEmail({
      firstName: to.firstName,
      serviceName,
      startTime,
    });
    return this.mail.send(to.email, subject, html);
  }

  paymentConfirmed(to: Recipient, amount: string) {
    const { subject, html } = paymentConfirmationEmail({ firstName: to.firstName, amount });
    return this.mail.send(to.email, subject, html);
  }

  membershipConfirmed(to: Recipient, planName: string) {
    const { subject, html } = membershipConfirmationEmail({ firstName: to.firstName, planName });
    return this.mail.send(to.email, subject, html);
  }

  packageConfirmed(to: Recipient, packageName: string, credits: number) {
    const { subject, html } = packageConfirmationEmail({
      firstName: to.firstName,
      packageName,
      credits,
    });
    return this.mail.send(to.email, subject, html);
  }

  accountStatusChanged(to: Recipient, isActive: boolean) {
    const { subject, html } = accountStatusChangedEmail({ firstName: to.firstName, isActive });
    return this.mail.send(to.email, subject, html);
  }

  appointmentRequested(to: Recipient, serviceName: string, startTime: Date) {
    const { subject, html } = appointmentRequestedEmail({
      firstName: to.firstName,
      serviceName,
      startTime,
    });
    return this.mail.send(to.email, subject, html);
  }

  newAppointmentRequestForCoach(
    to: Recipient,
    serviceName: string,
    startTime: Date,
    clientName: string,
  ) {
    const { subject, html } = newAppointmentRequestForCoachEmail({
      firstName: to.firstName,
      serviceName,
      startTime,
      clientName,
    });
    return this.mail.send(to.email, subject, html);
  }

  bookingDeclined(to: Recipient, serviceName: string, startTime: Date) {
    const { subject, html } = bookingDeclinedEmail({
      firstName: to.firstName,
      serviceName,
      startTime,
    });
    return this.mail.send(to.email, subject, html);
  }
}
