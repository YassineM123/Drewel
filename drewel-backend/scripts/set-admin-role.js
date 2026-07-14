import "dotenv/config";
import mongoose from "mongoose";
import validator from "validator";
import Admin from "../src/models/Admin.js";

const uri = process.env.MONGO_URI || process.env.MONGODB_URI || "";
const dbName = process.env.MONGO_DB_NAME || "drewel-app";
const email = String(process.argv[2] || process.env.ADMIN_EMAIL || "")
  .trim()
  .toLowerCase();

const run = async () => {
  if (!uri) {
    throw new Error("Set MONGO_URI (or MONGODB_URI) before running this command.");
  }
  if (!validator.isEmail(email)) {
    throw new Error(
      "Provide exactly one valid account email: npm run repair:admin-role -- admin@example.com"
    );
  }

  await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 30000 });
  const admin = await Admin.findOne({ email }).select("email role").lean();
  if (!admin) {
    throw new Error(`No admin account exists for ${email}.`);
  }
  if (admin.role === "admin") {
    console.log(`${email} already has the admin role; no change was needed.`);
    return;
  }

  const result = await Admin.updateOne(
    { _id: admin._id },
    { $set: { role: "admin" } }
  );
  if (result.matchedCount !== 1) {
    throw new Error(`The account for ${email} no longer exists; no update was applied.`);
  }
  console.log(
    result.modifiedCount === 1
      ? `Admin role granted to the explicitly selected account: ${email}`
      : `${email} already has the admin role; no change was needed.`
  );
};

run()
  .catch((error) => {
    console.error("Admin role repair failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });
