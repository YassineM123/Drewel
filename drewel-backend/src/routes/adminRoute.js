import express from 'express';
import {
  loginAdmin,
  registerAdmin,
  getDriversForReview,
  getDriverReviewDetails,
  getOnlineDrivers,
} from '../controllers/adminController.js';
import {
  approveAdminRequest,
  approveAdminProfileRequest,
  getAdminRequestDetails,
  getAdminRequestDocument,
  getAdminRequestHistory,
  getAdminRequests,
  reopenAdminRequest,
  reopenAdminProfileRequest,
  rejectAdminProfileRequest,
  updateAdminRequestStatus,
} from '../controllers/adminRequestController.js';
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
router.get('/requests', requireSignIn, isAdmin, getAdminRequests);
router.get('/requests/:id', requireSignIn, isAdmin, getAdminRequestDetails);
router.get('/requests/:id/documents/:documentKey', requireSignIn, isAdmin, getAdminRequestDocument);
router.patch('/requests/:id/approve', requireSignIn, isAdmin, approveAdminRequest);
router.patch('/requests/:id/reopen', requireSignIn, isAdmin, reopenAdminRequest);
router.put('/requests/:id/approve', requireSignIn, isAdmin, approveAdminRequest);
router.put('/requests/:id/reopen', requireSignIn, isAdmin, reopenAdminRequest);
router.patch('/requests/:id/profile/approve', requireSignIn, isAdmin, approveAdminProfileRequest);
router.patch('/requests/:id/profile/reject', requireSignIn, isAdmin, rejectAdminProfileRequest);
router.patch('/requests/:id/profile/reopen', requireSignIn, isAdmin, reopenAdminProfileRequest);
router.put('/requests/:id/profile/approve', requireSignIn, isAdmin, approveAdminProfileRequest);
router.put('/requests/:id/profile/reject', requireSignIn, isAdmin, rejectAdminProfileRequest);
router.put('/requests/:id/profile/reopen', requireSignIn, isAdmin, reopenAdminProfileRequest);
router.get('/requests/:id/history', requireSignIn, isAdmin, getAdminRequestHistory);
// Compatibility contract for the current admin build. All status writes now
// pass through the same validated, auditable transition service.
router.put('/driver/:id/status', requireSignIn, isAdmin, updateAdminRequestStatus);
export default router;
