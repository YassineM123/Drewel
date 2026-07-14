import express from "express";
import {
  registerUser,
  getUser,
  getAllUsers,
  updateUser,
  deleteUser,
  loginUser,
  resetPassword,
  updateProfilePicture,
  getProfileImage,
  getUserDetails,
  toggleRestrictionOnUser,
  getRestrictedUsers,
} from "../controllers/userController.js";
import { isAdmin, isVerified, requireSignIn } from "../middlewares/authMiddleware.js";
import { forgotPassword, verifyOtp, sendOTPusingWhatsapp, verifyOTPWhatsapp } from "../controllers/authController.js";
import { generateStorage } from "../utils/multerFunction.js";
import { createRestrictedUpload, handleRestrictedUpload } from "../utils/uploadPolicy.js";
import { addPersonalDetails } from "../controllers/driverController.js";

const destination = "public/user-images";
const storage = generateStorage(destination);
const profileUpload = createRestrictedUpload({ storage });
const documentUpload = createRestrictedUpload({ storage, allowPdf: true });

const router = express.Router();

// Routes
router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/reset-password", isVerified, resetPassword);
router.get("/get-all", getAllUsers);
router.post("/update-profile", requireSignIn, updateUser);
router.post("/forgot-password", forgotPassword);
router.post("/verify-otp", verifyOtp);
router.post("/send-otp-whatsapp", sendOTPusingWhatsapp);
router.post("/verify-otp-whatsapp", verifyOTPWhatsapp);
router.post(
  "/add-profile-picture",
  requireSignIn,
  handleRestrictedUpload(profileUpload.single("profilePicture")),
  updateProfilePicture
);
// Compatibility risk: this shared endpoint serves both profile images and
// private driver documents by filename. Keep it public for current mobile image
// rendering, but migrate documents to an authenticated, ownership-checked route.
router.get("/get-image/:fileName", getProfileImage);
// router.get("/:id", getUser);
router.delete("/:id", requireSignIn, deleteUser);
router.delete("/delete/:id", requireSignIn, deleteUser); // legacy compatibility
router.post("/delete-user/:id", requireSignIn, deleteUser); // legacy compatibility
router.post(
  "/add-personal-details",
  requireSignIn,
  handleRestrictedUpload(documentUpload.fields([
    { name: "profileImage", maxCount: 1 },
    { name: "licenseImage", maxCount: 1 },
    { name: "vehicleFrontImage", maxCount: 1 },
    { name: "vehicleBackImage", maxCount: 1 },
    { name: "vehicleSideImage", maxCount: 1 },
  ])),
  addPersonalDetails
);


router.get('/get-user', requireSignIn, getUser); // Get current user details
router.get("/get-user-details/:id", getUserDetails);
router.post('/toggle-restriction',requireSignIn,isAdmin,toggleRestrictionOnUser);
router.get('/restricted',requireSignIn,getRestrictedUsers)
export default router;
