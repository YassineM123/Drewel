import mongoose from "mongoose";
import { sendResponse } from "../helpers/responseHelper.js";
import Group from "../models/Group.js";

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const createGroup = async (req, res) => {
  const { name, members } = req.body || {};
  try {
    const userId = req.user._id;
    if (!name || !Array.isArray(members)) {
      return sendResponse(res, 200, false, "Name and members are required");
    }

    if (members.some((member) => !mongoose.Types.ObjectId.isValid(member))) {
      return sendResponse(res, 400, false, "Members must contain valid user IDs");
    }

    const existingGroup = await Group.findOne({
      $or: [
        {
          name: new RegExp(`^${escapeRegex(name)}$`, "i"),
          createdBy: userId,
        },
      ],
    });
    if (existingGroup) {
      return sendResponse(res, 200, false, "Group already exists");
    }
    const membersArray = members.map((member) => new mongoose.Types.ObjectId(member));
    const group = new Group({
      name,
      members: membersArray,
      createdBy: userId,
    });
    await group.save();
    const populatedGroup = await Group.findById(group._id)
      .populate("members", "fullName email")
      .populate("createdBy", "fullName email");
    return res.status(201).json({
      success: true,
      message: "Group created successfully",
      group: populatedGroup,
    });
  } catch (error) {
    console.log("error: ", error);
    sendResponse(res, 500, false, "Group creation failed", error.message);
  }
};

export const getGroups = async (req, res) => {
  try {
    const userId = req.user._id;
    const groups = await Group.find({
      $or: [{ members: userId }, { createdBy: userId }],
    })
      .populate("members", "fullName email")
      .populate("createdBy", "fullName email");

    const formattedGroups = groups.map((group) => {
      return {
        ...group._doc,
        isCreatedByUser: group.createdBy._id.toString() === userId.toString(),
      };
    });

    return res.status(200).json({
      success: true,
      message: "Groups fetched",
      groups: formattedGroups ?? [],
    });
  } catch (error) {
    console.log("error: ", error);
    sendResponse(res, 500, false, "Failed to fetch groups", error.message);
  }
};
export const getGroupById = async (req, res) => {
  const { groupId } = req.params;
  try {
    const group = await Group.findById(groupId)
      .populate("members", "fullName email")
      .populate("createdBy", "fullName email");
    if (!group) {
      return sendResponse(res, 404, false, "Group not found");
    }
    return res.status(200).json({
      success: true,
      message: "Group fetched",
      group,
    });
  } catch (error) {
    console.log("error: ", error);
    sendResponse(res, 500, false, "Failed to fetch group", error.message);
  }
};
export const updateGroup = async (req, res) => {
  const { groupId } = req.params;
  const { name, members } = req.body || {};
  try {
    const userId = req.user._id;
    if (!name || !Array.isArray(members)) {
      return sendResponse(res, 200, false, "Name and members are required");
    }

    if (members.some((member) => !mongoose.Types.ObjectId.isValid(member))) {
      return sendResponse(res, 400, false, "Members must contain valid user IDs");
    }

    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return sendResponse(res, 400, false, "Please provide a valid group ID");
    }

    const group = await Group.findOneAndUpdate(
      { _id: groupId, createdBy: userId },
      { name, members },
      { new: true }
    )
      .populate("members", "fullName email")
      .populate("createdBy", "fullName email");
    if (!group) {
      return sendResponse(res, 404, false, "Group not found or you are not its owner");
    }
    return res.status(200).json({
      success: true,
      message: "Group updated",
      group,
    });
  } catch (error) {
    console.log("error: ", error);
    sendResponse(res, 500, false, "Group update failed", error.message);
  }
};
