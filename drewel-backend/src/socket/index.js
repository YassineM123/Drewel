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

    socket.on("driver-location-update", async ({ driverId, lat, long, fullName, vehicleType, city }) => {
      try {
        const normalizedCity = normalizeCity(city);

        const updatedDriver = await Driver.findByIdAndUpdate(
          driverId,
          {
            lat,
            long,
            fullName,
            vehicleType,
            city: normalizedCity,
            updatedAt: new Date(),
          },
          { new: true }
        );

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

        const drivers = await Driver.find(filter).sort({ updatedAt: -1 });

        // ✅ Send initial snapshot immediately
        socket.emit("drivers-nearby", {
          type: "INITIAL",
          drivers,
        });

      } catch (error) {
        console.error("Error joining city room:", error);
      }
    });

    socket.on("user-location-update", async ({ userId, lat, long }) => {
      try {
        const updateUserLocation = async (userId, lat, long) => {
          try {
            const user = await User.findById(userId);
            if (!user) {
              throw new Error("User not found");
            }
            user.lat = lat;
            user.long = long;
            await user.save();
            return user;
          }
          catch (error) {
            console.error("Error updating user location:", error);
            throw error;
          }
        };
        const updatedUser = await updateUserLocation(userId, lat, long);
        io.to(userId).emit("user-location-updated", updatedUser);
      } catch (error) {
        console.error("Error updating user location:", error);
      }
    });

    socket.on("update-isUpdate", async ({ driverId }) => {
      try {
        const driver = await Driver.findById(driverId);
        if (!driver) {
          throw new Error("Driver not found");
        }
        driver.isUpdate = isUpdate;
        await driver.save();
        io.to(driverId).emit("isUpdate-updated", { driverId, isUpdate });
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
