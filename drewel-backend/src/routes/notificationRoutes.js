import express from 'express';
import { requireSignIn } from '../middlewares/authMiddleware.js';
import { getNotifications, markAsRead } from '../controllers/notificationController.js';



const router = express.Router();

router.post('/mark-as-read/:notificationId', requireSignIn, markAsRead);
router.get('/get-notifications', requireSignIn, getNotifications);  
export default router;