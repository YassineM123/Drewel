import express from "express";
import { requireSignIn, isAdmin } from "../middlewares/authMiddleware.js";
import {
  updateDriverDetails,
  updateDriverUpdated,
  addDriverDetails,
  addPersonalDetails,
  getAllDrivers,
  getAllOnlineDrivers,
  getDriverDetails,
  toggleDriverApproval,
  toggleDriverRestriction,
  updateDriverLocation,
  updateOnlineStatus,
  updatePersonalDetails,
  deleteDriver,
  createDriverRequest,
  getDriverVerificationStatus,
  completeDriverProfile,
  getAvailableDrivers,
} from "../controllers/driverController.js";
import { generateStorage } from "../utils/multerFunction.js";
import { createRestrictedUpload, handleRestrictedUpload } from "../utils/uploadPolicy.js";

const destination = "public/user-images";
const storage = generateStorage(destination);
const upload = createRestrictedUpload({ storage, allowPdf: true });

const router = express.Router();

router.get("/available", requireSignIn, getAvailableDrivers);
router.post("/request", requireSignIn, createDriverRequest);
router.get("/:id/status", requireSignIn, getDriverVerificationStatus);
router.post(
  "/:id/complete-profile",
  requireSignIn,
  handleRestrictedUpload(upload.fields([
    { name: "license_car", maxCount: 1 },
    { name: "license_driver", maxCount: 1 },
    { name: "profile_image", maxCount: 1 },
    { name: "id_document", maxCount: 1 },
    { name: "passport_copy", maxCount: 1 },
  ])),
  completeDriverProfile
);

router.post(
  "/add-personal-details",
  requireSignIn,
  handleRestrictedUpload(upload.fields([
    { name: "carLicenseFront", maxCount: 1 },
    { name: "carLicenseBack", maxCount: 1 },
    { name: "drivingLicenseFront", maxCount: 1 },
    { name: "drivingLicenseBack", maxCount: 1 },
    { name: "idProofFront", maxCount: 1 },
    { name: "idProofBack", maxCount: 1 },
    { name: "profileImage", maxCount: 1 },
    { name: "passportCopy", maxCount: 1 },
  ])),
  addPersonalDetails
);

router.post(
  "/update-personal-details",
  requireSignIn,
  handleRestrictedUpload(upload.fields([
    { name: "licenseCompany", maxCount: 1 },
    { name: "carLicenseFront", maxCount: 1 },
    { name: "carLicenseBack", maxCount: 1 },
    { name: "drivingLicenseFront", maxCount: 1 },
    { name: "drivingLicenseBack", maxCount: 1 },
    { name: "idProofFront", maxCount: 1 },
    { name: "idProofBack", maxCount: 1 },
    { name: "profileImage", maxCount: 1 },
    { name: "passportCopy", maxCount: 1 },
  ])),
  updatePersonalDetails
);

router.put("/update-driver-details/:driverId", requireSignIn, updateDriverDetails);

router.post(
  "/addDriver",
  requireSignIn,
  isAdmin,
  handleRestrictedUpload(upload.fields([
    { name: "licenseCompany", maxCount: 1 },
    { name: "carLicenseFront", maxCount: 1 },
    { name: "carLicenseBack", maxCount: 1 },
    { name: "drivingLicenseFront", maxCount: 1 },
    { name: "drivingLicenseBack", maxCount: 1 },
    { name: "idProofFront", maxCount: 1 },
    { name: "idProofBack", maxCount: 1 },
    { name: "profileImage", maxCount: 1 },
    { name: "passportCopy", maxCount: 1 },
  ])),
  addDriverDetails
);

router.get(
  "/get-driver-details/:id",
  requireSignIn,
  getDriverDetails
);

router.get("/all-drivers", requireSignIn, isAdmin, getAllDrivers);
router.post("/update-online-status", requireSignIn, updateOnlineStatus);
router.post("/update-location", requireSignIn, updateDriverLocation);
// Kept as a compatibility alias for older admin builds. It is intentionally
// protected and uses a safe projection in the controller.
router.get("/all-online-drivers", requireSignIn, isAdmin, getAllOnlineDrivers);
router.put("/toggle-approval/:driverId", requireSignIn, isAdmin, toggleDriverApproval);
router.put("/toggle-restriction/:driverId", requireSignIn, isAdmin, toggleDriverRestriction);
router.delete("/:driverId", requireSignIn, deleteDriver);
router.delete("/delete/:driverId", requireSignIn, deleteDriver); // legacy compatibility
router.post("/update-driver-updated", requireSignIn, updateDriverUpdated);
export default router;
