import Friend from "../models/Friend.js";

export const addFriends = async (req, res) => {
  try {
    const { friendIds } = req.body;
    const userId = req.user._id;

    // Validate input
    if (!friendIds || !Array.isArray(friendIds) || friendIds.length === 0) {
      return res.status(200).json({
        success: false,
        message: "At least one friend ID is required.",
      });
    }

    // Remove duplicates from friendIds array
    const uniqueFriendIds = [...new Set(friendIds)];

    // Prepare result arrays
    const alreadyFriends = [];
    const newFriends = [];

    for (const friendId of uniqueFriendIds) {
      // Check if the user is already friends with this user
      const isAlreadyFriend = await Friend.findOne({
        userId,
        friends: { $in: [friendId] },
      });

      if (isAlreadyFriend) {
        alreadyFriends.push(friendId);
        continue;
      }

      // Add the friend if they are not already in the list
      const friendList = await Friend.findOne({ userId });

      if (friendList) {
        // Add the new friend if not already in the friends array
        if (!friendList.friends.includes(friendId)) {
          friendList.friends.push(friendId);
          await friendList.save();
          newFriends.push(friendId);
        } else {
          alreadyFriends.push(friendId);
        }
      } else {
        // Create a new entry for the user if no friends list exists
        const newFriendList = new Friend({
          userId,
          friends: [friendId],
        });
        await newFriendList.save();
        newFriends.push(friendId);
      }
    }

    // Respond with the results
    res.status(200).json({
      success: true,
      message: "Friend requests processed.",
      addedFriends: newFriends,
      alreadyFriends,
    });
  } catch (error) {
    console.log("error: ", error);
    res
      .status(500)
      .json({ success: false, message: "Server error.", error: error.message });
  }
};

export const getFriendsList = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res
        .status(200)
        .json({ success: false, message: "User ID is required." });
    }

    // Find the friend list for the user
    const friendList = await Friend.findOne({ userId }).populate("friends","fullName email phone profilePicture");

    // Return the populated friends list
    res
      .status(200)
      .json({
        success: true,
        message: "friends fetched successfully",
        friends: friendList?.friends ?? [],
      });
  } catch (error) {
    res
      .status(500)
      .json({ success: true, message: "Server error.", error: error.message });
  }
};
