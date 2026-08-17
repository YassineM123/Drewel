# Drewel Admin Figma Mapping

Last updated: 2026-08-15

The folder `Drewel  Admin Dashboard/` is a visual/UX reference. Its mock data is not production logic.

| Figma screen | Production route | API/domain |
| --- | --- | --- |
| Login | `/login` | `POST /api/admin/login` |
| Dashboard | `/` | `GET /api/admin/dashboard` |
| Users | `/users` | `/api/users/get-all`, user admin actions, ride/support summaries |
| Drivers | `/drivers`, `/driver-detail/:id` | `/api/admin/drivers`, `/api/admin/driver/:id`, driver operations summaries |
| Online Drivers | `/onlineDrivers` | `/api/admin/drivers/online`, presence service, marketplace discoverability diagnostics |
| Live Map | `/driver-map` | `/api/admin/drivers/location`, Socket.IO presence/location, marketplace discoverability diagnostics |
| Verification Pending/Approved/Rejected/All | `/requests/*` | `/api/admin/requests`, request audit |
| Reservations/All/Live/Completed/Cancelled | `/reservations`, `/reservations/live`, `/reservations/all`, `/reservations/completed`, `/reservations/cancelled`, `/rides/*` aliases | `/api/admin/rides`, ride lifecycle service |
| Ride Details | `/reservations/:rideId` | `/api/admin/rides/:rideId`, `RideAudit`, `TripOffer` |
| Driver Points Overview | `/driver-points` | `/api/admin/points/overview` |
| Wallets | `/driver-points/wallets` | `/api/admin/points/wallets` |
| Purchase Requests | `/driver-points/purchase-requests` | `/api/admin/points/purchase-requests` |
| Transactions | `/driver-points/transactions` | `/api/admin/points/transactions` |
| Point Packs/Settings | `/driver-points/packs`, `/driver-points/settings` | Owner-only points routes |
| Chat | `/chat` | Conversation and global chat sockets/API |
| Secure Calls | `/calls` | `/api/admin/calls` |
| Sponsor Banners | `/sponsor` | `/api/banner/*` |
| Disputes | `/reservations/disputes`, `/rides/disputes` | `/api/admin/rides?status=disputed`, ride lifecycle service |
| Stuck Rides | `/reservations/stuck`, `/rides/stuck` | `/api/admin/rides?status=stuck`, active ride stale-state query |
| Alerts | Dashboard queues today | Dedicated production-backed page not added in this slice |
| Audit Logs | Ride/request/points audit models | Dedicated production-backed page not added in this slice |
| Team & Roles | Existing admin model and points permissions | Dedicated role-management UI remains partial |
| System Health | Dashboard health panel | Real API/DB/socket/config state, no fake incidents |
| Settings | `/account-settings`, points settings | Personal admin settings and owner-only points settings |

Design migration completed so far: dashboard information hierarchy, burgundy operational visual language, health strip, action queues, KPI density, responsive tables, Users operations table, Drivers operations table/detail sections, reservation route variants, CSV export, sorting, Online Drivers KPI/filter table, Live Driver Map blocked/GPS indicators, masked overview contacts, and truthful empty/error states.
