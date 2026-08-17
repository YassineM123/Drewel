import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import connectDB from "./src/connection.js";
import Admin from "./src/models/Admin.js";
import { loadEnv } from "./src/utils/loadEnv.js";
import userRoutes from "./src/routes/userRoutes.js";
import notificationRoutes from "./src/routes/notificationRoutes.js";
import deviceTokenRoutes from "./src/routes/deviceTokenRoutes.js";
import expensesRoutes from "./src/routes/expenseRoutes.js";
import friendRoutes from "./src/routes/friendRoute.js";
import groupRoutes from "./src/routes/groupRoutes.js";
import driverRoutes from "./src/routes/driverRoutes.js";
import adminRoute from "./src/routes/adminRoute.js";
import bannerRoute from "./src/routes/bannerRoute.js";
import rideRoutes from "./src/routes/rideRoutes.js";
import conversationRoutes from "./src/routes/conversationRoutes.js";
import driverPointsRoutes from "./src/routes/driverPointsRoutes.js";
import adminPointsRoutes from "./src/routes/adminPointsRoutes.js";
import tripOfferRoutes from "./src/routes/tripOfferRoutes.js";
import accountRoutes from "./src/routes/accountRoutes.js";
import driverProfileRoutes from "./src/routes/driverProfileRoutes.js";
import { app, server } from "./src/socket/index.js";
import { isOriginAllowed } from "./src/utils/allowedOrigins.js";
import {
  normalizeAssetResponses,
  validatePublicAssetConfig,
} from "./src/utils/publicAssets.js";
import { startPointsJobs } from "./src/jobs/pointsJobs.js";
import { startDriverPresenceWatchdog } from "./src/jobs/driverPresenceJob.js";
import { startRankingJob } from "./src/jobs/rankingJob.js";

loadEnv();
validatePublicAssetConfig();

const PORT = Number.parseInt(process.env.PORT || "3001", 10);
const HOST = process.env.HOST || "0.0.0.0";
const ALLOW_START_WITHOUT_DB =
  String(process.env.ALLOW_START_WITHOUT_DB || "false").toLowerCase() === "true";
const LOCAL_ADMIN_BOOTSTRAP =
  String(process.env.LOCAL_ADMIN_BOOTSTRAP || "false").toLowerCase() === "true";
const LOCAL_ADMIN_EMAIL = String(process.env.LOCAL_ADMIN_EMAIL || "").trim().toLowerCase();
const LOCAL_ADMIN_PASSWORD = String(process.env.LOCAL_ADMIN_PASSWORD || "").trim();

const trustProxyHops = Number.parseInt(process.env.TRUST_PROXY_HOPS || "0", 10);
if (Number.isInteger(trustProxyHops) && trustProxyHops > 0) {
  app.set("trust proxy", trustProxyHops);
}

app.use(express.json());
app.use(cookieParser());
app.use(normalizeAssetResponses);

const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
      console.log("Not allowed by CORS: ", origin);
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));

const bootstrapLocalAdmin = async () => {
  if (
    !LOCAL_ADMIN_BOOTSTRAP ||
    String(process.env.NODE_ENV || "development").toLowerCase() === "production"
  ) {
    return;
  }

  if (!LOCAL_ADMIN_EMAIL || !LOCAL_ADMIN_PASSWORD) {
    throw new Error(
      "LOCAL_ADMIN_EMAIL and LOCAL_ADMIN_PASSWORD are required when LOCAL_ADMIN_BOOTSTRAP=true"
    );
  }

  const existingAdmin = await Admin.findOne({ email: LOCAL_ADMIN_EMAIL }).select("_id");
  if (existingAdmin) {
    return;
  }

  const hashedPassword = await bcrypt.hash(LOCAL_ADMIN_PASSWORD, 10);
  await Admin.create({
    fullName: "Local Admin",
    email: LOCAL_ADMIN_EMAIL,
    password: hashedPassword,
    role: "admin",
  });

  console.log(
    `Created local admin account: ${LOCAL_ADMIN_EMAIL}. Use it to log in to the admin panel.`
  );
};

app.use("/api/users", userRoutes);
app.use("/api/notification", notificationRoutes);
app.use("/api/device-tokens", deviceTokenRoutes);
app.use("/api/expenses", expensesRoutes);
app.use("/api/friend", friendRoutes);
app.use("/api/group", groupRoutes);
app.use("/api/driver/points", driverPointsRoutes);
app.use("/api/driver", driverRoutes);
app.use("/api/admin/points", adminPointsRoutes);
app.use("/api/admin", adminRoute);
app.use("/api/banner", bannerRoute);
app.use("/api/rides", rideRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/trip-offers", tripOfferRoutes);
app.use("/api/account", accountRoutes);
app.use("/api/driver-profile", driverProfileRoutes);

app.get("/api/health", async (req, res) => {
  return res.status(200).json({ success: true, message: "Backend API is running" });
});

app.get("/", async (req, res) => {
  return res.status(200).send("Backend server is running");
});

app.get("/health", async (req, res) => {
  return res.status(200).json({ success: true, message: "Backend server is running" });
});

app.use("/api", (req, res) =>
  res.status(404).json({
    success: false,
    code: "API_ROUTE_NOT_FOUND",
    message: `Cannot ${req.method} ${req.originalUrl}`,
  })
);

app.use((err, req, res, next) => {
  console.error("Global Error Handler:", err.message);
  const status =
    Number.isInteger(err?.statusCode) &&
    err.statusCode >= 400 &&
    err.statusCode < 500
      ? err.statusCode
      : 500;
  res.status(status).json({
    success: false,
    code: status === 500 ? "INTERNAL_ERROR" : err.code || "REQUEST_ERROR",
    message: status === 500 ? "Internal server error" : err.message,
  });
});

connectDB()
  .then(async () => {
    await bootstrapLocalAdmin();
    server.listen(PORT, HOST, () => {
      startPointsJobs();
      startDriverPresenceWatchdog();
      startRankingJob();
      console.log("server running at " + HOST + ":" + PORT);
    });
  })
  .catch((error) => {
    console.error("Failed to connect DB:", error.message);

    if (ALLOW_START_WITHOUT_DB) {
      console.warn("Starting server without DB connection because ALLOW_START_WITHOUT_DB=true");
      server.listen(PORT, HOST, () => {
        console.log("server running at " + HOST + ":" + PORT + " (without DB)");
      });
      return;
    }

    process.exit(1);
  });
