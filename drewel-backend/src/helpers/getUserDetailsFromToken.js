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
  let user =
    (await User.findById(userId).select("-password")) ||
    (await Admin.findById(userId).select("-password")) ||
    (await Driver.findById(userId));
  if (!user) {
    user = await Admin.findById(userId).select("-password");
    // console.log('user: from token ', user);

    return { ...user?.toObject(), name: `${user.fullName}` };
  }

  return user;
};

export default getUserDetailsFromToken;
