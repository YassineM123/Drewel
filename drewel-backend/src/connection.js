import mongoose from "mongoose";
import colors from "colors";
import dns from "node:dns";

export const parseMongoDnsServers = (value = "") =>
  String(value)
    .split(",")
    .map((server) => server.trim())
    .filter(Boolean);

export const configureMongoSrvDns = (
  uri,
  configuredServers = process.env.MONGO_DNS_SERVERS || "",
  dnsAdapter = dns
) => {
  const servers = parseMongoDnsServers(configuredServers);
  if (!String(uri).startsWith("mongodb+srv://") || servers.length === 0) {
    return [];
  }

  try {
    dnsAdapter.setServers(servers);
  } catch (error) {
    throw new Error(`Invalid MONGO_DNS_SERVERS configuration: ${error.message}`);
  }

  return servers;
};

const resolveMongoConfig = () => {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || "";
  const dbName = process.env.MONGO_DB_NAME || "drewel-app";
  const forceIpv4 = String(process.env.MONGO_FORCE_IPV4 || "false").toLowerCase() === "true";
  return { uri, dbName, forceIpv4 };
};

async function connectDB() {
  const { uri, dbName, forceIpv4 } = resolveMongoConfig();

  if (!uri) {
    throw new Error(
      "Missing MongoDB connection string. Set MONGO_URI (or MONGODB_URI) in environment variables."
    );
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  try {
    const dnsServers = configureMongoSrvDns(uri);
    if (dnsServers.length > 0) {
      console.log(`MongoDB SRV DNS override enabled: ${dnsServers.join(", ")}`);
    }

    const connectOptions = {
      dbName,
      serverSelectionTimeoutMS: 30000,
    };

    if (forceIpv4) {
      // Some local networks fail IPv6/NAT64 lookups for Atlas. Force IPv4 when requested.
      connectOptions.family = 4;
    }

    await mongoose.connect(uri, connectOptions);

    mongoose.connection.on("connected", () => {
      console.log("Connected to DB");
    });

    mongoose.connection.on("error", (error) => {
      console.log("Something is wrong in MongoDB", error);
    });

    console.log(`MongoDB Connected: ${mongoose.connection.host}`.bgBlue.white);
    return mongoose.connection;
  } catch (error) {
    const causes = error?.cause?.errors || [];
    const causeMessages = causes
      .map((cause) => cause?.message)
      .filter(Boolean)
      .join(" | ");

    console.error("MongoDB connection failed.");
    console.error(`- DB Name: ${dbName}`);
    console.error(`- Force IPv4: ${forceIpv4}`);
    if (causeMessages) {
      console.error(`- Network errors: ${causeMessages}`);
    }

    console.error(
      "- Tips: verify Atlas Network Access (IP allowlist), confirm URI/credentials, and try MONGO_FORCE_IPV4=true on IPv6-restricted networks."
    );
    throw error;
  }
}

export default connectDB;
