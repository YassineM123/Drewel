import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { format, isToday, isYesterday, parseISO } from "date-fns";
import { SOCKET_URL } from "../../utils/api";
import SafeImage from "../SafeImage";

const HelpSupport = () => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  const ADMIN_ID = "6861224ceac0edaf19ffa056";
  const token = localStorage.getItem("authToken");

  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Sort users by latest chat time
  const sortUsersByLatest = (usersList) =>
    [...usersList].sort(
      (a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt)
    );

  useEffect(() => {
    if (!token) {
      setError("No authentication token found.");
      setLoadingUsers(false);
      return;
    }

    setLoadingUsers(true);
    setError(null);

    const socket = io(SOCKET_URL, {
      transports: ["websocket"],
      auth: { token },
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Socket connected");
      socket.emit("sidebar", ADMIN_ID, page, limit);
    });

    socket.on("conversation", (conversations) => {
      console.log("Received conversations:", conversations);
      const userMap = new Map();

      conversations.forEach((conv) => {
        let userDetails =
          conv.sender?._id === ADMIN_ID ? conv.receiver : conv.sender;

        const userId = userDetails?._id;

        const lastMessageAt =
          conv.lastMsg?.createdAt ||
          userDetails?.updatedAt ||
          userDetails?.createdAt ||
          new Date().toISOString();

        const userData = {
          userDetails,
          lastMessage: conv.lastMsg || { text: "No messages yet" },
          lastMessageAt,
          unseenMsg: conv.unseenMsg || 0,
          conversationId: conv._id,
        };

        // If already exists, keep the latest
        if (!userMap.has(userId)) {
          userMap.set(userId, userData);
        } else {
          const existing = userMap.get(userId);
          if (new Date(lastMessageAt) > new Date(existing.lastMessageAt)) {
            userMap.set(userId, userData);
          }
        }
      });

      const processedUsers = Array.from(userMap.values());
      setUsers(sortUsersByLatest(processedUsers));
      setLoadingUsers(false);
    });


    socket.on("message", (msgs) => {
      setMessages(msgs);
      setLoadingMessages(false);
    });

    socket.on("error", (err) => {
      setError(err?.message || "Socket error");
    });

    socket.on("connect_error", (err) => {
      setError(err?.message || "Socket connection error");
    });

    return () => {
      socket.off("conversation");
      socket.off("message");
      socket.off("error");
      socket.off("connect_error");
      socket.disconnect();
    };
  }, [token]);

  console.log("Selected User ID:", users);
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleUserClick = (user) => {
    setSelectedUser(user.userDetails);
    setSelectedUserId(user.userDetails._id);
    setLoadingMessages(true);
    setMessages([]);

    socketRef.current.emit("message-page", user.userDetails._id);
  };

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedUserId) return;

    const msgPayload = {
      text: newMessage.trim(),
      sender: ADMIN_ID,
      receiver: selectedUserId,
      msgByUserId: ADMIN_ID,
      createdAt: new Date().toISOString(),
      _id: `temp_${Date.now()}`,
    };

    // Optimistic UI
    setMessages((prev) => [...prev, msgPayload]);

    socketRef.current.emit("new message", msgPayload);
    setNewMessage("");
  };

  const groupMessagesByDate = (messages) => {
    return messages.reduce((acc, msg) => {
      const dateKey = msg.createdAt
        ? format(parseISO(msg.createdAt), "yyyy-MM-dd")
        : "Unknown";
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(msg);
      return acc;
    }, {});
  };

  /** Format chat date header */
  const formatDateLabel = (dateStr) => {
    const dateObj = parseISO(dateStr);
    if (isToday(dateObj)) return "Today";
    if (isYesterday(dateObj)) return "Yesterday";
    return format(dateObj, "dd-MM-yyyy");
  };

  return (
    <div className="container-fluid py-4 bg-white" style={{ minHeight: "100vh" }}>
      <div className="row">

        {/* ---------------------------- SIDEBAR ---------------------------- */}
        <div className="col-md-4 border-end" style={{ maxHeight: "90vh", overflowY: "auto" }}>
          <div className="p-3 border-bottom bg-light">
            <h5 className="mb-0">Conversations ({users.length})</h5>
          </div>

          {loadingUsers ? (
            <div className="text-center mt-4">
              <div className="spinner-border text-primary" />
              <div>Loading conversations...</div>
            </div>
          ) : error ? (
            <div className="alert alert-danger mt-4">{error}</div>
          ) : (
            users.map((u) => (
              <div
                key={u.userDetails._id}
                className={`p-3 cursor-pointer border-bottom ${
                  selectedUserId === u.userDetails._id ? "bg-light border-primary border-2" : ""
                }`}
                onClick={() => handleUserClick(u)}
              >
                <div className="d-flex align-items-center">
                  <SafeImage
                    src={
                      u.userDetails.avatarUrl ||
                      u.userDetails.profileImageUrl
                    }
                    alt={u.userDetails.fullName}
                    fallback="avatar"
                    fallbackLabel={u.userDetails.fullName || u.userDetails.firstName}
                    style={{
                      height: "47px",
                      width: "47px",
                      borderRadius: "50%",
                      objectFit: "cover",
                    }}
                  />
                  <div className="ms-3 flex-grow-1">
                    <div className="fw-bold" style={{ fontSize: "14px" }}>
                      {u.userDetails.firstName
                        ? `${u.userDetails.firstName} ${u.userDetails.lastName || ""}`
                        : u.userDetails.fullName}
                    </div>
                    <div className="text-muted" style={{ fontSize: "12px" }}>
                      {u.userDetails.email}
                    </div>
                  </div>
                  {u.unseenMsg > 0 && (
                    <span className="badge bg-danger ms-2">{u.unseenMsg}</span>
                  )}
                </div>
                <div className="mt-1 text-muted" style={{ fontSize: "12px" }}>
                  {u.lastMessage?.text || "No messages yet"}
                </div>
              </div>
            ))
          )}
        </div>

        {/* ---------------------------- CHAT SECTION ---------------------------- */}
        <div className="col-md-8 d-flex flex-column" style={{ height: "90vh" }}>
          {selectedUser ? (
            <>
              <div className="border-bottom p-3 bg-light" style={{ fontWeight: 600, fontSize: 18 }}>
                Chat with{" "}
                {selectedUser.firstName
                  ? `${selectedUser.firstName} ${selectedUser.lastName || ""}`
                  : selectedUser.fullName}
              </div>

              {/* MESSAGES */}
              <div className="flex-grow-1 p-3" style={{ backgroundColor: "#e5ddd5", overflowY: "auto" }}>
                {loadingMessages ? (
                  <div className="text-center mt-4">
                    <div className="spinner-border text-primary" />
                    <div>Loading messages...</div>
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-center text-muted mt-5">
                    No messages yet. Start the conversation!
                  </p>
                ) : (
                  Object.entries(groupMessagesByDate(messages)).map(([date, msgs]) => (
                    <div key={date}>
                      <div
                        className="text-center my-3"
                        style={{
                          fontWeight: 600,
                          fontSize: 12,
                          padding: "4px 12px",
                          backgroundColor: "#e0e0e0",
                          width: "fit-content",
                          margin: "0 auto",
                          borderRadius: 20,
                        }}
                      >
                        {formatDateLabel(date)}
                      </div>

                      {msgs.map((msg) => {
                        const isAdmin = msg.msgByUserId === ADMIN_ID;
                        return (
                          <div
                            key={msg._id}
                            className={`d-flex mb-2 ${
                              isAdmin ? "justify-content-end" : "justify-content-start"
                            }`}
                          >
                            <div
                              style={{
                                maxWidth: "70%",
                                backgroundColor: isAdmin ? "#dcf8c6" : "white",
                                padding: "8px 12px",
                                borderRadius: 15,
                                boxShadow: "0 1px 1px rgba(0,0,0,0.1)",
                                whiteSpace: "pre-wrap",
                              }}
                            >
                              {msg.text}
                              <div
                                style={{
                                  fontSize: 10,
                                  marginTop: 4,
                                  color: "#666",
                                  textAlign: "right",
                                }}
                              >
                                {new Date(msg.createdAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* MESSAGE INPUT */}
              <div className="p-3 border-top d-flex" style={{ gap: 10 }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                />
                <button
                  className="btn btn-primary"
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                >
                  Send
                </button>
              </div>
            </>
          ) : (
            <div className="d-flex justify-content-center align-items-center h-100">
              <p>Select a user to start chatting</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HelpSupport;
