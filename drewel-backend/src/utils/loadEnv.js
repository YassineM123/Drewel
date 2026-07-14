import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

export const loadEnv = () => {
  const existingEnvKeys = new Set(Object.keys(process.env));

  dotenv.config({ path: path.join(projectRoot, ".env") });

  const localEnvPath = path.join(projectRoot, ".env.local");
  if (!fs.existsSync(localEnvPath)) return;

  const localEnv = dotenv.parse(fs.readFileSync(localEnvPath));
  for (const [key, value] of Object.entries(localEnv)) {
    if (!existingEnvKeys.has(key)) {
      process.env[key] = value;
    }
  }
};
