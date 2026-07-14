import express from "express";
import { Server } from "socket.io";
import http from "http";
import getUserDetailsFromToken from "../helpers/getUserDetailsFromToken.js";
import User from "../models/User.js";
import {
  ConversationModel,
  MessageModel,
} from "../models/ConversationModel.js";
import Driver from "../models/Driver.js";

import getConversation from "../helpers/getConversation.js";
import mongoose from "mongoose";
import adminModel from "../models/Admin.js";
import { isOriginAllowed } from "../utils/allowedOrigins.js";

import {
  globalMessagePageHandler,
  messagePageHandler,
  messageSeenHandler,
  newGlobalMessageHandler,
  newMessageHandler,
  sidebarHandler,
} from "../utils/globalChat.js";
import Admin from "../models/Admin.js";

const app = express();
const server = http.createServer(app);

const normalizeCity = (city) => city?.trim().toLowerCase();
const nearbyDriverFields =
  "firstName lastName fullName phone whatsappNumber profileImageUrl city vehicleType lat long isOnline status updatedAt";

// const io = new Server(server, {
//   cors: {
//     origin: "https://app.fanzaty.net",
//     credentials: true,
//   },
// });
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    // path: "/portalapi/socket.io",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const onlineUser = new Set();
io.on("connection", async (socket) => {
  const token = socket.handshake.auth.token;

  try {
    // Current user details
    const user = await getUserDetailsFromToken(token);

    // const user = await User.findById("6725f74012db69183d143524")

    if (!user || !user._id) {
      console.error("Socket authentication returned no user");
      socket.disconnect(true);
      return;
    }

    const userId = user._id;
    const authenticatedAdmin = await Admin.exists({ _id: userId, role: "admin" });
    const authenticatedDriver = await Driver.exists({ _id: userId });
    const authenticatedUser = await User.exists({ _id: userId });
    socket.join(userId.toString());
    onlineUser.add(userId.toString());
    const userIdString = userId.toString();
    socket.join(userIdString);
    onlineUser.add(userIdString);

    socket.on("message-page", async (userId) => {
      await messagePageHandler(socket, userId, user, onlineUser);
    });

    socket.on("new message", async (data) => {
      await newMessageHandler(socket, userId, user, data);
    });
    socket.on("sidebar", async (currentUserId, page, limit) => {
      page = 1;
      limit = 100;
      await sidebarHandler(socket, currentUserId, page, limit);
    });

    // Seen
    socket.on("seen", async (msgByUserId) => {
      await messageSeenHandler(msgByUserId);
    });

    // socket.on("driver-location-update", async ({ driverId, lat, long, fullName, vehicleType, city }) => {
    //   try {
    //     const updateDriverLocation = async (driverId, lat, long) => {
    //       try {
    //         const driver = await Driver.findById(driverId);
    //         if (!driver) {
    //           throw new Error("Driver not found");
    //         }
    //         driver.lat = lat;
    //         driver.long = long;
    //         driver.fullName = fullName || driver.fullName;
    //         driver.vehicleType = vehicleType || driver.vehicleType;
    //         driver.city = city || driver.city;
    //         await driver.save();
    //         return driver;
    //       }
    //       catch (error) {
    //         console.error("Error updating driver location:", error);
    //         throw error;
    //       }
    //     };
    //     const updatedDriver = await updateDriverLocation(driverId, lat, long);
    //     io.to(driverId).emit("driver-location-updated", updatedDriver);
    //   } catch (error) {
    //     console.error("Error updating driver location:", error);
    //   }
    // });

    socket.on("driver-location-update", async ({ driverId, lat, long, fullName, vehicleType, city } = {}) => {
      try {
        const targetDriverId = authenticatedAdmin && driverId ? driverId : userId;
        if ((!authenticatedAdmin && !authenticatedDriver) || !mongoose.Types.ObjectId.isValid(targetDriverId)) {
          socket.emit("error", { message: "Not authorized to update this driver" });
          return;
        }
        if (!Number.isFinite(lat) || !Number.isFinite(long) || lat < -90 || lat > 90 || long < -180 || long > 180) {
          socket.emit("error", { message: "Invalid driver coordinates" });
          return;
        }
        const normalizedCity = normalizeCity(city);

        const updatedDriver = await Driver.findByIdAndUpdate(
          targetDriverId,
          {
            lat,
            long,
            fullName,
            vehicleType,
            city: normalizedCity,
            updatedAt: new Date(),
          },
          { new: true }
        ).select(nearbyDriverFields);

        if (!updatedDriver) return;

        // ✅ 1. Send update to all USERS in that city
        io.to(normalizedCity).emit("drivers-nearby", {
          type: "UPDATE",
          driver: updatedDriver,
        });

        // ✅ 2. Send ACK to DRIVER
        socket.emit("driver-location-updated", updatedDriver);

      } catch (error) {
        console.error(error);
      }
    });

    socket.on("join-city-room", async ({ city, vehicleType }) => {
      try {
        const normalizedCity = normalizeCity(city);

        socket.join(normalizedCity);

        // ✅ Fetch latest drivers immediately
        const filter = {
          city: normalizedCity,
          isApproved: true,
          isRestricted: false,
        };

        if (vehicleType) {
          filter.vehicleType = {
            $regex: new RegExp(`^${vehicleType}$`, "i"),
          };
        }

        const drivers = await Driver.find(filter)
          .select(nearbyDriverFields)
          .sort({ updatedAt: -1 });

        // ✅ Send initial snapshot immediately
        socket.emit("drivers-nearby", {
          type: "INITIAL",
          drivers,
        });

      } catch (error) {
        console.error("Error joining city room:", error);
      }
    });

    socket.on("user-location-update", async ({ userId: requestedUserId, lat, long } = {}) => {
      try {
        const targetUserId = authenticatedAdmin && requestedUserId ? requestedUserId : userId;
        if ((!authenticatedAdmin && !authenticatedUser) || !mongoose.Types.ObjectId.isValid(targetUserId)) {
          socket.emit("error", { message: "Not authorized to update this user" });
          return;
        }
        if (!Number.isFinite(lat) || !Number.isFinite(long) || lat < -90 || lat > 90 || long < -180 || long > 180) {
          socket.emit("error", { message: "Invalid user coordinates" });
          return;
        }
        const updateUserLocation = async (targetId, latitude, longitude) => {
          try {
            const targetUser = await User.findById(targetId);
            if (!targetUser) {
              throw new Error("User not found");
            }
            targetUser.lat = latitude;
            targetUser.long = longitude;
            await targetUser.save();
            return targetUser;
          }
          catch (error) {
            console.error("Error updating user location:", error);
            throw error;
          }
        };
        const updatedUser = await updateUserLocation(targetUserId, lat, long);
        io.to(targetUserId.toString()).emit("user-location-updated", updatedUser);
      } catch (error) {
        console.error("Error updating user location:", error);
      }
    });

    socket.on("update-isUpdate", async ({ driverId, isUpdate } = {}) => {
      try {
        const targetDriverId = authenticatedAdmin && driverId ? driverId : userId;
        if ((!authenticatedAdmin && !authenticatedDriver) || typeof isUpdate !== "boolean") {
          socket.emit("error", { message: "Invalid driver update request" });
          return;
        }
        const driver = await Driver.findById(targetDriverId);
        if (!driver) {
          throw new Error("Driver not found");
        }
        driver.isUpdate = isUpdate;
        await driver.save();
        io.to(targetDriverId.toString()).emit("isUpdate-updated", {
          driverId: targetDriverId,
          isUpdate,
        });
      } catch (error) {
        console.error("Error updating isUpdate status:", error);
      }
    });

    // socket.on("global-message-page", async (groupId) => {
    //   try {
    //     await globalMessagePageHandler(socket, groupId);
    //   } catch (error) {
    //     console.error("Error fetching group message page:", error);
    //     socket.emit("error", { message: "Failed to load group message page" });
    //   }
    // });

    socket.on("disconnect", async () => {
      onlineUser.delete(userIdString);
      io.emit("onlineUser", Array.from(onlineUser));
    });
  } catch (error) {
    console.error("Error during socket connection:", error);
    socket.disconnect(true);
  }
});

export { app, server, io };
