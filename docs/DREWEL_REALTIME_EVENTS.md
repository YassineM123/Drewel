# Drewel Realtime Events

Last updated: 2026-08-15

## Socket Ownership

- Backend Socket.IO server: `drewel-backend/src/socket/index.js`.
- Admin socket client: `drewel-admin-panel/src/context/SocketContext.jsx`.
- Admin chat socket client: `drewel-admin-panel/src/context/ChatContext.jsx`.
- Flutter socket service: `lib/common/socket_services.dart`.

## Known Events

| Event | Direction | Owner | Purpose |
| --- | --- | --- | --- |
| `connect`, `disconnect`, `connect_error`, `auth-error` | server -> client | Socket auth/session | Connection lifecycle and invalid admin/mobile sessions. |
| `onlineUser` | server -> admin | Presence/chat compatibility | Legacy online-user snapshot. |
| `driver:presence` | server -> admin/mobile | Driver presence service | Versioned driver online/offline heartbeat updates. |
| `driver:location` / location update events | server -> clients | Driver location service | Live driver location and freshness updates. |
| `sidebar` | admin -> server | Global/support chat | Request conversation sidebar page. |
| `conversation` | server -> admin | Global/support chat | Conversation list response. |
| `message-page` | admin -> server | Chat | Load selected conversation. |
| `message` | server -> admin | Chat | Selected conversation payload/update. |
| `new message` | admin -> server | Chat | Send chat message. |
| `seen` | admin -> server | Chat | Mark messages read. |
| `global-message-page`, `globalMessages`, `new global message` | both | Support/global chat | Admin support chat compatibility path. |

## Rules

- Do not update selected admin chat state from a late event for a different conversation; use stable conversation IDs.
- Presence updates must compare `presenceVersion` before applying UI state.
- Driver discovery remains backend-authoritative; the UI may show online and discoverable counts separately but must not recompute the rules.
- Reconnect handling must clean up duplicate listeners.
