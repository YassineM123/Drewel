import "dotenv/config";
import mongoose from "mongoose";
import Driver from "./src/models/Driver.js";
import driverRoutes from "./src/routes/driverRoutes.js";
import {
  buildAvailableDriverFilter,
} from "./src/utils/availableDrivers.js";

const availableRoute = driverRoutes.stack.find(
  (layer) => layer.route?.path === "/available" && layer.route.methods?.get
);
if (!availableRoute) throw new Error("GET /driver/available is not registered");

await import("./src/socket/index.js");

await mongoose.connect(process.env.MONGO_URI, {
  dbName: process.env.MONGO_DB_NAME || undefined,
});

const discoverable = await Driver.countDocuments(buildAvailableDriverFilter());
const ajmanRecovery = await Driver.countDocuments(
  buildAvailableDriverFilter({ city: "Ajman", vehicleType: "Recovery" })
);

console.log(JSON.stringify({ routeLoaded: true, socketLoaded: true, discoverable, ajmanRecovery }));
await mongoose.connection.close();
