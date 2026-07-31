import { describe, expect, it } from "vitest";
import {
  chatReducer,
  conversationMatchesSelection,
} from "./ChatContext";

const adminId = "admin-1";
const selectedUser = { _id: "user-a" };

describe("chat conversation scoping", () => {
  it("matches only the selected user's conversation", () => {
    expect(
      conversationMatchesSelection(
        { sender: adminId, receiver: "user-a" },
        selectedUser,
        adminId
      )
    ).toBe(true);
    expect(
      conversationMatchesSelection(
        { sender: "user-b", receiver: adminId },
        selectedUser,
        adminId
      )
    ).toBe(false);
  });

  it("ignores a late response for a different open thread", () => {
    const state = {
      selectedUser,
      messages: [{ _id: "a-1" }],
      currentConversation: { _id: "conversation-a" },
      loading: true,
      error: null,
    };

    const next = chatReducer(state, {
      type: "SET_ACTIVE_CONVERSATION",
      payload: {
        currentUserId: adminId,
        conversation: {
          _id: "conversation-b",
          sender: adminId,
          receiver: "user-b",
          messages: [{ _id: "b-1" }],
        },
      },
    });

    expect(next).toBe(state);
    expect(next.messages).toEqual([{ _id: "a-1" }]);
  });
});
