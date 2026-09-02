import mongoose from "mongoose";
import dotenv from "dotenv";
import Admin from "../src/models/Admin.js";

dotenv.config();

const EMAIL = "admin@gmail.com";
const NEW_NAME = "Riadh Slama";

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const admin = await Admin.findOne({ email: EMAIL });
  if (!admin) {
    console.error(`No admin found with email ${EMAIL}`);
    process.exit(1);
  }

  admin.fullName = NEW_NAME;
  await admin.save();
  console.log(`Updated ${EMAIL} fullName -> "${NEW_NAME}"`);
  process.exit(0);
};

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
