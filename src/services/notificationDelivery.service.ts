import { prisma } from '../config/database.js';
import { createNotification, type CreateNotificationData, type NotificationType } from './notification.service.js';
import { env } from '../config/env.js';
import { triggerNotification } from '../utils/pusher.js';
import { toE164 } from '../utils/validation.js';
import { getEmailHtml } from '../templates/emailTemplate.js';

export interface NotifyUserOptions {
  sendEmail?: boolean;
  sendSms?: boolean;
}

/**
 * Create in-app notification and optionally send email and SMS.
 * If SendGrid/Twilio are not configured, only in-app notification is created.
 */
export async function notifyUser(
  userId: string,
  type: NotificationType | string,
  title: string,
  message: string,
  metadata?: Record<string, unknown>,
  options: NotifyUserOptions = {}
): Promise<{ notificationId: string }> {
  const notification = await createNotification({
    userId,
    type,
    title,
    message,
    metadata,
  });

  triggerNotification(userId, {
    id: notification.id,
    type,
    title,
    message,
    metadata: metadata as Record<string, unknown> | undefined,
    createdAt: notification.createdAt.toISOString(),
  }).catch((err) => console.error('[Pusher]', err));

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, phone: true },
  });

  if (!user) {
    return { notificationId: notification.id };
  }

  const shouldEmail = options.sendEmail !== false && user.email;
  const shouldSms = options.sendSms !== false && user.phone;

  if (shouldEmail && env.SENDGRID_API_KEY && env.SENDGRID_FROM_EMAIL) {
    sendEmailAsync(user.email!, title, message, getEmailHtml(title, message)).catch((err) =>
      console.error('[Notification] Email send failed:', err)
    );
  }

  if (shouldSms && env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM_NUMBER) {
    const phoneE164 = toE164(user.phone!);
    if (phoneE164) {
      sendSmsAsync(phoneE164, message).catch((err) =>
        console.error('[Notification] SMS send failed:', err)
      );
    }
  }

  return { notificationId: notification.id };
}

/**
 * Send email via SendGrid API (fire-and-forget).
 * Sends both plain text and HTML; clients that support HTML will show the branded template.
 */
async function sendEmailAsync(
  to: string,
  subject: string,
  text: string,
  html?: string
): Promise<void> {
  const key = env.SENDGRID_API_KEY;
  const from = env.SENDGRID_FROM_EMAIL;
  if (!key || !from) return;

  const content: { type: string; value: string }[] = [{ type: 'text/plain', value: text }];
  if (html) {
    content.push({ type: 'text/html', value: html });
  }

  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: from, name: 'Sourceli' },
      subject,
      content,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`SendGrid error ${res.status}: ${body}`);
  }
}

/**
 * Send SMS via Twilio API (fire-and-forget).
 */
async function sendSmsAsync(to: string, body: string): Promise<void> {
  const accountSid = env.TWILIO_ACCOUNT_SID;
  const authToken = env.TWILIO_AUTH_TOKEN;
  const from = env.TWILIO_FROM_NUMBER;
  if (!accountSid || !authToken || !from) return;

  const params = new URLSearchParams();
  params.set('To', to);
  params.set('From', from);
  params.set('Body', body.slice(0, 1600)); // Twilio limit

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    }
  );

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(`Twilio error ${res.status}: ${JSON.stringify(data)}`);
  }
}
