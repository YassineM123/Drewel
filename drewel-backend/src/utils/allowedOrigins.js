const defaultAllowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:59957",
  "http://16.171.16.218",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:59957",
  "https://www.admin-dreewel.com",
  "https://admin-dreewel.com",
];

export const getAllowedOrigins = () => [
  ...new Set([
    ...defaultAllowedOrigins,
    ...String(process.env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  ]),
];

export const isOriginAllowed = (origin) => {
  if (!origin) return true;
  if (String(origin).startsWith("http://localhost:")) return true;
  if (String(origin).startsWith("http://127.0.0.1:")) return true;
  return getAllowedOrigins().includes(origin);
};
