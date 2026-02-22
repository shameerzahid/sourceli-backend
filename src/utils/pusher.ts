import Pusher from 'pusher';
import { env } from '../config/env.js';

let pusherClient: Pusher | null = null;

/**
 * Get Pusher client if configured via env. Otherwise null (real-time disabled).
 */
export function getPusher(): Pusher | null {
  if (pusherClient) return pusherClient;
  if (
    !env.PUSHER_APP_ID ||
    !env.PUSHER_KEY ||
    !env.PUSHER_SECRET
  ) {
    return null;
  }
  pusherClient = new Pusher({
    appId: env.PUSHER_APP_ID,
    key: env.PUSHER_KEY,
    secret: env.PUSHER_SECRET,
    cluster: env.PUSHER_CLUSTER || 'mt1',
    useTLS: true,
  });
  return pusherClient;
}

const CHANNEL_PREFIX = 'private-user-';

/**
 * Channel name for a user's private notifications.
 */
export function userChannel(userId: string): string {
  return `${CHANNEL_PREFIX}${userId}`;
}

/**
 * Check if a channel name is the current user's private channel.
 */
export function isUserChannel(channelName: string, userId: string): boolean {
  return channelName === userChannel(userId);
}

/**
 * Trigger a real-time notification event to a user's private channel.
 * No-op if Pusher is not configured.
 */
export async function triggerNotification(
  userId: string,
  payload: {
    id: string;
    type: string;
    title: string;
    message: string;
    metadata?: Record<string, unknown>;
    createdAt: string;
  }
): Promise<void> {
  const pusher = getPusher();
  if (!pusher) return;

  const channel = userChannel(userId);
  try {
    await pusher.trigger(channel, 'notification', payload);
  } catch (err) {
    console.error('[Pusher] trigger failed:', err);
  }
}

/**
 * Authorize a private channel subscription (for Pusher auth endpoint).
 * Returns auth object to send to client, or null if not authorized.
 */
export function authorizeChannel(
  socketId: string,
  channelName: string,
  userId: string
): { auth: string } | null {
  if (!isUserChannel(channelName, userId)) return null;
  const pusher = getPusher();
  if (!pusher) return null;

  try {
    const auth = pusher.authorizeChannel(socketId, channelName);
    return auth as { auth: string };
  } catch {
    return null;
  }
}
