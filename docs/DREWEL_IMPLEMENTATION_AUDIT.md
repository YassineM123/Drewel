# Drewel Implementation Audit

Last updated: 2026-08-15

## Architecture Map

- Mobile: Flutter passenger and driver modules share one app and route tree.
- Admin: React 18/Vite portal using existing authenticated routes and CSS assets.
- Backend: Express 5 API, MongoDB/Mongoose models, Socket.IO, points/ride/verification services, Firebase/Twilio/Agora/S3 boundaries.
- Database: MongoDB with transaction-required points and ride lifecycle logic.
- Maps/location: Google Maps on supported mobile/web targets, OSM fallback on unsupported desktop, backend Routes API boundary.
- Notifications: persisted notification model, device-token registration, Firebase provider boundary.
- Deployment: backend API, React admin root, Flutter web under `/app/`, PM2/Nginx/Render assets documented.

## Findings

- Admin dashboard was PARTIAL: it used the real `/api/admin/dashboard` endpoint but only exposed four counters and kept fake onboarding/IP content.
- Admin design migration was PARTIAL: production pages existed, but dashboard and legacy color tokens still reflected the older blue template.
- Online and discoverable drivers were correctly distinct in backend services, but the dashboard did not surface that difference.
- Critical backend domains are present and server-authoritative: Trip Offers, points wallet, ride lifecycle, verification decisions, admin ride mutations and audit records.
- Dedicated Figma pages for Alerts, Audit Logs, Team & Roles, and full System Health remain PARTIAL unless/until backed by product-specific endpoints and permissions.
- Existing unrelated Flutter edits were present in passenger and driver account controllers before this slice and were not touched.

## Implemented From Audit

- Expanded `/api/admin/dashboard` with real operational counts across approvals, rides, Trip Offers, points, chat, calls, discoverability, and health.
- Rebuilt the production admin dashboard presentation around the enhanced real payload.
- Added responsive dashboard CSS using Drewel burgundy identity.
- Removed dashboard fake IP/onboarding content and hardcoded sidebar admin identity.
- Added architecture, feature matrix, Figma mapping, realtime event, and implementation summary documentation.
- Added production-backed Reservation route variants for Live, All, Completed, Cancelled, Disputes and Stuck Rides.
- Added backend ride-list aliases and sort validation instead of client-only status logic.
- Fixed the admin Ride Detail dispute-resolution request contract.
- Added server-computed discoverability diagnostics to admin online-driver and driver-location responses.
- Updated Online Drivers to use Figma-style KPIs, filters, GPS diagnostics, masked contacts, and preserved real approval/detail actions.
- Updated Live Driver Map markers and popups to explain blocked discoverability and GPS warnings while preserving existing realtime events.
- Added operational driver summaries to admin driver list/detail responses using existing Driver, Ride, TripOffer, points wallet, call, and audit models.
- Updated Drivers page with server-side search/filter/sort/pagination, operational KPI cards, points/rides/GPS/document columns, and masked contact values.
- Updated Driver Detail to combine the existing verification workflow with production-backed activity, points, discoverability, ride, TripOffer and call metadata.
- Added operational user summaries to `/api/users/get-all` using existing User, Ride, RideMessage and CallSession models.
- Updated Users page with server-side search/filter/sort/pagination, KPI cards, ride/support/account state columns, masked phone values, refresh and preserved account actions.
