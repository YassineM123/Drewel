import mongoose from "mongoose";
import dns from "node:dns";

dns.setServers(["1.1.1.1", "8.8.8.8"]);
const uri =
  "mongodb+srv://ayush1909kushwah:GHFfJHCkb3weYyS1@ac-vjcjuur.kxo4atz.mongodb.net/?retryWrites=true&w=majority";

await mongoose.connect(uri, { dbName: "drewel-app", family: 4 });

const u = mongoose.connection.db.collection("users");

for (const cc of ["+971", "+216", "+33", "+91", "+1268", "+244", "+355", "+54"]) {
  const users = await u
    .find({ countryCode: cc }, { projection: { phone: 1, isVerified: 1, updatedAt: 1, fullName: 1 } })
    .sort({ updatedAt: -1 })
    .toArray();
  console.log(`\n===== ${cc} (${users.length}) =====`);
  for (const r of users)
    console.log("  ", r.phone, "| len:", String(r.phone).length, "| verified:", r.isVerified, "|", r.updatedAt?.toISOString?.().slice(0, 10), "|", (r.fullName || "").slice(0, 25));
}

await mongoose.disconnect();
