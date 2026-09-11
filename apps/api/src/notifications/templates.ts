function formatWhen(d: Date): string {
  return d.toLocaleString('en-AU', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function layout(title: string, bodyHtml: string): string {
  return `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #0f3d3e; margin-bottom: 4px;">${title}</h2>
      <div style="color: #1a1a1a; font-size: 14px; line-height: 1.6;">${bodyHtml}</div>
      <p style="margin-top: 24px; color: #8a8a8a; font-size: 12px;">G50.Golf</p>
    </div>
  `;
}

export function bookingConfirmationEmail(params: {
  firstName: string;
  serviceName: string;
  startTime: Date;
}) {
  return {
    subject: `Booking confirmed: ${params.serviceName}`,
    html: layout(
      'Booking confirmed',
      `<p>Hi ${params.firstName},</p>
       <p>You're booked in for <strong>${params.serviceName}</strong> on
       <strong>${formatWhen(params.startTime)}</strong>.</p>
       <p>See you on the range!</p>`,
    ),
  };
}

export function bookingReminderEmail(params: {
  firstName: string;
  serviceName: string;
  startTime: Date;
}) {
  return {
    subject: `Reminder: ${params.serviceName} tomorrow`,
    html: layout(
      'See you soon',
      `<p>Hi ${params.firstName},</p>
       <p>Just a reminder — your <strong>${params.serviceName}</strong> session is coming up on
       <strong>${formatWhen(params.startTime)}</strong>.</p>`,
    ),
  };
}

export function bookingCancellationEmail(params: {
  firstName: string;
  serviceName: string;
  startTime: Date;
}) {
  return {
    subject: `Booking cancelled: ${params.serviceName}`,
    html: layout(
      'Booking cancelled',
      `<p>Hi ${params.firstName},</p>
       <p>Your booking for <strong>${params.serviceName}</strong> on
       <strong>${formatWhen(params.startTime)}</strong> has been cancelled.</p>`,
    ),
  };
}

export function waitlistAvailableEmail(params: {
  firstName: string;
  serviceName: string;
  startTime: Date;
}) {
  return {
    subject: `A spot opened up: ${params.serviceName}`,
    html: layout(
      'A spot is available',
      `<p>Hi ${params.firstName},</p>
       <p>Good news — a spot opened up for <strong>${params.serviceName}</strong> on
       <strong>${formatWhen(params.startTime)}</strong>. Log in and claim it from
       your waitlist before someone else does.</p>`,
    ),
  };
}

export function paymentConfirmationEmail(params: { firstName: string; amount: string }) {
  return {
    subject: 'Payment received',
    html: layout(
      'Payment received',
      `<p>Hi ${params.firstName},</p>
       <p>We've received your payment of <strong>$${params.amount}</strong>. Thanks!</p>`,
    ),
  };
}

export function membershipConfirmationEmail(params: { firstName: string; planName: string }) {
  return {
    subject: `Membership active: ${params.planName}`,
    html: layout(
      'Membership active',
      `<p>Hi ${params.firstName},</p>
       <p>Your <strong>${params.planName}</strong> membership is now active.</p>`,
    ),
  };
}

export function packageConfirmationEmail(params: {
  firstName: string;
  packageName: string;
  credits: number;
}) {
  return {
    subject: `Credits added: ${params.packageName}`,
    html: layout(
      'Credits added',
      `<p>Hi ${params.firstName},</p>
       <p><strong>${params.credits} credit${params.credits === 1 ? '' : 's'}</strong> from
       <strong>${params.packageName}</strong> have been added to your account.</p>`,
    ),
  };
}
