import { resolvePrincipal } from "../services/rideCommunicationPolicy.js";
import {
  ConversationError,
  getConversationForPrincipal,
  getUnreadSummary,
  listConversations,
  markConversationRead,
} from "../services/conversationService.js";

const sendError = (res, error) => res.status(error.statusCode || 500).json({
  success: false,
  code: error.code || "CONVERSATION_ERROR",
  message: error.statusCode ? error.message : "Internal server error",
});

export const listConversationThreads = async (req, res) => {
  try {
    const principal = await resolvePrincipal(req.user?._id);
    const status = String(req.query.status || "all").trim().toLowerCase();
    if (!["all", "active", "completed", "cancelled"].includes(status)) {
      throw new ConversationError("status must be all, active, completed, or cancelled", 400, "INVALID_CONVERSATION_FILTER");
    }
    const unread = req.query.unread === "true";
    const result = await listConversations({
      principal,
      status,
      unread,
      query: String(req.query.q || ""),
      page: req.query.page,
      limit: req.query.limit,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error);
  }
};

export const getConversationThread = async (req, res) => {
  try {
    const principal = await resolvePrincipal(req.user?._id);
    const conversation = await getConversationForPrincipal({
      principal,
      rideId: req.params.rideId,
    });
    return res.json({ success: true, conversation });
  } catch (error) {
    return sendError(res, error);
  }
};

export const readConversationThread = async (req, res) => {
  try {
    const principal = await resolvePrincipal(req.user?._id);
    const conversation = await markConversationRead({
      principal,
      rideId: req.params.rideId,
    });
    return res.json({ success: true, conversation });
  } catch (error) {
    return sendError(res, error);
  }
};

export const conversationSummary = async (req, res) => {
  try {
    const principal = await resolvePrincipal(req.user?._id);
    return res.json({ success: true, ...(await getUnreadSummary({ principal })) });
  } catch (error) {
    return sendError(res, error);
  }
};
