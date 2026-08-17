# Drewel — Complete AI-Ready Project Specification & Implementation Roadmap

Generated: August 2026. This document is the single source of truth for an AI coding agent (or human) tasked with finishing, hardening, or extending the **Drewel** ride-hailing platform. It contains (1) a full specification of what exists today, and (2) a numbered set of copy-paste implementation prompts, ordered by priority, that an agent can execute directly.

---

## PART 1 — PROJECT SPECIFICATION

### 1. Goal and purpose

Drewel is a **private-hire / ride-hailing platform** operating in **Dubai (UAE)**. It connects **passengers** with **drivers** in real time. Unlike classic Uber-style automatic dispatch, Drewel uses an **offer-driven marketplace**: passengers see nearby available drivers, pick one or receive a contact ride, and the driver responds with a **priced Trip Offer**. There is no payment gateway: trips are paid via an internal **Driver Points** economy (drivers buy point packs through admin-approved purchase requests, spend points to send ride offers, and earn a welcome bonus — cash payments are settled offline). The backend is the system of record; the mobile app and a React **operations panel** (admin) are thin clients.

Three deployable artifacts live in one repository:

| Component | Path | Tech |
|---|---|---|
| Mobile app (user + driver) | `lib/` (repo root, Flutter) | Flutter / Dart, GetX |
| Backend API + realtime | `drewel-backend/` | Node.js ≥20, Express 5, Mongoose 8, Socket.IO 4 |
| Admin operations panel | `drewel-admin-panel/` | React 18, Vite 6, Tailwind 4, jQuery |
| Tests | `test/`, `drewel-backend/test/`, `drewel-admin-panel/src/**/*.test.*` | flutter_test, node:test, vitest |

### 2. Current state / progress

The project is **feature-complete and in a QA/hardening phase** (recent commits: "same bugs fixed", "Fixed otp", "fixed real time location", "Fix silent failure in purchase request transition form", points system, ride lifecycle). Uncommitted working-tree changes exist in the Flutter app (OTP layout, HTTP timeout handling, documents view). No CI pipeline exists. Deployments are on **Render** (free plan) via `render.yaml`, plus container Dockerfiles.

### 3. Architecture

- **Monolith-with-realtime**: one Node.js process serves both the REST API and Socket.IO (`src/socket/index.js` exports `app`/`server`; `index.js` mounts routes and boots).
- **Flutter app**: GetX (controllers + bindings + views), a `MyHttp` client wrapper (`lib/common/http_methods.dart`) with interceptors, per-module repositories for ride points/calls/messages, and a Socket.IO service wrapper (`lib/common/socket_services.dart`).
- **Admin panel**: React Router + AuthContext, axios clients (`src/utils/*.js`), jQuery for legacy treeview behavior, Leaflet for map tracking.
- **Data layer**: MongoDB (Mongoose). Unique partial indexes enforce one-active-ride-per-driver/user and one-open-contact-per-pair; these require a **replica set** (transactions also require it).
- **State machine** is the heart of the domain (see section 7).

### 4. Backend structure & endpoints (key files)

**Entry / infra**
- `drewel-backend/index.js` — app setup, CORS allowlist, bootstrap local admin, global error handler, health endpoints (`/api/health`, `/health`, `/`).
- `src/socket/index.js` — Socket.IO server with JWT auth, discovery rooms, realtime location, ride rooms, admin tracking room, chat.
- `src/connection.js`, `src/utils/loadEnv.js`, `src/utils/allowedOrigins.js`, `src/utils/publicAssets.js`, `src/utils/fileServing.js`.
- `src/middlewares/` — `authMiddleware.js` (requireSignIn, isAdmin, isVerified), `marketplaceRateLimit.js`, `pointsRateLimit.js`, `pointsAuthorization.js`.
- `src/jobs/` — `callExpiryJob.js` (call watchdog), `pointsJobs.js` (offers/outbox).
- `scripts/` — backfill + repair + audit tools (see section 10).

**Route groups (all under `/api`)**

| Router | Notable endpoints | Guards |
|---|---|---|
| `users` | `POST /register`, `/login`, `/forgot-password`, `/verify-otp`, `/send-otp-whatsapp`, `/verify-otp-whatsapp`, `POST /reset-password`, `POST /add-profile-picture`, `POST /add-personal-details` (doc upload), `GET /get-image/:fileName` (public), `GET /get-user`, `GET /get-user-details/:id`, `POST /update-profile`, `POST /toggle-restriction`, `GET /restricted`, `GET /get-all` (admin), delete variants | sign-in where noted |
| `driver` | `GET /available`, `GET /:id/availability`, `POST /request`, `GET /:id/status`, `POST /:id/complete-profile`, `POST /add-personal-details`, `POST /update-personal-details`, `PUT /update-driver-details/:driverId`, `POST /addDriver` (admin), `GET /get-driver-details/:id`, `GET /all-drivers` (admin), `POST /update-online-status`, `POST /update-location`, GET/PUT admin toggle routes, deletes | sign-in |
| `rides` | `POST /contact`, `GET /active`, `GET /mine`, `GET /:rideId`, `POST /:rideId/confirm`, `PATCH /:rideId/status`, `POST /:rideId/cancel`, `GET /:rideId/route`, `POST /:rideId/location`, `GET /:rideId/calls`, `GET|POST /:rideId/messages`, `PATCH /:rideId/messages/:messageId/receipt`, `POST /:rideId/report`, `POST /:rideId/block` | sign-in + rate limits |
| `trip-offers` | `POST /`, `GET /`, `POST /:id/accept`, `POST /:id/decline` (drivers create pricing offers; users accept/decline) | sign-in + points rate limits |
| `driver/points` | `GET /wallet`, `/transactions`, `/packs`, `POST /purchase-requests`, `GET /purchase-requests` | sign-in |
| `admin/points` | overview, drivers/wallets, transactions, audits, purchase-requests (list/patch/credit), credit/debit, settings (owner), packs (owner) | sign-in + RBAC + rate limits |
| `admin` | `POST /login`, `POST /register`, `GET /dashboard`, drivers (online/location/all/:id), requests workflow (list/details/documents/approve/reject/reopen/history), `GET /calls`, rides list/detail, admin ride actions (cancel, dispute resolve, unlock, refund-points), `PUT /driver/:id/status` legacy | requireSignIn + isAdmin |
| `calls` | call session lifecycle | sign-in |
| `banner`, `notification`, `expenses`, `friend`, `group` | content/legacy features | mixed |
| `api/*` | catch-all 404 handler; global error handler | — |

