import express from 'express';
import {
  loginAdmin,
  registerAdmin,
  getDriversForReview,
  getDriverReviewDetails,
  getOnlineDrivers,
  getDriversWithLocation,
  restoreDriverAccess,
  suspendDriverAccess,
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
import {
  addRideInternalNote,
  cancelAdminRide,
  getAdminRide,
  listAdminRides,
  markRideTechnicalFailure,
  openAdminDispute,
  refundRidePoints,
  resolveRideDispute,
  unlockRideParticipants,
} from '../controllers/adminRideController.js';
import {
  getSystemHealth,
  listAdminAlerts,
  listAdminAuditLogs,
  getChatMetadata,
  listChatThreads,
  listSecureCalls,
  getRolesCatalog,
  listAdminNotifications,
  sendAdminNotification,
  getAdminSettings,
} from '../controllers/adminMetaController.js';


const router = express.Router();

router.post("/register", requireSignIn, isAdmin, registerAdmin);
router.post('/login',loginAdmin);
router.get('/dashboard',requireSignIn,isAdmin,dashBoardData)
router.get('/drivers/online', requireSignIn, isAdmin, getOnlineDrivers);
router.get('/drivers/location', requireSignIn, isAdmin, getDriversWithLocation);
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
router.get('/rides', requireSignIn, isAdmin, listAdminRides);
router.get('/rides/:rideId', requireSignIn, isAdmin, getAdminRide);
router.post('/rides/:rideId/cancel', requireSignIn, isAdmin, cancelAdminRide);
router.post('/rides/:rideId/dispute', requireSignIn, isAdmin, openAdminDispute);
router.post('/rides/:rideId/dispute/resolve', requireSignIn, isAdmin, resolveRideDispute);
router.post('/rides/:rideId/failure', requireSignIn, isAdmin, markRideTechnicalFailure);
router.post('/rides/:rideId/unlock', requireSignIn, isAdmin, unlockRideParticipants);
router.post('/rides/:rideId/refund-points', requireSignIn, isAdmin, refundRidePoints);
router.post('/rides/:rideId/note', requireSignIn, isAdmin, addRideInternalNote);
router.get('/reservations', requireSignIn, isAdmin, listAdminRides);
router.get('/reservations/:rideId', requireSignIn, isAdmin, getAdminRide);
router.post('/reservations/:rideId/cancel', requireSignIn, isAdmin, cancelAdminRide);
router.post('/reservations/:rideId/dispute', requireSignIn, isAdmin, openAdminDispute);
router.post('/reservations/:rideId/dispute/resolve', requireSignIn, isAdmin, resolveRideDispute);
router.post('/reservations/:rideId/failure', requireSignIn, isAdmin, markRideTechnicalFailure);
router.post('/reservations/:rideId/unlock', requireSignIn, isAdmin, unlockRideParticipants);
router.post('/reservations/:rideId/refund-points', requireSignIn, isAdmin, refundRidePoints);
router.post('/reservations/:rideId/note', requireSignIn, isAdmin, addRideInternalNote);
// Compatibility contract for the current admin build. All status writes now
// pass through the same validated, auditable transition service.
router.put('/driver/:id/status', requireSignIn, isAdmin, updateAdminRequestStatus);
router.post('/driver/:id/suspend', requireSignIn, isAdmin, suspendDriverAccess);
router.post('/driver/:id/restore', requireSignIn, isAdmin, restoreDriverAccess);
router.get('/health', requireSignIn, isAdmin, getSystemHealth);
router.get('/alerts', requireSignIn, isAdmin, listAdminAlerts);
router.get('/audit-logs', requireSignIn, isAdmin, listAdminAuditLogs);
router.get('/chat/metadata', requireSignIn, isAdmin, getChatMetadata);
router.get('/chat/threads', requireSignIn, isAdmin, listChatThreads);
router.get('/secure-calls', requireSignIn, isAdmin, listSecureCalls);
router.get('/roles', requireSignIn, isAdmin, getRolesCatalog);
router.get('/notifications', requireSignIn, isAdmin, listAdminNotifications);
router.post('/notifications/send', requireSignIn, isAdmin, sendAdminNotification);
router.get('/settings', requireSignIn, isAdmin, getAdminSettings);
export default router;
