import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import connectDB from "./src/connection.js";
import { loadEnv } from "./src/utils/loadEnv.js";
import userRoutes from "./src/routes/userRoutes.js";
import notificationRoutes from "./src/routes/notificationRoutes.js";
import expensesRoutes from "./src/routes/expenseRoutes.js";
import friendRoutes from "./src/routes/friendRoute.js";
import groupRoutes from "./src/routes/groupRoutes.js";
import driverRoutes from "./src/routes/driverRoutes.js";
import adminRoute from "./src/routes/adminRoute.js";
import bannerRoute from "./src/routes/bannerRoute.js";
import { app, server } from "./src/socket/index.js";
import { isOriginAllowed } from "./src/utils/allowedOrigins.js";
import {
  normalizeAssetResponses,
  validatePublicAssetConfig,
} from "./src/utils/publicAssets.js";

loadEnv();
validatePublicAssetConfig();

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || "127.0.0.1";
const ALLOW_START_WITHOUT_DB =
  String(process.env.ALLOW_START_WITHOUT_DB || "false").toLowerCase() === "true";

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

app.use("/api/users", userRoutes);
app.use("/api/notification", notificationRoutes);
app.use("/api/expenses", expensesRoutes);
app.use("/api/friend", friendRoutes);
app.use("/api/group", groupRoutes);
app.use("/api/driver", driverRoutes);
app.use("/api/admin", adminRoute);
app.use("/api/banner", bannerRoute);

app.get("/api/health", async (req, res) => {
  return res.status(200).json({ success: true, message: "Backend API is running" });
});

app.get("/", async (req, res) => {
  return res.status(200).send("Backend server is running");
});

app.get("/health", async (req, res) => {
  return res.status(200).json({ success: true, message: "Backend server is running" });
});

app.use((err, req, res, next) => {
  console.error("Global Error Handler:", err.message);
  res.status(500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

connectDB()
  .then(() => {
    server.listen(PORT, HOST, () => {
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