### 5. Models (Mongoose, all in `drewel-backend/src/models/`)

`User`, `Driver`, `Admin`, `Ride`, `RideAudit`, `RideMessage`, `RideSafetyAction`, `TripOffer`, `DriverPointsWallet`, `PointTransaction`, `PointPack`, `PointPurchaseRequest`, `PointsSettings`, `PointsOutboxEvent`, `PointsAdminAudit`, `otp`, `Notification`, `ConversationModel` (+`MessageModel`), `Group`, `Friend`, `Expense`, `Driverlogs`, `CallSession`, `CommunicationAudit`, `Banner`.

**`Ride` lifecycle (important)**: statuses `contacting, requested, accepted, driver_arriving, offer_pending, confirmed, driver_on_the_way, driver_arrived, pickup_confirmed, in_progress, completed, cancelled, cancelled_by_user, cancelled_by_driver, cancelled_by_admin, disputed`. `ACTIVE_RIDE_STATUSES` guard the unique active indexes. The **state machine** lives in `src/services/rideTransitionService.js`: valid transitions per status, role-based actions, idempotency keys, optimistic concurrency (`stateVersion`), Mongo transactions, geofence proximity checks (`PICKUP_GEOFENCE_METERS`, `DESTINATION_GEOFENCE_METERS`), pickup-PIN (scrypt hash + AES-256-GCM encryption, max attempts + lockout window), cancellation captures points (`captured_no_refund`) with admin-review flag.

**`Driver`**: countryCode (default +91), phone (unique, 6–14 digits), verification fields, document URL fields (license, ID, passport…), `currentLocation` GeoJSON, `isOnline`, `availabilityStatus` (Online/Busy/Offline), `currentServiceArea`, `activeRideId`, status workflow (`pending` → `approved`/`rejected`), `profileRequestStatus` (2-stage: `basic` → `profile`).

### 6. Authentication & authorization

- **Mobile**: phone + WhatsApp OTP (Meta Cloud API). `send-otp-whatsapp` provisions user/driver account if absent and stores OTP (5-min expiry) in `otp` collection; `verify-otp-whatsapp` issues a JWT (`issueAppAuthToken`, `APP_JWT_EXPIRES_IN` default 7d) and returns sanitized subject. Twilio SMS (`forgot-password`) and nodemailer email OTP exist for the legacy user password flow. `WHATSAPP_MOCK_OTP=true` returns the OTP in the response for non-production.
- **Token model**: JWT passed as `Authorization: Bearer <token>` (HTTP) and `socket.handshake.auth.token` (Socket.IO). Mobile stores it in SharedPreferences.
- **Authorization**: `requireSignIn` verifies JWT (`req.user`); `isAdmin` resolves the `_id` against the `Admin` collection and checks role in `{owner, finance_admin, admin}` (`req.admin`); `isVerified` checks `{email,phone}` and `user.isVerified`. **Points RBAC** is default-deny: `DREWEL_OWNER_ADMIN_IDS/EMAILS`, `DREWEL_FINANCE_ADMIN_IDS/EMAILS`; four middleware tiers (`requirePointsRead`, `requirePointsAdjustment`, `requirePointsPurchaseRequestManagement`, `requirePointsOwner`).
- **Session/lockout**: no refresh tokens; no server-side token revocation (only OTP invalidation on verification).

### 7. Business logic & user flows

**Mobile A — Onboarding & auth**
1. `splash` → `user_type` (choose user/driver) → `login` (phone + country code) → `otp` (WhatsApp OTP verify) → token persisted.
2. New driver continues to `driver_register` → basic info → `documents` (upload IDs/licenses via restricted multipart) → admin review (stage 1 `basic`, then 2 `profile`). App polls `getDriverStatusApi`/`getDriverDetails`; becomes "unlocked" when approved.

**Mobile B — Driver operating flow**
- `driver_home`: toggle online; `driverUpdateOnlineStatus` REST + stream `driver-location-update` over socket every few seconds with `accuracyM`, `recordedAt`. Server validates coordinates/fix-age and broadcasts to discovery rooms + admin tracking room.
- Driver receives incoming contactRide → creates priced `TripOffer` (spends points, captured in wallet transaction) → user accepts → ride `confirmed` with `agreedPrice` → driver navigates via Google Routes (`/rides/:rideId/route`), streams `ride:driver_location`.

**Mobile C — Passenger flow**
- `user_home`: joins `join-city-room` (Dubai service area only) → receives `drivers-nearby` INITIAL/UPDATE/REMOVE → marketplace cards (`marketplace_driver_card.dart`).
- Contact a driver → `POST /rides/contact` → view Offer → accept → live active ride screen (`active_ride` module) with status transitions, pickup PIN display/recovery, route + ETA, chat (`ride_message_repository`), secure Agora calls (`agora_call_service`, tokens from backend `agoraTokenService`), safety actions (report/block).

**Mobile D — Points economy**
- Driver gets `WELCOME_DRIVER_POINTS` on account creation/sign-in. Sending an offer charges `RIDE_OFFER_POINTS_COST` (configurable in PointsSettings); low-balance warning at `POINTS_LOW_BALANCE_THRESHOLD`. Buying points = `POST /driver/points/purchase-requests` (pays via `PointPack`) → admin approves/credits. Balance, transactions, packs visible in `points` module. Outbox (`PointsOutboxEvent`) delivers realtime wallet events; a job sweeps failed events.

