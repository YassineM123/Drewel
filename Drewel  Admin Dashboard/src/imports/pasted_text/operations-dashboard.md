You are rebuilding the Drewel Admin Dashboard into a production-ready premium operations dashboard.

Important product context:
Drewel is NOT Uber-style automatic dispatch. Drewel is an offer-driven marketplace:
1. Passenger selects a nearby driver.
2. Passenger sends ride request details.
3. Driver sends the official priced Trip Offer.
4. Passenger accepts or declines.
5. Backend controls offer status, points reservation/capture/release, ride activation, cancellation, and disputes.

Your task:
Fix and improve the entire admin dashboard so it matches Drewel’s real product, not a generic ride-hailing mockup.

Brand:
- Use Drewel branding.
- Primary color: burgundy #BE1B2C.
- Accent: amber/gold.
- Background: clean light neutral.
- Text: charcoal #222222 and muted gray #868686.
- Use Poppins.
- Make admin feel premium, operational, dense, professional, and easy to scan.
- Avoid generic blue SaaS styling.
- Avoid decorative fake cards that do not support workflows.

Localization:
- Remove fake Nigeria/Lagos/Abuja/₦ data unless explicitly configured.
- Do not show “761d ago” or stale fake dates.
- Use realistic current relative timestamps from data.
- Keep sample data privacy-safe.
- Support Arabic/RTL-ready layout where needed.

Routes and navigation:
Map the design to the existing Drewel admin structure:
- Dashboard
- Users
- Drivers
- Online Drivers
- Driver Live Map
- Requests:
  - Pending Requests
  - Approved Requests
  - Rejected Requests
  - All Requests
- Reservations
- Reservation/Ride Detail
- Chat
- Secure Calls
- Driver Points:
  - Overview
  - Wallets
  - Wallet Detail
  - Purchase Requests
  - Transactions
  - Packs
  - Settings
- Sponsor / CMS / FAQ / Notifications / Account Settings

Do not invent duplicate systems. Reuse existing backend concepts:
- Ride
- TripOffer
- CallSession
- Socket.IO
- ride chat
- Driver Points wallet
- point purchase requests
- ride transition service
- admin audit logs

Dashboard requirements:
Create a real operations overview with:
- Total users
- Total drivers
- Online drivers
- Discoverable drivers
- Restricted users/drivers
- Pending Approval 1
- Pending Approval 2
- Active reservations/rides
- Offer pending rides
- Completed today
- Cancelled today
- Open disputes
- Stuck rides
- Low-balance drivers
- Pending point purchase requests
- Unread support chats
- Reported secure calls
- System/realtime health indicators

Important:
Online driver count is not the same as discoverable driver count.
A discoverable driver must be:
- approved
- unrestricted
- online
- availabilityStatus = Online
- no active ride
- has valid GeoJSON GPS
- fresh locationUpdatedAt
- acceptable locationAccuracyM
- inside active service area
- matching vehicle type when filtered

Reservations:
Build a complete Reservations workflow using real ride lifecycle data:
- search
- pagination
- status filter
- vehicle type filter
- city/service-area filter
- date filter
- passenger filter
- driver filter
- lifecycle buckets:
  - requested
  - searching
  - offer_pending
  - accepted
  - on_the_way
  - arrived
  - in_progress
  - completed
  - cancelled
  - disputed
  - stuck
- detail page actions:
  - inspect ride
  - cancel ride with reason
  - resolve dispute
  - unlock participants
  - refund driver points when allowed
All sensitive actions must require confirmation, reason, idempotency key, and backend audit.

Verification:
Improve the driver verification admin:
- Approval 1 and Approval 2 must be clearly separated.
- Show document status, requester, submitted date, reviewer, SLA age, and overall state.
- Include review detail page.
- Allow approve/reject/reopen only through backend.
- Rejection requires reason.
- Preserve request history.

Driver Points:
Keep all points logic server-authoritative.
Add/admin credit must not directly fake wallet values in frontend.
Required pages:
- Overview
- Wallets
- Wallet detail
- Purchase requests
- Transactions
- Packs/settings for owner only
Rules:
- Welcome points default: 100.
- Ride offer cost default: 20.
- Low balance threshold default: 20.
- Offer TTL default: 300 seconds unless backend settings say otherwise.
- Purchase approval must require verified payment reference.
- Duplicate payment reference must be rejected.
- Audit all admin changes.
- Show available points, reserved points, purchased points, bonus points, consumed points, active offers, and last transaction.

Chat:
Fix support chat as real operational messaging:
- All / Unread / Drivers / Users filters must work.
- Conversation selection must not be replaced by late socket events from another user.
- Show unread counts.
- Preserve participant identity.
- Do not expose private phone numbers.
- Keep ride chat separate from support chat unless explicitly linked.

Secure Calls:
Build metadata-only admin page:
- No audio recording.
- No call tokens.
- No phone numbers.
- Show callId, rideId, caller role/name, receiver role/name, status, started time, duration, end reason, reported flag.
- Reported calls need safety review state.

Online Drivers / Live Map:
Build real map/list views:
- Refresh REST data.
- Subscribe to Socket.IO driver location updates.
- Show GPS freshness, accuracy, heading, vehicle type, availability, active ride state.
- Show stale GPS warning.
- Do not fake GPS.
- Do not show map markers for invalid/stale locations.
- Explain mismatch between online and discoverable counts in the UI.

System Health:
Use real backend health endpoints where available.
Show:
- API status
- Socket.IO connection
- database status if available
- location stream freshness
- notification status
- last successful sync
Do not show fake incident IDs unless connected to real data or marked as sample.

Permissions:
Use admin roles:
- Owner
- Admin
- Finance Admin
- Support Admin
- Verification Admin
Restrict dangerous actions:
- point settings: owner only
- manual point credit/refund: owner or authorized finance only
- verification decisions: authorized verification/admin only
- secure call review: authorized support/safety admin only

UX quality:
- Use a responsive sidebar.
- Mobile sidebar must be accessible.
- Use proper loading, empty, error, retry states.
- Tables must not overflow badly on mobile.
- Use badges for statuses.
- Use icons for actions.
- Keep buttons clear and consistent.
- Add search and filters that actually affect results.
- Export CSV should create a real file from current filtered data.
- Refresh should actually reload data.
- Avoid nested cards.
- Avoid fake decorative charts unless backed by data.

Technical requirements:
- Connect all pages to real API contracts.
- Do not keep important values only in local React state.
- Handle auth token expiration.
- Handle 401/403 clearly.
- Use idempotency keys for mutation actions.
- Add error handling and confirmation dialogs for dangerous actions.
- Keep existing backend architecture.
- Do not create duplicate Ride, CallSession, TripOffer, chat, or points systems.
- Add focused tests for changed API utilities and critical UI behavior.
- Run build and tests after implementation.

Final deliverable:
Return a complete improved admin dashboard implementation with:
1. Updated layout/navigation.
2. Updated dashboard page.
3. Updated reservations pages.
4. Updated verification pages.
5. Updated online driver/map pages.
6. Updated driver points pages.
7. Updated chat/calls pages where needed.
8. Real API integration.
9. Loading/error/empty states.
10. Role-based permissions.
11. Build/test validation summary.

Do not deliver a mock-only prototype. The final result must be ready to integrate into the existing Drewel React admin and Express/MongoDB backend.