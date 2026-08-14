import express from 'express';
import { requireSignIn } from '../middlewares/authMiddleware.js';
import {
  clearNotification,
  getNotifications,
  getUnreadCount,
  markAllAsRead,
  markAsRead,
} from '../controllers/notificationController.js';

const router = express.Router();

router.get('/get-notifications', requireSignIn, getNotifications);
router.get('/unread-count', requireSignIn, getUnreadCount);
router.post('/mark-as-read/:notificationId', requireSignIn, markAsRead);
router.post('/mark-all-as-read', requireSignIn, markAllAsRead);
router.post('/clear/:notificationId', requireSignIn, clearNotification);

export default router;