**E — Admin operations panel**
- Login → dashboard (tiles: total users/drivers/online/restricted). Users restrict. Driver requests workflow (2-stage approve/reject/reopen with reason, document preview). Rides views (active/completed/cancelled/disputed), ride detail with audit history; admin actions require **explicit reason + idempotency key**: cancel, resolve dispute, controlled unlock, technical points refund. Points admin: overview, wallets, transactions, purchase requests, packs, settings (owner-only), audit log. Chat (global + per-user), Calls list, Driver live map (Leaflet + `driver:location` socket events), Sponsor banner management.

### 8. Real-time (Socket.IO) contracts — `src/socket/index.js`

- Auth on connect via `handshake.auth.token`; roles resolved to `authenticatedAdmin/Driver/User`; each client joins a per-user room.
- Driver location: `driver-location-update` (validated via `buildDriverLocationUpdate`, fresh-fix rules, discovery room membership) → `drivers-nearby` (UPDATE/REMOVE), `driver:location` (admin tracking room `admin-driver-tracking`), ack + `driver-location-updated`.
- Discovery: `join-city-room` / `leave-city-room`; only Dubai (`DUBAI_SERVICE_AREA`), uses `buildDubaiDiscoveryAggregation`.
- Ride rooms: `ride:join`, `ride:leave`, `ride:driver_location` (only assigned driver, validated/rate-limited by `updateActiveRideLocation`), `ride:error`.
- Chat: `new message`, `message-page`, `sidebar`, `seen`, `new global message`, `global-message-page`, `onlineUser`.
- Misc: `user-location-update`, `update-isUpdate`, `driver-map:track`, `location-tracking-ready`.
- Disconnect → driver marked offline/busy and broadcast `driver:availability`.

### 9. Frontends in detail

**Flutter app** (`lib/`) — GetX; modules under `lib/app/modules/` with `views/`, `controllers/`, `bindings/`; shared infrastructure under `lib/common/`, `lib/app/data/` (apis, api_models, repositories, constants, config). Key infra:
- `api_url_constants.dart` — base URL `https://admin-dreewel.com/api/` (overridable via `--dart-define=API_BASE_URL=/SOCKET_URL`); hardcoded `supportAdminId` default `6861224ceac0edaf19ffa056`.
- `http_methods.dart` — `MyHttp` (GET/POST/DELETE/multipart) with 20s request timeout, stale-socket retry, dynamic multipart timeouts.
- `api_interceptor_client.dart` — logging interceptor client.
- `socket_services.dart` — Socket.IO wrapper with pending-location flush, reconnect backoff, `location-tracking-ready` gating.
- `agora_call_service.dart` — Agora RTC voice/video calls.
- Localization EN + AR (GetX), `points_translations.dart`.
- Native maps keys injected per-platform (Android `local.properties`, iOS `Secrets.xcconfig`) for the Maps SDK *display* key only. Places Autocomplete/Details + Geocoding are plain HTTP calls (`ApiKeyConstants.googleMapKey` → `AppConfig.googleMapsApiKey`) that read a **compile-time dart-define** (`GOOGLE_PLACES_CLIENT_API_KEY`), separate from the native SDK key — `flutter run`/`flutter build` do not supply it automatically. For local dev, run `tool/run_flutter_dev.ps1` (reads `GOOGLE_PLACES_API_KEY`/`GOOGLE_MAPS_API_KEY` from `android/local.properties` or `$env:GOOGLE_PLACES_CLIENT_API_KEY`) or use the VS Code launch config `Drewel (dev, Places key)` (`.vscode/launch.json`, backed by the gitignored `dart_defines.local.json` — copy `dart_defines.example.json` and fill in a real key). The web build (`tool/build_flutter_web.ps1`) already passes this dart-define. Without it, every Places/Geocoding request is sent with an empty key, Google returns `REQUEST_DENIED`, and the UI shows "Location search is temporarily unavailable." The configured key must have both the Places API and the Geocoding API enabled (and billing active) in Google Cloud Console — a Maps SDK key can be reused only if it isn't restricted away from those APIs.

**Admin panel** (`drewel-admin-panel/src/`) — React 18 + Vite 6; pages under `pages/` (incl. `rides/`, `driverPoints/`); components under `components/` (incl. `driverPoints/`, `chat/`); utils `api.js`, `authUtils.js`, `ridesAdminApi.js`, `pointsAdminApi.js`, `requestsApi.js`, `callsApi.js`, `pointsPermissions.js`; context `AuthContext`, `SocketContext`, `ChatContext`. Styling: Tailwind 4 + large legacy CSS files; jQuery for treeview. Tests: Rides, points admin API, points permissions, AdjustmentModal, PointsStates, ChatContext.

### 10. Tests & validation commands

- Flutter (18 files, `test/`): widget/app bar/navigation/pop-scope, active-ride model/repository/navigation, secure-communication models+API, driver-points models/API/controller/widgets, documents view, marketplace driver card, add-driver-details model, support chat model.
- Backend (11 files, `node --test test/*.test.js`): ride lifecycle, realtime location contracts, driver points + backfill, points settings runtime, points admin audit, admin requests, dubai discovery, secure communication, file serving, backend contracts.
- Admin panel: `vitest run` (Rides, points admin api, points permissions, AdjustmentModal, PointsStates, ChatContext).
- Gates (per README): `flutter analyze`, `flutter test`; `npm test` in backend (needs disposable replica set via `MONGO_URI` + `POINTS_INTEGRATION_TEST_DB`); `npm run lint`, `npm test`, `npm run build` in panel.

### 11. Dependencies & external services

