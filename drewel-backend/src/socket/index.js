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
import Ride, { ACTIVE_RIDE_STATUSES } from "../models/Ride.js";
import { updateActiveRideLocation } from "../services/rideLocationService.js";
import {
  AVAILABLE_DRIVER_FIELDS,
  buildDubaiDiscoveryAggregation,
  buildFreshDubaiMarketplaceAvailabilityFilter,
  parseDriverDiscoveryQuery,
  toAvailableDriverDto,
} from "../utils/availableDrivers.js";
import {
  buildDriverLocationUpdate,
  discoveryRoom,
  DUBAI_SERVICE_AREA,
  serviceAreaForCoordinates,
  validateCoordinates,
} from "../utils/dubaiLocation.js";

const app = express();
const server = http.createServer(app);

const dubaiDiscoveryRoomsForVehicle = (vehicleType) => [
  ...new Set([
    discoveryRoom(DUBAI_SERVICE_AREA, vehicleType),
    discoveryRoom(DUBAI_SERVICE_AREA, "all"),
  ]),
];

const acknowledgeSocketEvent = (acknowledge, payload) => {
  if (typeof acknowledge === "function") acknowledge(payload);
};

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
const driverSocketCounts = new Map();
const ADMIN_TRACKING_ROOM = "admin-driver-tracking";
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
    const authenticatedAdmin = await Admin.exists({
      _id: userId,
      role: { $in: ["admin", "owner", "finance_admin"] },
    });
    const authenticatedDriver = await Driver.exists({ _id: userId });
    const authenticatedUser = await User.exists({ _id: userId });
    const userIdString = userId.toString();
    socket.join(userIdString);
    onlineUser.add(userIdString);
    if (authenticatedDriver) {
      driverSocketCounts.set(
        userIdString,
        (driverSocketCounts.get(userIdString) || 0) + 1
      );
    }

    socket.on("message-page", async (userId) => {
      await messagePageHandler(socket, userId, user, onlineUser);
    });

    socket.on("new message", async (data) => {
      await newMessageHandler(socket, userId, data);
    });
    socket.on("sidebar", async (_currentUserId, page, limit) => {
      await sidebarHandler(socket, userIdString, page, limit);
    });

    // Seen
    socket.on("seen", async (msgByUserId) => {
      await messageSeenHandler(socket, userId, msgByUserId);
    });

    socket.on("global-message-page", async () => {
      await globalMessagePageHandler(socket);
    });

    socket.on("new global message", async (data) => {
      await newGlobalMessageHandler(io, socket, userId, data);
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

    socket.on("driver-location-update", async ({ driverId, lat, long, accuracyM, recordedAt } = {}, acknowledge) => {
      try {
        const targetDriverId = authenticatedAdmin && driverId ? driverId : userId;
        if ((!authenticatedAdmin && !authenticatedDriver) || !mongoose.Types.ObjectId.isValid(targetDriverId)) {
          socket.emit("error", { message: "Not authorized to update this driver" });
          acknowledgeSocketEvent(acknowledge, { ok: false, error: "NOT_AUTHORIZED" });
          return;
        }
        const locationUpdate = buildDriverLocationUpdate({ lat, long, accuracyM, recordedAt });
        const previousDriver = await Driver.findById(targetDriverId)
          .select("_id currentServiceArea vehicleType").lean();
        const updatedDriver = await Driver.findByIdAndUpdate(
          targetDriverId,
          { $set: locationUpdate },
          { new: true }
        ).select(AVAILABLE_DRIVER_FIELDS);

        if (!updatedDriver) {
          acknowledgeSocketEvent(acknowledge, { ok: false, error: "DRIVER_NOT_FOUND" });
          return;
        }

        const availableDriver = await Driver.findOne({
          _id: updatedDriver._id,
          ...buildFreshDubaiMarketplaceAvailabilityFilter(),
        }).select(AVAILABLE_DRIVER_FIELDS);
        const currentRooms = dubaiDiscoveryRoomsForVehicle(updatedDriver.vehicleType);
        const previousRooms = dubaiDiscoveryRoomsForVehicle(previousDriver?.vehicleType);

        // ✅ 1. Send update to all USERS in that city
        if (availableDriver) {
          for (const room of currentRooms) {
            io.to(room).emit("drivers-nearby", {
              type: "UPDATE",
              driver: toAvailableDriverDto(availableDriver),
            });
          }
        } else if (previousDriver?.currentServiceArea === DUBAI_SERVICE_AREA) {
          for (const room of previousRooms) {
            io.to(room).emit("drivers-nearby", {
              type: "REMOVE",
              driverId: updatedDriver._id.toString(),
            });
          }
        }

        // ✅ 1b. Broadcast realtime position to ADMIN tracking panel
        io.to(ADMIN_TRACKING_ROOM).emit("driver:location", {
          driverId: updatedDriver._id.toString(),
          lat: updatedDriver.lat,
          long: updatedDriver.long,
          locationAccuracyM: updatedDriver.locationAccuracyM,
          locationUpdatedAt: updatedDriver.locationUpdatedAt,
          availabilityStatus: updatedDriver.availabilityStatus,
          isOnline: updatedDriver.isOnline,
          vehicleType: updatedDriver.vehicleType,
          vehicleModel: updatedDriver.vehicleModel,
          fullName:
            updatedDriver.fullName ||
            [updatedDriver.firstName, updatedDriver.lastName].filter(Boolean).join(" ").trim(),
        });

        // ✅ 2. Send ACK to DRIVER
        socket.emit("driver-location-updated", updatedDriver);
        acknowledgeSocketEvent(acknowledge, {
          ok: true,
          driverId: updatedDriver._id.toString(),
          updatedAt: updatedDriver.locationUpdatedAt,
          serviceArea: updatedDriver.currentServiceArea,
        });

      } catch (error) {
        console.error("Driver location update failed");
        acknowledgeSocketEvent(acknowledge, { ok: false, error: error.code || "LOCATION_UPDATE_FAILED" });
      }
    });

    socket.on("join-city-room", async ({ vehicleType, lat, long } = {}, acknowledge) => {
      try {
        validateCoordinates(lat, long);
        if (serviceAreaForCoordinates(lat, long) !== DUBAI_SERVICE_AREA) {
          acknowledgeSocketEvent(acknowledge, { ok: false, error: "OUTSIDE_SERVICE_AREA" });
          return;
        }

        for (const joinedRoom of socket.data.discoveryRooms || []) socket.leave(joinedRoom);
        const room = discoveryRoom(DUBAI_SERVICE_AREA, vehicleType);
        socket.join(room);
        socket.data.discoveryRooms = [room];

        // ✅ Fetch latest drivers immediately
        const options = parseDriverDiscoveryQuery({ lat, long, limit: 100 });
        const drivers = await Driver.aggregate(
          buildDubaiDiscoveryAggregation({ vehicleType }, options)
        );

        // ✅ Send initial snapshot immediately
        socket.emit("drivers-nearby", {
          type: "INITIAL",
          drivers: drivers.map((driver) => toAvailableDriverDto(driver, options)),
        });
        acknowledgeSocketEvent(acknowledge, {
          ok: true,
          count: drivers.length,
          serviceArea: DUBAI_SERVICE_AREA,
        });

      } catch (error) {
        console.error("Driver discovery room join failed");
        acknowledgeSocketEvent(acknowledge, { ok: false, error: error.code || "ROOM_JOIN_FAILED" });
      }
    });

    socket.on("leave-city-room", () => {
      for (const room of socket.data.discoveryRooms || []) socket.leave(room);
      socket.data.discoveryRooms = [];
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

    socket.on("ride:join", async ({ rideId } = {}, acknowledge) => {
      try {
        if (!mongoose.Types.ObjectId.isValid(rideId)) {
          acknowledgeSocketEvent(acknowledge, { ok: false, error: "INVALID_RIDE_ID" });
          return;
        }
        const participantFilter = authenticatedAdmin
          ? { _id: rideId }
          : authenticatedDriver
            ? { _id: rideId, driverId: userId }
            : { _id: rideId, passengerId: userId };
        const ride = await Ride.findOne({
          ...participantFilter,
          status: { $in: ACTIVE_RIDE_STATUSES },
        }).select("_id status stateVersion");
        if (!ride) {
          acknowledgeSocketEvent(acknowledge, { ok: false, error: "RIDE_ROOM_FORBIDDEN" });
          socket.emit("ride:error", { rideId, code: "RIDE_ROOM_FORBIDDEN" });
          return;
        }
        socket.join(`ride:${ride._id}`);
        acknowledgeSocketEvent(acknowledge, {
          ok: true,
          rideId: String(ride._id),
          status: ride.status,
          stateVersion: ride.stateVersion,
        });
      } catch {
        acknowledgeSocketEvent(acknowledge, { ok: false, error: "RIDE_ROOM_JOIN_FAILED" });
      }
    });

    socket.on("ride:leave", ({ rideId } = {}, acknowledge) => {
      if (mongoose.Types.ObjectId.isValid(rideId)) socket.leave(`ride:${rideId}`);
      acknowledgeSocketEvent(acknowledge, { ok: true });
    });

    socket.on("ride:driver_location", async ({ rideId, ...location } = {}, acknowledge) => {
      try {
        if (!authenticatedDriver || !mongoose.Types.ObjectId.isValid(rideId)) {
          acknowledgeSocketEvent(acknowledge, { ok: false, error: "RIDE_LOCATION_FORBIDDEN" });
          return;
        }
        const ride = await updateActiveRideLocation({
          rideId,
          driverId: userId,
          payload: location,
        });
        const event = {
          rideId: String(ride._id),
          status: ride.status,
          location: ride.lastDriverLocation,
        };
        io.to(`ride:${ride._id}`).to(String(ride.passengerId)).emit("ride:driver_location", event);
        acknowledgeSocketEvent(acknowledge, { ok: true, ...event });
      } catch (error) {
        const code = error.code || "LOCATION_UPDATE_FAILED";
        acknowledgeSocketEvent(acknowledge, { ok: false, error: code });
        socket.emit("ride:error", { rideId, code });
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

    // Admin realtime tracking of all driver positions. The admin map joins
    // this room once per connection to receive every driver:location update.
    socket.on("driver-map:track", async ({ on = true } = {}, acknowledge) => {
      if (!authenticatedAdmin) {
        acknowledgeSocketEvent(acknowledge, { ok: false, error: "ADMIN_REQUIRED" });
        return;
      }
      if (on) {
        socket.join(ADMIN_TRACKING_ROOM);
      } else {
        socket.leave(ADMIN_TRACKING_ROOM);
      }
      acknowledgeSocketEvent(acknowledge, { ok: true, tracking: Boolean(on) });
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
      if (authenticatedDriver) {
        const remaining = Math.max(
          0,
          (driverSocketCounts.get(userIdString) || 1) - 1
        );
        if (remaining) {
          driverSocketCounts.set(userIdString, remaining);
        } else {
          driverSocketCounts.delete(userIdString);
          const activeDriver = await Driver.findById(userId)
            .select("_id activeRideId isOnline");
          const driver = activeDriver?.activeRideId
            ? await Driver.findByIdAndUpdate(
                userId,
                { $set: { isOnline: false, availabilityStatus: "Busy" } },
                { new: true }
              ).select("_id availabilityStatus updatedAt")
            : await Driver.findByIdAndUpdate(
                userId,
                { $set: { isOnline: false, availabilityStatus: "Offline" } },
                { new: true }
              ).select("_id availabilityStatus updatedAt");
          if (driver) {
            io.emit("driver:availability", {
              driverId: String(driver._id),
              status: driver.availabilityStatus,
              isAvailable: false,
              updatedAt: driver.updatedAt,
            });
          }
        }
      }
    });

    // Authentication and every realtime location handler are installed now.
    // Clients wait for this after each reconnect before resending their latest
    // GPS position or rejoining discovery rooms.
    socket.on("location-tracking-status", (acknowledge) => {
      acknowledgeSocketEvent(acknowledge, { ok: true, ready: true });
    });
    socket.emit("location-tracking-ready", { ready: true });
  } catch (error) {
    console.error("Error during socket connection:", error);
    socket.emit("auth-error", { message: "Your session is invalid or expired" });
    socket.disconnect(true);
  }
});

export { app, server, io };
