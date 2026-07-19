import crypto from "node:crypto";
import agoraToken from "agora-token";

const { RtcTokenBuilder, RtcRole } = agoraToken;

export const agoraConfig = () => {
  const appId = String(process.env.AGORA_APP_ID || "").trim();
  const appCertificate = String(process.env.AGORA_APP_CERTIFICATE || "").trim();
  const requestedTtl = Number.parseInt(process.env.AGORA_TOKEN_TTL_SECONDS || "300", 10);
  const ttlSeconds = Math.min(900, Math.max(60, Number.isInteger(requestedTtl) ? requestedTtl : 300));
  if (!appId || !appCertificate) {
    const error = new Error("Agora is not configured");
    error.statusCode = 503;
    error.code = "AGORA_NOT_CONFIGURED";
    throw error;
  }
  return { appId, appCertificate, ttlSeconds };
};

export const generateAgoraChannelName = () => `dw_${crypto.randomBytes(24).toString("base64url")}`;
export const generateAgoraUid = () => crypto.randomInt(1, 0x7fffffff);

export const buildAgoraToken = ({ channelName, uid, nowSeconds = Math.floor(Date.now() / 1000) }) => {
  const { appId, appCertificate, ttlSeconds } = agoraConfig();
  const expiresAtSeconds = nowSeconds + ttlSeconds;
  const token = RtcTokenBuilder.buildTokenWithUid(
    appId,
    appCertificate,
    channelName,
    uid,
    RtcRole.PUBLISHER,
    expiresAtSeconds
  );
  return { appId, channelName, uid, token, expiresAt: new Date(expiresAtSeconds * 1000) };
};