- **Google Cloud**: Routes API (server key `GOOGLE_ROUTES_API_KEY`), Maps SDK Android/iOS (separate client keys), Places (client key).
- **Meta WhatsApp Cloud API**: `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, template `login_otp_verification`.
- **Twilio** (SMS OTP, legacy), **nodemailer** (email OTP).
- **Agora** (`AGORA_APP_ID`, `AGORA_APP_CERTIFICATE`) for secure calls.
- **AWS S3** (optional `STORAGE_DRIVER=s3`, `@aws-sdk/client-s3`) or local disk file storage.
- **MongoDB Atlas / replica set**; **Render** hosting; optional Docker/nginx.
- Flutter packages: get, get_storage, socket_io_client, agora_rtc_engine, google_maps_flutter, geolocator, location, google_places_flutter, image_picker/cropper, cached_network_image, etc.

### 12. Security posture (current)

**Strengths**: JWT everywhere; CORS allowlist; RBAC for points/finance; rate limiting on auth-adjacent, ride, location, marketplace, and points endpoints; restricted MIME uploads (images + PDF only); pickup PIN encryption + lockout; geofence + location sanity checks; idempotency keys; audited ride/admin actions; privacy-preserving driver DTO (no phone/WhatsApp/OTP leakage); Maps keys server-side.

**Critical issues to fix (see roadmap prompts 1–4)**:
1. **`drewel.jks` (Android signing keystore) is committed** — purge from history, rotate, store in secret manager.
2. **`tmp/` backup archives and stale backend snapshots are committed** (`tmp/*.tar.gz`, `tmp/find-driver-prod-*`, etc.) — likely contain production source/creds.
3. **`/api/users/get-image/:fileName` is public and serves both profile images AND private driver documents** — an authenticated, ownership-checked document route is required; the migration is already flagged in `userRoutes.js`.
4. **Admin panel `dist/` is committed** (build drift + old bundle shipped to users).
5. Hardcoded admin identities/names in admin panel (`Headers.jsx`: "Riadh Slama"; `Dashboard.jsx`: "Omaid") and hardcoded `supportAdminId` in the Flutter app.
6. No CI/secret-scanning despite README claiming it.
7. Rate limit store is the default in-memory store (shared store needed for multi-instance).

### 13. Known bugs, TODOs, and code smells

- Debug `console.log("res", res)` / `console.log("data", data)` in `Dashboard.jsx` (lines ~32/44/48).
- Commented-out legacy admin pages (Clubs, Golf, Providers, Services, Orders, Revenue, CMS, Notification, FAQ, Account Settings) — dead/deployable but unreachable.
- Legacy endpoint sprawl (PUT+PATCH duplicates for admin approvals; multiple delete aliases) — intentional compatibility but tech debt.
- Flutter: legacy fallback branches in `api_methods.dart` (driver request/profile fallbacks to old endpoints) target mismatched deployments; `print(...)` remnants (mostly debug-guarded).
- Dirty working tree (uncommitted Flutter fixes: OTP layout, HTTP timeouts, documents/buy-points UI) — must be reviewed/committed or the report baseline is stale.
- README flagged: no integration-test pass = not release worth; `POINTS_INTEGRATION_TEST_DB` required.
- Dashboard tile field-name inconsistency (`restrictedUsers` vs `restrictedDrivers` fallback).
- `PUBLIC_API_URL`/`TRUST_PROXY_HOPS` must be set carefully for correct rate-limit client IP.

### 14. Deployment & infrastructure

- **Render** (`render.yaml`): `drewel-backend` Node web service (free plan, PORT 10000, `npm run start:prod`) + `drewel-admin-panel` static site from `dist/`. Env: backend `MONGO_URI`, `JWT_SECRET`, `ALLOWED_ORIGINS`, `PUBLIC_API_URL`, `TRUST_PROXY_HOPS=1`, `NODE_ENV=production`, `ALLOW_START_WITHOUT_DB=false`; panel `VITE_API_URL`, `VITE_SOCKET_URL`, `VITE_LEGACY_API_URL`.
- **Docker**: backend `node:20-alpine` (port 3001); panel multi-stage node build → nginx.
- **Production prerequisites**: long random `JWT_SECRET` & `PICKUP_PIN_ENCRYPTION_KEY`, restricted Google keys, replica-set Mongo, run `npm run backfill:active-ride-locks` before first lifecycle rollout, deploy `dist/` as one immutable release, commit nothing generated.
- **No CI/CD pipeline yet** (`.github/` empty).

### 15. Missing features & improvement backlog (roadmap input)

1. Payment gateway (real charging; today points + offline cash).
2. Push notifications (FCM/APNs) — currently in-app socket notifications only.
3. Secure, ownership-checked document serving (replaces public `get-image`).
4. Automated fare estimation (kept server-side; today price is driver-offered).
5. Ratings & reviews (navigation uses it only in UI widgets today).
6. Multi-city / geofence expansion (hard-coded Dubai).
7. Admin panel hygiene (remove hardcoded names, dead pages, debug logs; modernize jQuery).
8. CI/CD + secret scanning + dependency auditing (also purge committed secrets).
9. Reproducible integration test harness for backend (replica set).
10. Performance: shared rate-limit store; admin map clustering; index review.
11. Mobile UX hardening (RTL/accessibility already partly done; deep-linking; token refresh; socket reconnect resilience).
12. Observability: structured logging, request IDs, APM, uptime alerts.

---

## PART 2 — IMPLEMENTATION ROADMAP & STEP-BY-STEP AI PROMPTS

Rules for the agent: preserve existing behavior unless the prompt says otherwise; keep the codebase's style; run the relevant verification commands after each change; never commit unless asked; do not add `// comments` unless the codebase pattern already uses them.

> **Ordering rationale**: security & baseline first (any agent joining mid-project must start from a clean, secure repo), then core product gaps (payments, push, secure docs), then admin/mobile polish, then infra + testing + release readiness.

### PHASE 0 — Baseline & repository hygiene

---

**PROMPT 1 — Baseline verification and dirty-tree reconciliation**

**Objective:** Establish a testable baseline so every later change can be measured. Review and correctly resolve the current uncommitted Flutter changes, then run all project gates.

**Files to inspect/execute:**
- `git status`, `git diff` (`lib/app/modules/documents/**`, `lib/app/modules/otp/views/otp_view.dart`, `lib/app/modules/points/views/buy_points_view.dart`, `lib/common/http_methods.dart`).
- `flutter analyze` and `flutter test` (repo root).
- `cd drewel-backend && npm test` — if `POINTS_INTEGRATION_TEST_DB` is unset or no replica set is available, run and record exactly which integration tests are **skipped** (do not skip silently).
- `cd drewel-admin-panel && npm run lint && npm test && npm run build`.

**Expected result:** Report per-suite pass/fail/skip counts, the `flutter analyze` issue list, and the list of files whose uncommitted state must be committed before the baseline. Do not modify production code in this prompt — only diagnose and (if the user approves) commit the pending fixes with a clear message (e.g. `chore: baseline UI/timeout fixes`).

**Constraints:** Never run production integrations; use a disposable replica-set DB for `driver-points` integration tests. Do not push.

---

**PROMPT 2 — Purge committed secrets and sensitive artifacts from git history**

**Objective:** Remove ALL sensitive/generated files that are currently tracked, and prevent future leaks, without losing working config.

**Files:**
- Remove tracked: `drewel.jks` (Android signing keystore), `drewel-update.tar.gz`, everything under `tmp/` (backup archives + `tmp/find-driver-prod-*` snapshots), `drewel-admin-panel/dist/` (generated build).
- Confirm `drewel-backend/.env`, `drewel-backend/.env.local`, `drewel-ec2-key.pem`, `drewel-backend-s3_accessKeys (1).csv` are **ignored but still on disk** (they already are).
- Update `.gitignore` to cover any newly identified patterns (e.g. `*.tar.gz`, `tmp/`, ensure `**/*.jks`, `**/dist/`).
- Rewrite history (`git filter-repo` or `git filter-branch`) to expunge `drewel.jks` and `tmp/` blobs; force-push only with explicit user authorization.
- Add `drewel-backend/.env.example` sanity check (no real values).

**Expected result:** `git ls-files` contains no key material, no archives, no `dist/`. Any previously-distributed signing/API secrets (JKS password, AWS keys, WhatsApp tokens, Routes key, Mongo URL) are treated as **rotated**: instruct the user to regenerate credentials in the respective consoles (Google, AWS, Meta WhatsApp, Twilio, Agora, MongoDB, JWT signing).

**Constraints:** This prompt MUST be approved by the user before `filter-repo`/force-push since it rewrites shared history. Do not remove the working copies of `.env*` needed for local dev.

---

**PROMPT 3 — Add CI pipeline with secret scanning and dependency auditing**

**Objective:** Automate the verification gates and prevent regression/secret leaks. `.github/` is currently empty.

**Files:** create `.github/workflows/ci.yml` (or split into `mobile`, `backend`, `admin` jobs):
- **Secret scanning**: use `gitleaks` (or GitHub secret scanning) on every merge; fail on `high` confidence.
- **Backend job**: `cd drewel-backend && npm ci && npm test` — provide a service container or `mongodb-memory-server` replica-set for the points integration tests; fail if integration tests are skipped.
- **Flutter job**: `flutter test` + `flutter analyze` (Judge failures to resolve lints).
- **Admin job**: `npm ci && npm run lint && npm test && npm run build`.
- **Dependency auditing**: `npm audit --omit=dev` (backend/admin), `flutter pub outdated` dry-run.

**Expected result:** A single CI that mimics `README.md`'s "Verification" section, plus optional packages workflow. Document commands in `README.md`.

**Constraint:** Never commit secrets or service containers with production environment variables; inject them only from GitHub secrets.

---

### PHASE 1 — Security hardening (product-impacting)

---

**PROMPT 4 — Secure private–document serving (replace public `get-image`)**

**Objective:** Stop serving private driver documents through the unauthenticated `/api/users/get-image/:fileName`. Keep public profile images public and backward-compatible for a transition period.

**Files/areas:**
- `drewel-backend/src/routes/userRoutes.js` (current public `get-image`), `drewel-backend/src/controllers/userController.js::getProfileImage`, `drewel-backend/src/utils/fileServing.js`, `drewel-backend/src/utils/publicAssets.js`.
- Policy reference: the code comment in `userRoutes.js` already flags this migration.

**Spec:**
- Add `GET /api/users/get-document/:fileName` behind `requireSignIn` that checks the authenticated subject (User or Driver) **owns** the stored document URL mapping before streaming the file; return `404` on mismatch, never leak existence.
- Keep `GET /get-image/:fileName` for profile/avatar images (public by design) but ensure it **does not** resolve private document keys; if these share storage, move documents to a private subdirectory (e.g. `public/user-documents/`) and update all document URLs at write-time.
- Enforce an allowlist of extensions (jpg/jpeg/png/webp/pdf) and reject path traversal (`../`, encoded variants).
- Update Flutter `api_methods.dart`/models that render driver documents to call the new authenticated endpoint with the Authorization header.

**Expected result:** Anonymous requests can no longer fetch licenses/IDs; legitimate owner (or admin) fetches still work; existing profile images keep working. Add backend regression tests: anonymous 401/404, owner 200, non-owner 404, traversal 400.

**Constraint:** Don't break the admin panel's document preview (it must use the same ownership/ admin logic) — keep admin panel on your new endpoint too, and update `src/utils/requestsApi.js`/docs components accordingly.

---

**PROMPT 5 — Hardcode-removal & access-control audit in the admin panel**

**Objective:** Remove hardcoded identities and debug output; make role/name data dynamic and governance-safe.

**Files:** `drewel-admin-panel/src/components/Headers.jsx` (hardcoded `Riadh Slama`), `pages/Dashboard.jsx` (hardcoded `Omaid`, `console.log` at lines ~32/44/48, `restrictedUsers ?? restrictedDrivers` fallback), `components/ProtectedRoute.jsx`, `context/AuthContext.jsx`.

**Spec:**
- Read the authenticated admin's `fullName`, `email`, and `role` from `localStorage.admin`/`AuthContext` and render those in the header and dashboard welcome; fall back to "Admin" when absent.
- Remove debug `console.log` calls (or gate behind `import.meta.env.DEV`).
- Normalize the dashboard tile field so the panel reads the same field the backend emits (`restrictedUsers`); update the backend response only if the panel is the sole consumer (check `userController.js::dashBoardData`).
- Audit every page's API call against the backend RBAC; ensure routes admins can't use are hidden (existing `pointsAccess` pattern in `getPointsAccess()`/`RequirePointsAccess.jsx` is the model to follow).

**Expected result:** No hardcoded admin names; no debug logs; panel matches backend permission model; existing tests still pass.

**Constraint:** Keep the legacy `PUT /api/admin/driver/:id/status` flow working unless this prompt is explicitly extended to remove it.

---

**PROMPT 6 — Deploy-time secret & config guardrails**

**Objective:** Make misconfiguration loud instead of silent.

**Files:** `drewel-backend/src/utils/loadEnv.js`, `drewel-backend/index.js`, `.env.example`.

**Spec:**
- Fail startup when `NODE_ENV=production` and: `JWT_SECRET` is missing/short/placeholder; `PICKUP_PIN_ENCRYPTION_KEY` is missing/placeholder; `ALLOWED_ORIGINS` empty; `GOOGLE_ROUTES_API_KEY` empty (if ride navigation enabled).
- Reject placeholder values (`replace-with-…`, `changeme`, `your-`).
- Warn (not fail) when `WHATSAPP_MOCK_OTP=true` in production.
- Validate `TRUST_PROXY_HOPS` is an integer and reasonable, and set proxy trust accordingly (already partially in `index.js`).

**Expected result:** A production start with placeholder secrets exits immediately with a clear message. Add a unit test for each production guard.

**Constraint:** Development environments remain permissive (`NODE_ENV != production`).

---

### PHASE 2 — Core product gaps

---

**PROMPT 7 — Real payment gateway for point-pack purchases**

**Objective:** Let drivers pay for point packs online (current flow is a manual admin-approved purchase request). Integrate a checkout that is PCI-compliant and keeps the backend the system of record.

**Recommended provider:** Start with **Stripe Payment Intents** (or PayFort/Checkout.com if UAE-local requirement because card currency is AED).

**Files/areas:**
- Backend: new `drewel-backend/src/controllers/paymentController.js`, `src/routes/paymentRoutes.js` mounted in `index.js` (`/api/payments`), models: add `Payment` (or extend `PointPurchaseRequest` with payment fields), `drewel-backend/.env.example` (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PAYMENT_SUCCESS_URL`, `PAYMENT_CANCEL_URL`, `PAYMENT_CURRENCY=AED`).
- `PointPurchaseRequest` model: add `paymentStatus` (`pending/payment_pending/paid/failed/refunded`), `paymentIntentId`, `paidAmount`.
- Reuse `pointsWalletService` credit path verbatim so wallet math stays consistent; **never** credit wallet before `payment_intent.succeeded` webhook verifies.
- Mobile: extend `buy_points_view.dart`/`points` module to open a payment sheet after choosing a pack, then listen for success via the existing outbox/notification and refresh wallet.
- Admin panel: `PurchaseRequests.jsx` — show payment status + Stripe links; admin credits remain as manual override.

