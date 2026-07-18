import "dotenv/config";
import { createRequire } from "node:module";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import User from "./src/models/User.js";

const require = createRequire(import.meta.url);
const { io } = require(
  "/var/www/drewel/drewel-admin-panel/node_modules/socket.io-client"
);

await mongoose.connect(process.env.MONGO_URI, {
  dbName: process.env.MONGO_DB_NAME || undefined,
});
const user = await User.findOne().select("_id").lean();
if (!user) throw new Error("No user exists for authenticated verification");
const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, {
  expiresIn: "2m",
});
await mongoose.connection.close();

for (const url of [
  "http://127.0.0.1:5000/api/driver/available?vehicleType=Small%20Pickup",
  "https://admin-dreewel.com/api/driver/available?vehicleType=Small%20Pickup",
]) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await response.json();
  console.log(
    JSON.stringify({
      check: url.startsWith("https:") ? "external-rest" : "local-rest",
      status: response.status,
      success: body.success,
      count: Array.isArray(body.drivers) ? body.drivers.length : null,
    })
  );
  if (!response.ok || body.success !== true || body.drivers?.length !== 1) {
    throw new Error(`REST verification failed for ${url}`);
  }
}

const socketCount = await new Promise((resolve, reject) => {
  const socket = io("http://127.0.0.1:5000", {
    auth: { token },
    transports: ["websocket"],
    timeout: 5000,
  });
  let joinRetry;
  const timer = setTimeout(() => {
    clearInterval(joinRetry);
    socket.disconnect();
    reject(new Error("Socket verification timed out"));
  }, 8000);

  socket.on("connect", () => {
    const join = () =>
      socket.emit("join-city-room", {
      city: "Abu Dhabi",
      vehicleType: "Small Pickup",
      });
    join();
    joinRetry = setInterval(join, 500);
  });
  socket.on("connect_error", (error) => {
    clearTimeout(timer);
    clearInterval(joinRetry);
    socket.disconnect();
    reject(error);
  });
  socket.on("drivers-nearby", (payload) => {
    if (payload?.type !== "INITIAL") return;
    clearTimeout(timer);
    clearInterval(joinRetry);
    const count = Array.isArray(payload.drivers) ? payload.drivers.length : -1;
    socket.disconnect();
    resolve(count);
  });
});

console.log(JSON.stringify({ check: "socket-initial", count: socketCount }));
if (socketCount !== 1) throw new Error("Socket verification returned an unexpected count");
