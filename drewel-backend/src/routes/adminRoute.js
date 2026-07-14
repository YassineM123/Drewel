import express from 'express';
import {
  loginAdmin,
  registerAdmin,
  getDriversForReview,
  getDriverReviewDetails,
  updateDriverReviewStatus,
  getOnlineDrivers,
} from '../controllers/adminController.js';
import { isAdmin, requireSignIn } from '../middlewares/authMiddleware.js';
import { dashBoardData } from '../controllers/userController.js';
import { sendOTPusingWhatsapp, verifyOTPWhatsapp } from '../controllers/authController.js';


const router = express.Router();

router.post("/register", requireSignIn, isAdmin, registerAdmin);
router.post('/login',loginAdmin);
router.get('/dashboard',requireSignIn,isAdmin,dashBoardData)
router.get('/drivers/online', requireSignIn, isAdmin, getOnlineDrivers);
router.get('/drivers', requireSignIn, isAdmin, getDriversForReview);
router.get('/driver/:id', requireSignIn, isAdmin, getDriverReviewDetails);
router.put('/driver/:id/status', requireSignIn, isAdmin, updateDriverReviewStatus);
export default router;