**Expected result:** A driver can purchase points, pay online, and see the wallet credit arrive **only after** webhook confirmation; admin flows unchanged; `driver-points-api/controller/backfill` tests still pass.

**Constraint:** Store only Stripe PaymentIntent IDs (never PANs). Idempotency: a single `clientReference` per payment; ignore duplicate webhooks; reconcile on `POINTS_JOB_INTERVAL_MS`.

---

**PROMPT 8 — Push notifications (FCM for Android, APNs for iOS)**

**Objective:** Deliver ride lifecycle events to a backgrounded app; the in-app socket channel stays primary.

**Files/areas:**
- Backend: add `firebase-admin`; new `src/services/pushNotificationService.js` and a `deviceToken`/`DeviceToken` model tied to `User`/`Driver`; emit push on canonical ride events (`driver_on_the_way`, `driver_arrived`, `pickup_confirmed`, `in_progress`, `completed`, cancellations, offer received/accepted/declined, wallet credit).
- Mobile: `firebase_messaging` plugin, background handler, `notification` module (`lib/app/modules/notification/**`) to process/display foreground notifications and persist server `Notification` records (backend `notificationRoutes` already exists).
- Add `--dart-define` for the FCM sender; keep notification payload minimal (no PII).
- Fallback for Expo-style? No — keep native-only.

