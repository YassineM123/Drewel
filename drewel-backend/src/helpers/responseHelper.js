
export const sendResponse = (res, statusCode, success, message, data = null) => {
  res.status(statusCode).json({ success, message, data });
};
export const sendErrorResponse = (res, statusCode, message) => {
  res.status(statusCode).json({ success: false, message });
};

