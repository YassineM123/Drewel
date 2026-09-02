import express from "express";
import { isAdmin, requireSignIn } from "../middlewares/authMiddleware.js";
import { adminList, listMine, register, unregister } from "../controllers/deviceTokenController.js";

const router = express.Router();

router.post("/register", requireSignIn, register);
router.post("/unregister", requireSignIn, unregister);
router.get("/mine", requireSignIn, listMine);
router.get("/admin/:userId", requireSignIn, isAdmin, adminList);

export default router;