**Expected result:** Ride/offer/wallet events produce a system notification on the device when app is backgrounded; no double-trigger when app is foreground (dedupe via server event `_id`).

**Constraint:** Do not break the existing socket-driven real-time UX; push is additive. Keep token storage server-side encrypted at rest or minimal-scope tokens.

---

**PROMPT 9 — Driver ratings & reviews (end-to-end)**

**Objective:** Allow passengers/drivers to rate a completed ride and store it server-side; show aggregate rating on driver marketplace cards.

**Files/areas:**
- Backend: new `Rating` model (`rideId`, `ratedBy`, `ratedUserId`, `value 1–5`, `comment`); `POST /api/rides/:rideId/rating` (only participants, only `completed` status, once per ride per direction); `GET /api/drivers/:id/ratings` aggregate; expose `averageRating`/`ratingCount` in `AVAILABLE_DRIVER_FIELDS` + `toAvailableDriverDto`.
- Mobile: post-completion rating UI (pubspec already includes `custom_rating_bar`); render average on `marketplace_driver_card.dart`.
- Admin: read-only ratings view in `RideDetail.jsx`.

**Expected result:** A ride can be rated exactly once by each participant; the marketplace card shows aggregate rating; no fraud vector (participant check, completed-only).

**Constraint:** Must not affect ride lifecycle transitions or points capture; keep fields additive.

---

### PHASE 3 — Product & UX hardening

---

**PROMPT 10 — Fare estimation is optional; decide NetX contract carefully**

