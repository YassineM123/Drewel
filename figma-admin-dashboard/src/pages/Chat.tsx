import { useState, useRef, useEffect } from "react";
import { Search, Send, Paperclip, CheckCheck, Check, Wifi } from "lucide-react";
import { Avatar, Badge, EmptyState } from "../components/ui";
import { getChatThreads, getConversationMessages } from "../api";

export default function Chat() {
  const [activeChat, setActiveChat] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [chats, setChats] = useState<any[]>([]);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [mobileView, setMobileView] = useState<"list" | "thread">("list");
  const [chatTab, setChatTab] = useState<"all" | "unread" | "drivers" | "users">("all");
  const [messages, setMessages] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getChatThreads();
        const threads = data.threads ?? data.items ?? data ?? [];
        if (!cancelled) {
          setChats(threads);
          if (threads.length > 0) setActiveChat(threads[0]);
        }
      } catch (err) {
        console.error("Failed to load chat threads", err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!activeChat) return;
    let cancelled = false;
    (async () => {
      try {
        const threadId = activeChat.id ?? activeChat.threadId;
        const data = await getConversationMessages(threadId);
        if (!cancelled) setMessages(data.messages ?? data.items ?? []);
      } catch (err) {
        console.error("Failed to load messages", err);
      }
    })();
    return () => { cancelled = true; };
  }, [activeChat]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeChat]);

  const filteredChats = chats.filter(c => {
    const contactName = c.contact?.name ?? c.participantName ?? c.name ?? "";
    const matchSearch = !search || contactName.toLowerCase().includes(search.toLowerCase());
    const matchTab = chatTab === "all"
      || (chatTab === "unread" && (c.unread ?? 0) > 0)
      || (chatTab === "drivers" && (c.contact?.type ?? c.participantType ?? "") === "driver")
      || (chatTab === "users" && (c.contact?.type ?? c.participantType ?? "") === "user");
    return matchSearch && matchTab;
  });

  const handleSend = () => {
    if (!message.trim() || sending) return;
    setSending(true);
    const newMsg: any = {
      id: Date.now(),
      from: "admin",
      text: message.trim(),
      at: new Date().toISOString(),
      read: true,
    };
    setMessages(prev => [...prev, newMsg]);
    setMessage("");
    setSending(false);
  };

  const handleSelectChat = (chat: any) => {
    setActiveChat(chat);
    setMobileView("thread");
    setChats(prev => prev.map(c => (c.id ?? c.threadId) === (chat.id ?? chat.threadId) ? { ...c, unread: 0 } : c));
  };

  return (
    <div className="flex flex-col gap-0 -mt-8 -mx-8" style={{ height: "calc(100vh - 72px)" }}>
      {/* Page title strip */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-slate-200 bg-white shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Chat</h1>
          <p className="text-sm text-slate-500">Support and operations messaging.</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-medium text-green-600 bg-green-50 border border-green-200 px-2.5 py-1.5 rounded-full">
          <Wifi size={12} /> Connected
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Conversation sidebar */}
        <div className={`w-full lg:w-80 xl:w-96 border-r border-slate-200 flex flex-col bg-white shrink-0
          ${mobileView === "thread" ? "hidden lg:flex" : "flex"}`}>
          {/* Search */}
          <div className="p-3 border-b border-slate-100">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search conversations…"
                className="w-full h-9 bg-slate-50 border border-slate-200 rounded-[8px] pl-8 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 transition-all"
              />
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex border-b border-slate-100" role="tablist">
            {(["all", "unread", "drivers", "users"] as const).map(tab => {
              const label = tab === "all" ? "All" : tab === "unread" ? "Unread" : tab === "drivers" ? "Drivers" : "Users";
              const count = tab === "all" ? undefined
                : tab === "unread" ? chats.filter(c => c.unread > 0).length
                : chats.filter(c => c.contact.type === tab.slice(0, -1)).length;
              return (
                <button
                  key={tab}
                  role="tab"
                  aria-selected={chatTab === tab}
                  onClick={() => setChatTab(tab)}
                  className={`flex-1 py-2.5 text-xs font-medium transition-colors relative
                    ${chatTab === tab ? "text-[#BE1B2C] border-b-2 border-[#BE1B2C] -mb-px" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"}`}
                >
                  {label}
                  {count !== undefined && count > 0 && (
                    <span className="ml-1 text-[10px] bg-red-100 text-red-700 px-1 rounded-full">{count}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto">
            {filteredChats.length === 0 ? (
              <EmptyState title="No conversations" description="Conversations with drivers and users will appear here." />
            ) : filteredChats.map(chat => (
              <button
                key={chat.id ?? chat.threadId}
                onClick={() => handleSelectChat(chat)}
                className={`w-full flex items-start gap-3 px-4 py-3.5 text-left transition-colors border-b border-slate-50
                  ${(activeChat?.id ?? activeChat?.threadId) === (chat.id ?? chat.threadId) ? "bg-red-50/30 border-l-2 border-l-[#BE1B2C]" : "hover:bg-slate-50"}`}
              >
                <div className="relative shrink-0 mt-0.5">
                  <Avatar initials={chat.contact?.avatar ?? chat.participantAvatar ?? "?"} size="sm" />
                  <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white
                    ${(chat.status ?? "open") === "open" ? "bg-green-500" : "bg-slate-300"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-slate-800 truncate">{chat.contact?.name ?? chat.participantName ?? chat.name}</span>
                    <span className="text-xs text-slate-400 shrink-0">{formatRelTime(chat.lastAt ?? chat.updatedAt ?? chat.createdAt)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className="text-xs text-slate-500 truncate">{chat.lastMessage ?? chat.lastMessageText}</p>
                    {(chat.unread ?? 0) > 0 && (
                      <span className="shrink-0 w-5 h-5 rounded-full bg-[#BE1B2C] text-white text-[10px] font-bold flex items-center justify-center">
                        {chat.unread}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium
                      ${(chat.contact?.type ?? chat.participantType ?? "") === "driver" ? "bg-red-50 text-[#BE1B2C]" : "bg-violet-50 text-violet-600"}`}>
                      {chat.contact?.type ?? chat.participantType ?? "user"}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium
                      ${(chat.status ?? "open") === "open" ? "bg-green-50 text-green-600" : "bg-slate-100 text-slate-500"}`}>
                      {chat.status ?? "open"}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Thread */}
        <div className={`flex-1 flex flex-col min-w-0
          ${mobileView === "list" ? "hidden lg:flex" : "flex"}`}>
          {activeChat ? (
            <>
              {/* Thread header */}
              <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-200 bg-white shrink-0">
                <button onClick={() => setMobileView("list")} className="lg:hidden text-slate-500 hover:text-slate-700 mr-1 p-1">
                  ←
                </button>
                <div className="relative shrink-0">
                  <Avatar initials={activeChat.contact?.avatar ?? activeChat.participantAvatar ?? "?"} size="sm" />
                  <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white
                    ${(activeChat.status ?? "open") === "open" ? "bg-green-500" : "bg-slate-300"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{activeChat.contact?.name ?? activeChat.participantName ?? activeChat.name}</p>
                  <p className="text-xs text-slate-400">{activeChat.contact?.id ?? activeChat.participantId ?? activeChat.id} · {activeChat.contact?.type ?? activeChat.participantType ?? ""}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={(activeChat.status ?? "open") === "open" ? "active" : "inactive"} label={activeChat.status ?? "open"} />
                  <button className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-[8px] px-2.5 py-1.5 hover:bg-slate-50 transition-colors">
                    Resolve
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4 bg-[#F6F8FB]">
                {groupByDate(messages).map(([date, msgs]) => (
                  <div key={date}>
                    <div className="flex items-center gap-3 my-3">
                      <div className="flex-1 h-px bg-slate-200" />
                      <span className="text-xs text-slate-400 px-2 shrink-0">{date}</span>
                      <div className="flex-1 h-px bg-slate-200" />
                    </div>
                    <div className="flex flex-col gap-3">
                      {msgs.map((msg: any) => {
                        return (
                          <div key={msg.id} className={`flex items-end gap-2 ${(msg.from ?? msg.sender) === "admin" ? "flex-row-reverse" : "flex-row"}`}>
                            {(msg.from ?? msg.sender) !== "admin" && <Avatar initials={activeChat.contact?.avatar ?? activeChat.participantAvatar ?? "?"} size="xs" />}
                            <div className={`max-w-[70%] group`}>
                              <div className={`px-3.5 py-2.5 rounded-[12px] text-sm leading-relaxed
                                ${(msg.from ?? msg.sender) === "admin"
                                  ? "bg-[#BE1B2C] text-white rounded-br-[4px]"
                                  : "bg-white border border-slate-200 text-slate-700 rounded-bl-[4px]"}`}>
                                {msg.text}
                              </div>
                              <div className={`flex items-center gap-1 mt-1 ${(msg.from ?? msg.sender) === "admin" ? "justify-end" : "justify-start"}`}>
                                <span className="text-[10px] text-slate-400">{formatMsgTime(msg.at ?? msg.createdAt ?? msg.timestamp)}</span>
                                {(msg.from ?? msg.sender) === "admin" && (
                                  msg.read
                                    ? <CheckCheck size={11} className="text-blue-400" />
                                    : <Check size={11} className="text-slate-400" />
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              {/* Composer */}
              <div className="border-t border-slate-200 bg-white px-4 py-3 shrink-0">
                <div className="flex items-end gap-3">
                  <button className="text-slate-400 hover:text-slate-600 p-1.5 rounded-[8px] hover:bg-slate-100 transition-colors shrink-0">
                    <Paperclip size={16} />
                  </button>
                  <div className="flex-1 bg-slate-50 border border-slate-200 rounded-[10px] px-3 py-2.5 min-h-[40px] max-h-32 focus-within:ring-2 focus-within:ring-red-700/20 focus-within:border-red-400 transition-all">
                    <textarea
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                      placeholder="Type a message… (Enter to send)"
                      className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 resize-none focus:outline-none"
                      rows={1}
                    />
                  </div>
                  <button
                    onClick={handleSend}
                    disabled={!message.trim()}
                    className="w-10 h-10 rounded-[10px] bg-[#BE1B2C] hover:bg-[#A31725] text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState title="Select a conversation" description="Choose a conversation from the list to start messaging." />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatRelTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "now";
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function formatMsgTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function groupByDate(messages: any[]): [string, any[]][] {
  const groups: Record<string, any[]> = {};
  for (const msg of messages) {
    const d = new Date(msg.at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    if (!groups[d]) groups[d] = [];
    groups[d].push(msg);
  }
  return Object.entries(groups);
}
