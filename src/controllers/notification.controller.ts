import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import {
  listNotificationsByUser,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '../services/notification.service.js';
import { authorizeChannel } from '../utils/pusher.js';
import { wrapAsync } from '../middleware/errorHandler.js';

/**
 * Get notifications for the current user (farmer or buyer).
 * GET /api/farmers/notifications or GET /api/buyers/notifications
 */
export const getNotificationsHandler = wrapAsync(
  async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const unreadOnly = req.query.unreadOnly === 'true';

    const notifications = await listNotificationsByUser(req.user.userId, {
      limit: Math.min(limit, 100),
      unreadOnly,
    });
    const unreadCount = await getUnreadCount(req.user.userId);

    res.status(200).json({
      success: true,
      data: notifications,
      count: notifications.length,
      unreadCount,
    });
  }
);

/**
 * Mark one or more notifications as read.
 * POST /api/system/notifications/mark-read
 * Body: { notificationId?: string, notificationIds?: string[] }
 */
export const markReadHandler = wrapAsync(
  async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const body = req.body as { notificationId?: string; notificationIds?: string[] };
    const ids: string[] = body.notificationIds
      ? Array.isArray(body.notificationIds)
        ? body.notificationIds
        : []
      : body.notificationId
        ? [body.notificationId]
        : [];

    if (ids.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Provide notificationId or notificationIds',
      });
      return;
    }

    for (const id of ids) {
      try {
        await markNotificationRead(id, req.user.userId);
      } catch {
        // Skip if not found or not owned
      }
    }

    res.status(200).json({
      success: true,
      message: 'Notification(s) marked as read',
    });
  }
);

/**
 * Mark all notifications for the current user as read.
 * POST /api/system/notifications/mark-all-read
 */
export const markAllReadHandler = wrapAsync(
  async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    await markAllNotificationsRead(req.user.userId);

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
    });
  }
);

/**
 * Pusher channel auth for private user notifications.
 * POST /api/system/pusher-auth
 * Body: { socket_id: string, channel_name: string }
 * Only authorizes channel_name === "private-user-<currentUserId>"
 */
export const pusherAuthHandler = wrapAsync(
  async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const socketId = req.body?.socket_id as string | undefined;
    const channelName = req.body?.channel_name as string | undefined;

    if (!socketId || !channelName) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'socket_id and channel_name are required',
      });
      return;
    }

    const auth = authorizeChannel(socketId, channelName, req.user.userId);
    if (!auth) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Not authorized to subscribe to this channel',
      });
      return;
    }

    res.status(200).json(auth);
  }
);
