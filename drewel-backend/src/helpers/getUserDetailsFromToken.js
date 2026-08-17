import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Admin from "../models/Admin.js";
import Driver from "../models/Driver.js";
const getUserDetailsFromToken = async (token) => {
  if (!token) {
    return {
      message: "session out",
      logout: true,
    };
  }

  const decode = jwt.verify(token, process.env.JWT_SECRET);
  const userId = decode?._id || decode?.id;
  const safeSelect = "-otpCode -password";
  let user =
    (await User.findById(userId).select(safeSelect)) ||
    (await Admin.findById(userId).select(safeSelect)) ||
    (await Driver.findById(userId).select(safeSelect));
  if (!user) {
    user = await Admin.findById(userId).select(safeSelect);
    // console.log('user: from token ', user);

    return { ...user?.toObject(), name: `${user.fullName}` };
  }

  return user;
};

export default getUserDetailsFromToken;