*(Advisory, not mandatory.)* The current model is driver-offered pricing. If the business wants passenger-side pre-pricing, design a **server-side fare estimator** (`/api/fares/estimate`) using Google Routes distance/duration × vehicle-type rates and a distance-matrix cache. Implement only after PM sign-off, and treat the estimator output as advisory — drivers keep final offer authority.

**Files:** new `fareService.js`, `fareRoutes.js`, rates config via `PointsSettings`-style singleton or env. Add unit tests for parity with at least 5 known route fixtures.

---

**PROMPT 11 — Multi-city / service-area expansion**

**Objective:** Generalize the hard-coded Dubai discovery without breaking the current Dubai market.

**Files:** `src/utils/dubaiLocation.js`, `src/utils/availableDrivers.js` (`DUBAI_SERVICE_AREA`, build* aggregations), `src/socket/index.js` (rooms), `GET /api/driver/available`, admin `DriverMap.jsx`.

**Spec:**
- Introduce a `ServiceArea` collection (geofence polygons + vehicle type + settings) with a default Dubai seed; replace constant references with a lookup backed by a small in-memory cache refreshed on change.
- Keep room naming compatible (`discoveryRoom(serviceAreaId, vehicleType)`); room names must remain stable across deployments.
- Backfill drivers' `currentServiceArea` from their last recorded position.
- Add a lightweight DB migration + tests (existing `dubai-discovery.test.js` must keep passing for the default seeded area).

**Expected result:** Adding a new polygon in admin enables that city with no code change; Dubai behaves exactly as before.

**Constraint:** Rate limiting and location freshness rules stay identical for all areas.

---

**PROMPT 12 — Admin panel modernization pass**

**Objective:** Reduce duplicated legacy code and debug cruft; improve build quality.

**Files:** `Headers.jsx`, `Dashboard.jsx`, `App.jsx`, dead pages under `pages/` (Club, GolfCourses, Providers, ServiceRequests, Orders, Revenue, CmsManagement, Faq, AccountSettings, Services, PushNotification), `src/App.css`/`style.css`/`mystyle.css` merge.

**Spec:**
- Remove routes to dead pages, their imports, and associated unused components (only after confirming nothing is linked from active pages).
- Consolidate the many CSS files into scoped Tailwind utilities, keeping class names that jQuery selectors depend on (verify with tests).
- Extract shared UI (page shell, tables, status chips, pagination) — reuse the existing `driverPoints/` components as the reference implementation.
- Keep `dist/` untracked (add `drewel-admin-panel/dist/` to `.gitignore` if not already respected).

**Expected result:** Smaller bundle, no unreachable routes, all `npm test` + `lint` + `build` pass, and the built app behaves identically on the live origin.

**Constraint:** Do not change any backend contracts; panel is never the source of truth.

---

**PROMPT 13 — Mobile UX hardening**

**Objective:** Polish the Flutter app and eliminate fragile fallbacks.

**Files:** `lib/common/http_methods.dart`, `lib/app/data/apis/api_methods/api_methods.dart`, `lib/app/data/apis/api_constants/api_url_constants.dart` (supportAdminId), modules `active_ride/`, `communication/`, `points/`, `otp/`.

**Spec:**
- Remove hardcoded `supportAdminId` default; fetch the support channel from the server (`getSupportAdmin` config or `/api/rides/.../ support` contract) or make it a `--dart-define`.
- Add automatic JWT refresh when the server returns 401 (new `refresh` token only if server released it; otherwise re-auth through OTP). Keep all retry idempotency behavior.
- Replace fragile "fallback to legacy endpoint" branches in `ApiMethods` with a single negotiated contract (server always on `driver/request` + `complete-profile`), per the planned deployment baseline (see Prompt 16).
- Add a reconnect-resilient queue for `ride:driver_location` emits (already partially handled) and suppress duplicate `drivers-nearby` renders.
- Audit `print()` calls; gate any remaining ones behind `kDebugMode` (already done for most).

**Expected result:** No hardcoded support identity; graceful 401 handshake; deterministic upload/registration paths; existing Flutter tests remain green (add tests for the new auth-refresh and the removal of fallbacks).

**Constraint:** Keep both EN/AR locales working; preserve accessibility (48pt targets, semantics) already covered by current tests.

---

### PHASE 4 — Reliability, observability, and scale

---

**PROMPT 14 — Shared rate-limit store and horizontal-scaling readiness**

**Objective:** Make rate limiting correct when multiple backend instances run.

**Files:** `drewel-backend/src/middlewares/pointsRateLimit.js`, `marketplaceRateLimit.js`, `index.js` (config), `render.yaml`/Dockerfile env.

**Spec:**
- Add `RATE_LIMIT_STORE=memory|redis` (default `memory`). When `redis`, use `rate-limit-redis` + the existing Redis-URL env (`REDIS_URL`) and set `trust proxy` from `TRUST_PROXY_HOPS`.
- Keep in-memory store on single-instance free tier unchanged.
- Ensure rate-limit keys are `(route, ip, subject)` and stable under proxies.

**Expected result:** No behavioral change on the current single-instance deployment; documented how to switch when scaling. Add tests for redis-store configuration correctness (mock store).

**Constraint:** Do not add Redis as a hard dependency.

---

**PROMPT 15 — Structured logging, request IDs, and uptime/alert endpoint**

**Objective:** Make production debuggable and observable.

**Files:** `index.js`, `src/utils/loadEnv.js`, new `src/utils/logger.js`, `scripts/`, `render.yaml` (healthcheck).

**Spec:**
- Add a request-ID middleware (UUID) that threads into error responses and logs; log in JSON lines to stdout (Render-friendly) with `level`, `reqId`, `route`, `status`, `durationMs`, `userId` (never tokens/PII).
- Stamp `req.requestId` through global error handler.
- Expose `/api/health` with DB + socket uptime + per-job lag; configure Render health check path.
- Add `scripts/` audit command to summarize failed `PointsOutboxEvent`s and pending dispute resolutions (reuse `pointsAdminAuditService`).

