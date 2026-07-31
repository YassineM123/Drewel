import mongoose from "mongoose";
import { loadEnv } from "../src/utils/loadEnv.js";
import connectDB from "../src/connection.js";
import Ride, { ACTIVE_RIDE_STATUSES } from "../src/models/Ride.js";
import Driver from "../src/models/Driver.js";
import User from "../src/models/User.js";

loadEnv();

const run = async () => {
  await connectDB();
  const active = await Ride.find({ status: { $in: ACTIVE_RIDE_STATUSES } })
    .select("_id passengerId driverId confirmedAt acceptedAt createdAt")
    .sort({ createdAt: 1 })
    .lean();
  const driverIds = new Set();
  const passengerIds = new Set();
  for (const ride of active) {
    const driverId = String(ride.driverId);
    const passengerId = String(ride.passengerId);
    if (driverIds.has(driverId) || passengerIds.has(passengerId)) {
      throw new Error(
        `Duplicate active ride detected at ${ride._id}; resolve duplicates before enabling locks`
      );
    }
    driverIds.add(driverId);
    passengerIds.add(passengerId);
  }

  await mongoose.connection.transaction(async (session) => {
    await Promise.all([
      Driver.updateMany(
        { activeRideId: { $ne: null } },
        { $set: { activeRideId: null, activeRideStartedAt: null } },
        { session }
      ),
      User.updateMany(
        { activeRideId: { $ne: null } },
        { $set: { activeRideId: null, activeRideStartedAt: null } },
        { session }
      ),
    ]);
    for (const ride of active) {
      const startedAt = ride.confirmedAt || ride.acceptedAt || ride.createdAt || new Date();
      await Promise.all([
        Driver.updateOne(
          { _id: ride.driverId },
          {
            $set: {
              activeRideId: ride._id,
              activeRideStartedAt: startedAt,
              availabilityStatus: "Busy",
            },
          },
          { session }
        ),
        User.updateOne(
          { _id: ride.passengerId },
          { $set: { activeRideId: ride._id, activeRideStartedAt: startedAt } },
          { session }
        ),
      ]);
    }
  });
  await Ride.syncIndexes();
  console.log(`Reconciled ${active.length} active ride lock(s)`);
};

run()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
