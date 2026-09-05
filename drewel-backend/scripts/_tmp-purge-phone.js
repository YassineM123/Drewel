import mongoose from "mongoose";
import connectDB from "../src/connection.js";
import { loadEnv } from "../src/utils/loadEnv.js";

const PHONE = process.argv[2] || "95160817";

const run = async () => {
  loadEnv();
  await connectDB();
  const db = mongoose.connection.db;

  const driver = await db.collection("drivers").findOne({ phone: PHONE });
  const user = await db.collection("users").findOne({ phone: PHONE });

  console.log("Driver match:", driver ? { _id: driver._id, fullName: driver.fullName, isDeleted: driver.isDeleted } : null);
  console.log("User match:", user ? { _id: user._id, fullName: user.fullName || user.name } : null);

  const result = { driverId: driver?._id || null, userId: user?._id || null, deleted: {} };
  const del = async (name, collection, filter) => {
    const r = await db.collection(collection).deleteMany(filter);
    result.deleted[name] = r.deletedCount;
  };

  if (driver) {
    const driverId = driver._id;
    const rideIds = (await db.collection("rides").find({ driverId }, { projection: { _id: 1 } }).toArray()).map(r => r._id);

    if (rideIds.length) {
      await del("ridemessages", "ridemessages", { rideId: { $in: rideIds } });
      await del("rideaudits", "rideaudits", { rideId: { $in: rideIds } });
      await del("rideinternalnotes", "rideinternalnotes", { rideId: { $in: rideIds } });
      await del("ridesafetyactions", "ridesafetyactions", { rideId: { $in: rideIds } });
      await del("communicationaudits", "communicationaudits", { rideId: { $in: rideIds } });
      await del("calllogs_byRide", "calllogs", { rideId: { $in: rideIds } });
    }

    await del("driverlogs", "driverlogs", { driverId });
    await del("driverpointswallets", "driverpointswallets", { driverId });
    await del("pointtransactions", "pointtransactions", { driverId });
    await del("pointpurchaserequests", "pointpurchaserequests", { driverId });
    await del("tripoffers_driver", "tripoffers", { driverId });
    await del("rideconversations_driver", "rideconversations", { driverId });
    await del("calllogs_driver", "calllogs", { driverId });
    await del("driverrankings", "driverrankings", { driverId });
    await del("pointsadminaudits", "pointsadminaudits", { driverId });
    await del("requestaudits", "requestaudits", { requestId: driverId });
    await del("rides_asDriver", "rides", { driverId });
    await del("driver", "drivers", { _id: driverId });
  }

  if (user) {
    const userId = user._id;
    await del("devicetokens", "devicetokens", { userId });
    await del("friends", "friends", { userId });
    await del("supportreports", "supportreports", { userId });
    await del("notifications", "notifications", { userId });
    await del("userpreferences", "userpreferences", { userId });
    await del("savedplaces", "savedplaces", { userId });
    await del("rides_asPassenger", "rides", { passengerId: userId });
    await del("calllogs_passenger", "calllogs", { passengerId: userId });
    await del("rideconversations_passenger", "rideconversations", { passengerId: userId });
    await del("tripoffers_passenger", "tripoffers", { passengerId: userId });
    await del("user", "users", { _id: userId });
  }

  await del("otps", "otps", { phone: PHONE });

  console.log(JSON.stringify(result, null, 2));
  await mongoose.connection.close();
};

run().catch(async (e) => {
  console.error(e);
  if (mongoose.connection.readyState !== 0) await mongoose.connection.close();
  process.exit(1);
});
