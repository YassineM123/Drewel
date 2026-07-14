const defaultAllowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://16.171.16.218",
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
  return getAllowedOrigins().includes(origin);
};