**Expected result:** Requests are traceable end-to-end; operational dashboards consume structured logs; health endpoint reflects real readiness.

**Constraint:** Keep logs free of body payloads and secrets.

---

**PROMPT 16 — Release pipeline & environment promotion (pre-production → production)**

**Objective:** Make deployment reproducible and prevent "unknown environment drift" (the panel currently defaults to `admin-dreewel.com`).

**Files:** `render.yaml`, Dockerfiles, `drewel-admin-panel/.env*.example`, `drewel-backend/.env.example`, `README.md`.

**Spec:**
- Formalize three environments: `dev` (localhost), `staging` (Render preview/static branch), `prod` (`admin-dreewel.com`). Encode URLs as env/build-time vars; Flutter already supports `--dart-define=API_BASE_URL/SOCKET_URL`.
- Update the panel defaults so a fresh build points to the env it was built for; never ship a fat bundle with hardcoded prod URLs to a different environment.
- Backend: enforce `ALLOW_START_WITHOUT_DB=false` prod rule already present; document DB backup restore + `backfill:active-ride-locks` run book for releases.
- Add a `RELEASE_CHECKLIST.md` (or README section): apply migrations → backfill → smoke auth → smoke discovery → smoke ride lifecycle → smoke points → watch outbox → enable.

**Expected result:** Any engineer can promote dev→staging→prod with documented steps; each env is isolated by allowlist + env vars.

**Constraint:** Do not merge environment-specific settings into code; keep them in env/config.

---

### PHASE 5 — Final verification, optimization, and handover

---

**PROMPT 17 — Full regression pass with integration database**

**Objective:** Prove release-readiness per README ("a run with skipped integration tests is not a release pass").

**Files:** all test suites; `Reports:` regenerate the July-2026 report artifacts.

**Spec:**
- Provision a disposable MongoDB replica set (or `mongodb-memory-server` with RS support). Set `MONGO_URI` + `POINTS_INTEGRATION_TEST_DB`.
- Run: backend `npm test` (expect 0 skips), Flutter `flutter analyze` (0 new issues) + `flutter test`, panel lint/test/build.
- Fix every failure; do not lower thresholds.
- Update the stakeholder report (`reports/drewel-july-2026/...`) with the final passed/skipped chart, or add an August-2026 report.

**Expected result:** All gates green with **no skipped integration tests**, documented in a single `reports/REPORT_NOTES.md` update.

---

**PROMPT 18 — Performance & index review**

**Objective:** Ensure the backend stays fast at scale.

**Files:** all Mongoose schemas (`src/models/*.js`), `scripts/audit-image-assets.js`, `scripts/backfill-driver-points.js`.

**Spec:**
- Review every query path (ride lookup by participant+status, discovery aggregation, wallet/transaction listing, admin list endpoints) against current indexes; add compound indexes only where the query planner proves a need; drop unused indexes.
- Paginate the large admin lists (rides, transactions, wallets, users, drivers) — add `limit`/`cursor` support where missing (existing admin routes already pass `limit` for discovery).
- Optimize the Dubai discovery aggregation with a 2dsphere index on `Driver.currentLocation`.
- Re-run `scripts/audit-image-assets.js` to identify orphaned files; add orphan cleanup to the job.

**Expected result:** Query plans verified with `explain`; no full-collection scans on the hot paths; tests green.

---

**PROMPT 19 — Security re-audit & penetration checklist**

**Objective:** Final security confirmation before release.

**Files:** whole repo; produce `SECURITY.md`.

**Spec (manual/automated):**
- Re-run gitleaks (Prompt 3) on the final tree.
- `npm audit` both Node apps; upgrade vulnerable production deps (careful with Express 5 / Mongoose minors).
- Confirm: no public endpoint serves private docs; OTP rate limiting + expiry; pickup PIN fields `select:false`; admin endpoints all behind `isAdmin`; CORS allowlist correct per env; JWT secret length ≥32 chars; `PICKUP_PIN_ENCRYPTION_KEY` rotated if ever exposed.
- Verify all test-only DB connections never point at production.

**Expected result:** `SECURITY.md` documents ownership, asset inventory, secret rotation, and the incident response steps; no known critical CVE in production deps.

---

**PROMPT 20 — Final documentation & handover**

**Objective:** Make the repo self-explanatory for the next agent/team.

**Files:** `README.md` (update), `drewel-backend/.env.example` docs, `RELEASE_CHECKLIST.md`.

**Spec:**
- Refresh README quick-start, env tables, verification commands, deployment topology (accumulate all env vars introduced by prompts 1–19: Redis, Stripe, FCM, payments webhook, push, new rate-limit store).
- Add an "Architecture" section pointing to this file (`AI_IMPLEMENTATION_GUIDE.md`) as the living spec.
- Document all new endpoints added across prompts (payments, ratings, secure docs) in an `API.md` or the existing route comments.

**Expected result:** A fresh agent can bootstrap dev, run tests, deploy staging/prod, and understand the domain from the docs alone.

---

## Appendix — Cross-cutting constraints for every prompt

1. **Preserve contracts**: Do not rename endpoints/models used by the shipped mobile or panel builds; additive changes only unless the prompt says a migration is acceptable.
2. **Backwards compatibility**: The mobile app has deliberate legacy fallbacks for old deployments; when you remove one, do it in the same release as the baseline contract (Prompt 16).
3. **State machine safety**: Any change touching ride transitions must keep idempotency keys, `stateVersion` conflicts, transactions, and the unique active-ride indexes intact.
4. **Money hygiene**: Wallet credit/debit must go through `pointsWalletService`; never inline ledger writes.
5. **Secrets**: Never echo `.env` contents, tokens, or keys; keep them in ignored files and CI secrets.
6. **Verification after every prompt**: run the suite(s) that cover the touched surface; report exact counts.
7. **Style**: Match existing patterns (ESM, GetX, React Router, Tailwind + existing CSS, jQuery where already used). Minimal, purposeful comments only where code is non-obvious.