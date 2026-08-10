# DREWEL — COMPLETE CODEX EXECUTION PROMPT PACK

This pack is intended to finish and harden Drewel with Codex.

## HOW TO USE THIS FILE

Do **not** ask Codex to execute all 20 tasks in one autonomous run.

Use this sequence:
1. Give Codex the MASTER PROMPT once.
2. Give TASK 1.
3. Review its completion report.
4. If verification is green, give TASK 2.
5. Continue sequentially through TASK 20.
6. Run the FINAL PROJECT ACCEPTANCE GATE.

Do not skip mandatory failing gates.

---

# MASTER PROMPT — CODEX OPERATING CONTRACT

You are the senior engineer responsible for finishing Drewel as a production-grade ride-hailing platform.

You are working inside the actual Drewel repository. Inspect the repository and existing code before making assumptions.

## Architecture

There are three main deliverables:

- Flutter mobile application at repository root (`lib/`)
- Node.js + Express + MongoDB + Socket.IO backend (`drewel-backend/`)
- React + Vite operations/admin panel (`drewel-admin-panel/`)

The backend is the system of record.

## Non-negotiable domain invariants

1. Preserve the canonical ride state machine.
2. Preserve idempotency keys.
3. Preserve `stateVersion` optimistic concurrency.
4. Preserve MongoDB transactions and active-ride unique indexes.
5. All point credits/debits must go through `pointsWalletService`.
6. Never inline wallet ledger writes.
7. Never expose private driver documents publicly.
8. Never leak `.env` values, credentials, OTPs, JWTs, signing keys, Mongo URIs, API keys, or access tokens.
9. Do not rename or remove contracts consumed by released mobile/admin builds unless the current task explicitly authorizes a migration.
10. Prefer additive, backward-compatible changes.
11. Keep English and Arabic mobile localization working.
12. Keep the existing socket-driven UX working when adding push notifications.
13. Do not weaken tests or security checks simply to obtain a green build.

## Before changing code

For every task:

- run `git status`;
- inspect the files named by the task;
- inspect their callers/consumers;
- inspect existing tests;
- identify API/mobile/admin compatibility risks;
- identify migrations or rollout risks;
- implement the smallest coherent solution.

## After changing code

Run the relevant focused tests, then the required project gates.

When applicable:

### Flutter
- `flutter analyze`
- `flutter test`

### Backend
- `cd drewel-backend`
- `npm test`

Integration tests must use a disposable MongoDB replica set. Never point tests at production.

### Admin
- `cd drewel-admin-panel`
- `npm run lint`
- `npm test`
- `npm run build`

Never hide skipped integration tests.

## Git / production safety

Do not:

- push;
- force-push;
- rewrite shared history;
- rotate live credentials;
- change production DNS;
- destroy databases;
- run destructive production migrations;

unless I explicitly authorize that exact action.

## Mandatory report after every task

Return exactly these sections:

### Completed
What you implemented.

### Files changed
Every created, modified, deleted or moved file.

### Verification
For every command:
- command
- PASS / FAIL / SKIPPED
- test counts when available

### Security and compatibility
- security impact
- backend API impact
- Flutter impact
- admin impact
- migration/rollout requirements

### Remaining issues
Anything unresolved.

### Next task readiness
`READY` or `NOT READY`, with reason.

Then STOP. Do not execute the next task automatically.

---



# TASK 1

****PROMPT 1 — Baseline verification and dirty-tree reconciliation****

****Objective:**** Establish a testable baseline so every later change can be measured. Review and correctly resolve the current uncommitted Flutter changes, then run all project gates.

****Files to inspect/execute:****
- `git status`, `git diff` (`lib/app/modules/documents/**`, `lib/app/modules/otp/views/otp\_view.dart`, `lib/app/modules/points/views/buy\_points\_view.dart`, `lib/common/http\_methods.dart`).
- `flutter analyze` and `flutter test` (repo root).
- `cd drewel-backend && npm test` — if `POINTS\_INTEGRATION\_TEST\_DB` is unset or no replica set is available, run and record exactly which integration tests are ****skipped**** (do not skip silently).
- `cd drewel-admin-panel && npm run lint && npm test && npm run build`.

****Expected result:**** Report per-suite pass/fail/skip counts, the `flutter analyze` issue list, and the list of files whose uncommitted state must be committed before the baseline. Do not modify production code in this prompt — only diagnose and (if the user approves) commit the pending fixes with a clear message (e.g. `chore: baseline UI/timeout fixes`).

****Constraints:**** Never run production integrations; use a disposable replica-set DB for `driver-points` integration tests. Do not push.

**---**

## CODEX EXECUTION RULE
Execute this task only. Inspect the real codebase instead of assuming the file contents. Run all verification gates relevant to the changed surfaces. Return the mandatory report from the MASTER PROMPT and stop.

---


# TASK 2

****PROMPT 2 — Purge committed secrets and sensitive artifacts from git history****

****Objective:**** Remove ALL sensitive/generated files that are currently tracked, and prevent future leaks, without losing working config.

****Files:****
- Remove tracked: `drewel.jks` (Android signing keystore), `drewel-update.tar.gz`, everything under `tmp/` (backup archives + `tmp/find-driver-prod-*` snapshots), `drewel-admin-panel/dist/` (generated build).
- Confirm `drewel-backend/.env`, `drewel-backend/.env.local`, `drewel-ec2-key.pem`, `drewel-backend-s3\_accessKeys (1).csv` are ****ignored but still on disk**** (they already are).
- Update `.gitignore` to cover any newly identified patterns (e.g. `*.tar.gz`, `tmp/`, ensure `**/*.jks`, `**/dist/`).
- Rewrite history (`git filter-repo` or `git filter-branch`) to expunge `drewel.jks` and `tmp/` blobs; force-push only with explicit user authorization.
- Add `drewel-backend/.env.example` sanity check (no real values).

****Expected result:**** `git ls-files` contains no key material, no archives, no `dist/`. Any previously-distributed signing/API secrets (JKS password, AWS keys, WhatsApp tokens, Routes key, Mongo URL) are treated as ****rotated****: instruct the user to regenerate credentials in the respective consoles (Google, AWS, Meta WhatsApp, Twilio, Agora, MongoDB, JWT signing).

****Constraints:**** This prompt MUST be approved by the user before `filter-repo`/force-push since it rewrites shared history. Do not remove the working copies of `.env*` needed for local dev.

**---**

## CODEX EXECUTION RULE
Execute this task only. Inspect the real codebase instead of assuming the file contents. Run all verification gates relevant to the changed surfaces. Return the mandatory report from the MASTER PROMPT and stop.

---


# TASK 3

****PROMPT 3 — Add CI pipeline with secret scanning and dependency auditing****

****Objective:**** Automate the verification gates and prevent regression/secret leaks. `.github/` is currently empty.

****Files:**** create `.github/workflows/ci.yml` (or split into `mobile`, `backend`, `admin` jobs):
- ****Secret scanning****: use `gitleaks` (or GitHub secret scanning) on every merge; fail on `high` confidence.
- ****Backend job****: `cd drewel-backend && npm ci && npm test` — provide a service container or `mongodb-memory-server` replica-set for the points integration tests; fail if integration tests are skipped.
- ****Flutter job****: `flutter test` + `flutter analyze` (Judge failures to resolve lints).
- ****Admin job****: `npm ci && npm run lint && npm test && npm run build`.
- ****Dependency auditing****: `npm audit --omit=dev` (backend/admin), `flutter pub outdated` dry-run.

****Expected result:**** A single CI that mimics `README.md`'s "Verification" section, plus optional packages workflow. Document commands in `README.md`.

****Constraint:**** Never commit secrets or service containers with production environment variables; inject them only from GitHub secrets.

**---**

**### PHASE 1 — Security hardening (product-impacting)**

**---**

## CODEX EXECUTION RULE
Execute this task only. Inspect the real codebase instead of assuming the file contents. Run all verification gates relevant to the changed surfaces. Return the mandatory report from the MASTER PROMPT and stop.

---


# TASK 4

****PROMPT 4 — Secure private–document serving (replace public `get-image`)****

****Objective:**** Stop serving private driver documents through the unauthenticated `/api/users/get-image/:fileName`. Keep public profile images public and backward-compatible for a transition period.

****Files/areas:****
- `drewel-backend/src/routes/userRoutes.js` (current public `get-image`), `drewel-backend/src/controllers/userController.js::getProfileImage`, `drewel-backend/src/utils/fileServing.js`, `drewel-backend/src/utils/publicAssets.js`.
- Policy reference: the code comment in `userRoutes.js` already flags this migration.

****Spec:****
- Add `GET /api/users/get-document/:fileName` behind `requireSignIn` that checks the authenticated subject (User or Driver) ****owns**** the stored document URL mapping before streaming the file; return `404` on mismatch, never leak existence.
- Keep `GET /get-image/:fileName` for profile/avatar images (public by design) but ensure it ****does not**** resolve private document keys; if these share storage, move documents to a private subdirectory (e.g. `public/user-documents/`) and update all document URLs at write-time.
- Enforce an allowlist of extensions (jpg/jpeg/png/webp/pdf) and reject path traversal (`../`, encoded variants).
- Update Flutter `api\_methods.dart`/models that render driver documents to call the new authenticated endpoint with the Authorization header.

****Expected result:**** Anonymous requests can no longer fetch licenses/IDs; legitimate owner (or admin) fetches still work; existing profile images keep working. Add backend regression tests: anonymous 401/404, owner 200, non-owner 404, traversal 400.

****Constraint:**** Don't break the admin panel's document preview (it must use the same ownership/ admin logic) — keep admin panel on your new endpoint too, and update `src/utils/requestsApi.js`/docs components accordingly.

**---**

## CODEX EXECUTION RULE
Execute this task only. Inspect the real codebase instead of assuming the file contents. Run all verification gates relevant to the changed surfaces. Return the mandatory report from the MASTER PROMPT and stop.

---


# TASK 5

****PROMPT 5 — Hardcode-removal & access-control audit in the admin panel****

****Objective:**** Remove hardcoded identities and debug output; make role/name data dynamic and governance-safe.

****Files:**** `drewel-admin-panel/src/components/Headers.jsx` (hardcoded `Riadh Slama`), `pages/Dashboard.jsx` (hardcoded `Omaid`, `console.log` at lines \~32/44/48, `restrictedUsers ?? restrictedDrivers` fallback), `components/ProtectedRoute.jsx`, `context/AuthContext.jsx`.

****Spec:****
- Read the authenticated admin's `fullName`, `email`, and `role` from `localStorage.admin`/`AuthContext` and render those in the header and dashboard welcome; fall back to "Admin" when absent.
- Remove debug `console.log` calls (or gate behind `import.meta.env.DEV`).
- Normalize the dashboard tile field so the panel reads the same field the backend emits (`restrictedUsers`); update the backend response only if the panel is the sole consumer (check `userController.js::dashBoardData`).
- Audit every page's API call against the backend RBAC; ensure routes admins can't use are hidden (existing `pointsAccess` pattern in `getPointsAccess()`/`RequirePointsAccess.jsx` is the model to follow).

****Expected result:**** No hardcoded admin names; no debug logs; panel matches backend permission model; existing tests still pass.

****Constraint:**** Keep the legacy `PUT /api/admin/driver/:id/status` flow working unless this prompt is explicitly extended to remove it.

**---**

## CODEX EXECUTION RULE
Execute this task only. Inspect the real codebase instead of assuming the file contents. Run all verification gates relevant to the changed surfaces. Return the mandatory report from the MASTER PROMPT and stop.

---


# TASK 6

****PROMPT 6 — Deploy-time secret & config guardrails****

****Objective:**** Make misconfiguration loud instead of silent.

****Files:**** `drewel-backend/src/utils/loadEnv.js`, `drewel-backend/index.js`, `.env.example`.

****Spec:****
- Fail startup when `NODE\_ENV=production` and: `JWT\_SECRET` is missing/short/placeholder; `PICKUP\_PIN\_ENCRYPTION\_KEY` is missing/placeholder; `ALLOWED\_ORIGINS` empty; `GOOGLE\_ROUTES\_API\_KEY` empty (if ride navigation enabled).
- Reject placeholder values (`replace-with-…`, `changeme`, `your-`).
- Warn (not fail) when `WHATSAPP\_MOCK\_OTP=true` in production.
- Validate `TRUST\_PROXY\_HOPS` is an integer and reasonable, and set proxy trust accordingly (already partially in `index.js`).

****Expected result:**** A production start with placeholder secrets exits immediately with a clear message. Add a unit test for each production guard.

****Constraint:**** Development environments remain permissive (`NODE\_ENV != production`).

**---**

**### PHASE 2 — Core product gaps**

**---**

## CODEX EXECUTION RULE
Execute this task only. Inspect the real codebase instead of assuming the file contents. Run all verification gates relevant to the changed surfaces. Return the mandatory report from the MASTER PROMPT and stop.

---


# TASK 7

****PROMPT 7 — Real payment gateway for point-pack purchases****

****Objective:**** Let drivers pay for point packs online (current flow is a manual admin-approved purchase request). Integrate a checkout that is PCI-compliant and keeps the backend the system of record.

****Recommended provider:**** Start with ****Stripe Payment Intents**** (or PayFort/Checkout.com if UAE-local requirement because card currency is AED).

****Files/areas:****
- Backend: new `drewel-backend/src/controllers/paymentController.js`, `src/routes/paymentRoutes.js` mounted in `index.js` (`/api/payments`), models: add `Payment` (or extend `PointPurchaseRequest` with payment fields), `drewel-backend/.env.example` (`STRIPE\_SECRET\_KEY`, `STRIPE\_WEBHOOK\_SECRET`, `PAYMENT\_SUCCESS\_URL`, `PAYMENT\_CANCEL\_URL`, `PAYMENT\_CURRENCY=AED`).
- `PointPurchaseRequest` model: add `paymentStatus` (`pending/payment\_pending/paid/failed/refunded`), `paymentIntentId`, `paidAmount`.
- Reuse `pointsWalletService` credit path verbatim so wallet math stays consistent; ****never**** credit wallet before `payment\_intent.succeeded` webhook verifies.
- Mobile: extend `buy\_points\_view.dart`/`points` module to open a payment sheet after choosing a pack, then listen for success via the existing outbox/notification and refresh wallet.
- Admin panel: `PurchaseRequests.jsx` — show payment status + Stripe links; admin credits remain as manual override.

****Expected result:**** A driver can purchase points, pay online, and see the wallet credit arrive ****only after**** webhook confirmation; admin flows unchanged; `driver-points-api/controller/backfill` tests still pass.

****Constraint:**** Store only Stripe PaymentIntent IDs (never PANs). Idempotency: a single `clientReference` per payment; ignore duplicate webhooks; reconcile on `POINTS\_JOB\_INTERVAL\_MS`.

**---**

## CODEX EXECUTION RULE
Execute this task only. Inspect the real codebase instead of assuming the file contents. Run all verification gates relevant to the changed surfaces. Return the mandatory report from the MASTER PROMPT and stop.

---


# TASK 8

****PROMPT 8 — Push notifications (FCM for Android, APNs for iOS)****

****Objective:**** Deliver ride lifecycle events to a backgrounded app; the in-app socket channel stays primary.

****Files/areas:****
- Backend: add `firebase-admin`; new `src/services/pushNotificationService.js` and a `deviceToken`/`DeviceToken` model tied to `User`/`Driver`; emit push on canonical ride events (`driver\_on\_the\_way`, `driver\_arrived`, `pickup\_confirmed`, `in\_progress`, `completed`, cancellations, offer received/accepted/declined, wallet credit).
- Mobile: `firebase\_messaging` plugin, background handler, `notification` module (`lib/app/modules/notification/**`) to process/display foreground notifications and persist server `Notification` records (backend `notificationRoutes` already exists).
- Add `--dart-define` for the FCM sender; keep notification payload minimal (no PII).
- Fallback for Expo-style? No — keep native-only.

****Expected result:**** Ride/offer/wallet events produce a system notification on the device when app is backgrounded; no double-trigger when app is foreground (dedupe via server event `\_id`).

****Constraint:**** Do not break the existing socket-driven real-time UX; push is additive. Keep token storage server-side encrypted at rest or minimal-scope tokens.

**---**

## CODEX EXECUTION RULE
Execute this task only. Inspect the real codebase instead of assuming the file contents. Run all verification gates relevant to the changed surfaces. Return the mandatory report from the MASTER PROMPT and stop.

---


# TASK 9

****PROMPT 9 — Driver ratings & reviews (end-to-end)****

****Objective:**** Allow passengers/drivers to rate a completed ride and store it server-side; show aggregate rating on driver marketplace cards.

****Files/areas:****
- Backend: new `Rating` model (`rideId`, `ratedBy`, `ratedUserId`, `value 1–5`, `comment`); `POST /api/rides/:rideId/rating` (only participants, only `completed` status, once per ride per direction); `GET /api/drivers/:id/ratings` aggregate; expose `averageRating`/`ratingCount` in `AVAILABLE\_DRIVER\_FIELDS` + `toAvailableDriverDto`.
- Mobile: post-completion rating UI (pubspec already includes `custom\_rating\_bar`); render average on `marketplace\_driver\_card.dart`.
- Admin: read-only ratings view in `RideDetail.jsx`.

****Expected result:**** A ride can be rated exactly once by each participant; the marketplace card shows aggregate rating; no fraud vector (participant check, completed-only).

****Constraint:**** Must not affect ride lifecycle transitions or points capture; keep fields additive.

**---**

**### PHASE 3 — Product & UX hardening**

**---**

## CODEX EXECUTION RULE
Execute this task only. Inspect the real codebase instead of assuming the file contents. Run all verification gates relevant to the changed surfaces. Return the mandatory report from the MASTER PROMPT and stop.

---


# TASK 10

****PROMPT 10 — Fare estimation is optional; decide NetX contract carefully****

**(Advisory, not mandatory.)** The current model is driver-offered pricing. If the business wants passenger-side pre-pricing, design a ****server-side fare estimator**** (`/api/fares/estimate`) using Google Routes distance/duration × vehicle-type rates and a distance-matrix cache. Implement only after PM sign-off, and treat the estimator output as advisory — drivers keep final offer authority.

****Files:**** new `fareService.js`, `fareRoutes.js`, rates config via `PointsSettings`-style singleton or env. Add unit tests for parity with at least 5 known route fixtures.

**---**

## CODEX EXECUTION RULE
Execute this task only. Inspect the real codebase instead of assuming the file contents. Run all verification gates relevant to the changed surfaces. Return the mandatory report from the MASTER PROMPT and stop.

---


# TASK 11

****PROMPT 11 — Multi-city / service-area expansion****

****Objective:**** Generalize the hard-coded Dubai discovery without breaking the current Dubai market.

****Files:**** `src/utils/dubaiLocation.js`, `src/utils/availableDrivers.js` (`DUBAI\_SERVICE\_AREA`, build* aggregations), `src/socket/index.js` (rooms), `GET /api/driver/available`, admin `DriverMap.jsx`.

****Spec:****
- Introduce a `ServiceArea` collection (geofence polygons + vehicle type + settings) with a default Dubai seed; replace constant references with a lookup backed by a small in-memory cache refreshed on change.
- Keep room naming compatible (`discoveryRoom(serviceAreaId, vehicleType)`); room names must remain stable across deployments.
- Backfill drivers' `currentServiceArea` from their last recorded position.
- Add a lightweight DB migration + tests (existing `dubai-discovery.test.js` must keep passing for the default seeded area).

****Expected result:**** Adding a new polygon in admin enables that city with no code change; Dubai behaves exactly as before.

****Constraint:**** Rate limiting and location freshness rules stay identical for all areas.

**---**

## CODEX EXECUTION RULE
Execute this task only. Inspect the real codebase instead of assuming the file contents. Run all verification gates relevant to the changed surfaces. Return the mandatory report from the MASTER PROMPT and stop.

---


# TASK 12

****PROMPT 12 — Admin panel modernization pass****

****Objective:**** Reduce duplicated legacy code and debug cruft; improve build quality.

****Files:**** `Headers.jsx`, `Dashboard.jsx`, `App.jsx`, dead pages under `pages/` (Club, GolfCourses, Providers, ServiceRequests, Orders, Revenue, CmsManagement, Faq, AccountSettings, Services, PushNotification), `src/App.css`/`style.css`/`mystyle.css` merge.

****Spec:****
- Remove routes to dead pages, their imports, and associated unused components (only after confirming nothing is linked from active pages).
- Consolidate the many CSS files into scoped Tailwind utilities, keeping class names that jQuery selectors depend on (verify with tests).
- Extract shared UI (page shell, tables, status chips, pagination) — reuse the existing `driverPoints/` components as the reference implementation.
- Keep `dist/` untracked (add `drewel-admin-panel/dist/` to `.gitignore` if not already respected).

****Expected result:**** Smaller bundle, no unreachable routes, all `npm test` + `lint` + `build` pass, and the built app behaves identically on the live origin.

****Constraint:**** Do not change any backend contracts; panel is never the source of truth.

**---**

## CODEX EXECUTION RULE
Execute this task only. Inspect the real codebase instead of assuming the file contents. Run all verification gates relevant to the changed surfaces. Return the mandatory report from the MASTER PROMPT and stop.

---


# TASK 13

****PROMPT 13 — Mobile UX hardening****

****Objective:**** Polish the Flutter app and eliminate fragile fallbacks.

****Files:**** `lib/common/http\_methods.dart`, `lib/app/data/apis/api\_methods/api\_methods.dart`, `lib/app/data/apis/api\_constants/api\_url\_constants.dart` (supportAdminId), modules `active\_ride/`, `communication/`, `points/`, `otp/`.

****Spec:****
- Remove hardcoded `supportAdminId` default; fetch the support channel from the server (`getSupportAdmin` config or `/api/rides/.../ support` contract) or make it a `--dart-define`.
- Add automatic JWT refresh when the server returns 401 (new `refresh` token only if server released it; otherwise re-auth through OTP). Keep all retry idempotency behavior.
- Replace fragile "fallback to legacy endpoint" branches in `ApiMethods` with a single negotiated contract (server always on `driver/request` + `complete-profile`), per the planned deployment baseline (see Prompt 16).
- Add a reconnect-resilient queue for `ride:driver\_location` emits (already partially handled) and suppress duplicate `drivers-nearby` renders.
- Audit `print()` calls; gate any remaining ones behind `kDebugMode` (already done for most).

****Expected result:**** No hardcoded support identity; graceful 401 handshake; deterministic upload/registration paths; existing Flutter tests remain green (add tests for the new auth-refresh and the removal of fallbacks).

****Constraint:**** Keep both EN/AR locales working; preserve accessibility (48pt targets, semantics) already covered by current tests.

**---**

**### PHASE 4 — Reliability, observability, and scale**

**---**

## CODEX EXECUTION RULE
Execute this task only. Inspect the real codebase instead of assuming the file contents. Run all verification gates relevant to the changed surfaces. Return the mandatory report from the MASTER PROMPT and stop.

---


# TASK 14

****PROMPT 14 — Shared rate-limit store and horizontal-scaling readiness****

****Objective:**** Make rate limiting correct when multiple backend instances run.

****Files:**** `drewel-backend/src/middlewares/pointsRateLimit.js`, `marketplaceRateLimit.js`, `index.js` (config), `render.yaml`/Dockerfile env.

****Spec:****
- Add `RATE\_LIMIT\_STORE=memory|redis` (default `memory`). When `redis`, use `rate-limit-redis` + the existing Redis-URL env (`REDIS\_URL`) and set `trust proxy` from `TRUST\_PROXY\_HOPS`.
- Keep in-memory store on single-instance free tier unchanged.
- Ensure rate-limit keys are `(route, ip, subject)` and stable under proxies.

****Expected result:**** No behavioral change on the current single-instance deployment; documented how to switch when scaling. Add tests for redis-store configuration correctness (mock store).

****Constraint:**** Do not add Redis as a hard dependency.

**---**

## CODEX EXECUTION RULE
Execute this task only. Inspect the real codebase instead of assuming the file contents. Run all verification gates relevant to the changed surfaces. Return the mandatory report from the MASTER PROMPT and stop.

---


# TASK 15

****PROMPT 15 — Structured logging, request IDs, and uptime/alert endpoint****

****Objective:**** Make production debuggable and observable.

****Files:**** `index.js`, `src/utils/loadEnv.js`, new `src/utils/logger.js`, `scripts/`, `render.yaml` (healthcheck).

****Spec:****
- Add a request-ID middleware (UUID) that threads into error responses and logs; log in JSON lines to stdout (Render-friendly) with `level`, `reqId`, `route`, `status`, `durationMs`, `userId` (never tokens/PII).
- Stamp `req.requestId` through global error handler.
- Expose `/api/health` with DB + socket uptime + per-job lag; configure Render health check path.
- Add `scripts/` audit command to summarize failed `PointsOutboxEvent`s and pending dispute resolutions (reuse `pointsAdminAuditService`).

****Expected result:**** Requests are traceable end-to-end; operational dashboards consume structured logs; health endpoint reflects real readiness.

****Constraint:**** Keep logs free of body payloads and secrets.

**---**

## CODEX EXECUTION RULE
Execute this task only. Inspect the real codebase instead of assuming the file contents. Run all verification gates relevant to the changed surfaces. Return the mandatory report from the MASTER PROMPT and stop.

---


# TASK 16

****PROMPT 16 — Release pipeline & environment promotion (pre-production → production)****

****Objective:**** Make deployment reproducible and prevent "unknown environment drift" (the panel currently defaults to `admin-dreewel.com`).

****Files:**** `render.yaml`, Dockerfiles, `drewel-admin-panel/.env*.example`, `drewel-backend/.env.example`, `README.md`.

****Spec:****
- Formalize three environments: `dev` (localhost), `staging` (Render preview/static branch), `prod` (`admin-dreewel.com`). Encode URLs as env/build-time vars; Flutter already supports `--dart-define=API\_BASE\_URL/SOCKET\_URL`.
- Update the panel defaults so a fresh build points to the env it was built for; never ship a fat bundle with hardcoded prod URLs to a different environment.
- Backend: enforce `ALLOW\_START\_WITHOUT\_DB=false` prod rule already present; document DB backup restore + `backfill:active-ride-locks` run book for releases.
- Add a `RELEASE\_CHECKLIST.md` (or README section): apply migrations → backfill → smoke auth → smoke discovery → smoke ride lifecycle → smoke points → watch outbox → enable.

****Expected result:**** Any engineer can promote dev→staging→prod with documented steps; each env is isolated by allowlist + env vars.

****Constraint:**** Do not merge environment-specific settings into code; keep them in env/config.

**---**

**### PHASE 5 — Final verification, optimization, and handover**

**---**

## CODEX EXECUTION RULE
Execute this task only. Inspect the real codebase instead of assuming the file contents. Run all verification gates relevant to the changed surfaces. Return the mandatory report from the MASTER PROMPT and stop.

---


# TASK 17

****PROMPT 17 — Full regression pass with integration database****

****Objective:**** Prove release-readiness per README ("a run with skipped integration tests is not a release pass").

****Files:**** all test suites; `Reports:` regenerate the July-2026 report artifacts.

****Spec:****
- Provision a disposable MongoDB replica set (or `mongodb-memory-server` with RS support). Set `MONGO\_URI` + `POINTS\_INTEGRATION\_TEST\_DB`.
- Run: backend `npm test` (expect 0 skips), Flutter `flutter analyze` (0 new issues) + `flutter test`, panel lint/test/build.
- Fix every failure; do not lower thresholds.
- Update the stakeholder report (`reports/drewel-july-2026/...`) with the final passed/skipped chart, or add an August-2026 report.

****Expected result:**** All gates green with ****no skipped integration tests****, documented in a single `reports/REPORT\_NOTES.md` update.

**---**

## CODEX EXECUTION RULE
Execute this task only. Inspect the real codebase instead of assuming the file contents. Run all verification gates relevant to the changed surfaces. Return the mandatory report from the MASTER PROMPT and stop.

---


# TASK 18

****PROMPT 18 — Performance & index review****

****Objective:**** Ensure the backend stays fast at scale.

****Files:**** all Mongoose schemas (`src/models/*.js`), `scripts/audit-image-assets.js`, `scripts/backfill-driver-points.js`.

****Spec:****
- Review every query path (ride lookup by participant+status, discovery aggregation, wallet/transaction listing, admin list endpoints) against current indexes; add compound indexes only where the query planner proves a need; drop unused indexes.
- Paginate the large admin lists (rides, transactions, wallets, users, drivers) — add `limit`/`cursor` support where missing (existing admin routes already pass `limit` for discovery).
- Optimize the Dubai discovery aggregation with a 2dsphere index on `Driver.currentLocation`.
- Re-run `scripts/audit-image-assets.js` to identify orphaned files; add orphan cleanup to the job.

****Expected result:**** Query plans verified with `explain`; no full-collection scans on the hot paths; tests green.

**---**

## CODEX EXECUTION RULE
Execute this task only. Inspect the real codebase instead of assuming the file contents. Run all verification gates relevant to the changed surfaces. Return the mandatory report from the MASTER PROMPT and stop.

---


# TASK 19

****PROMPT 19 — Security re-audit & penetration checklist****

****Objective:**** Final security confirmation before release.

****Files:**** whole repo; produce `SECURITY.md`.

****Spec (manual/automated):****
- Re-run gitleaks (Prompt 3) on the final tree.
- `npm audit` both Node apps; upgrade vulnerable production deps (careful with Express 5 / Mongoose minors).
- Confirm: no public endpoint serves private docs; OTP rate limiting + expiry; pickup PIN fields `select:false`; admin endpoints all behind `isAdmin`; CORS allowlist correct per env; JWT secret length ≥32 chars; `PICKUP\_PIN\_ENCRYPTION\_KEY` rotated if ever exposed.
- Verify all test-only DB connections never point at production.

****Expected result:**** `SECURITY.md` documents ownership, asset inventory, secret rotation, and the incident response steps; no known critical CVE in production deps.

**---**

## CODEX EXECUTION RULE
Execute this task only. Inspect the real codebase instead of assuming the file contents. Run all verification gates relevant to the changed surfaces. Return the mandatory report from the MASTER PROMPT and stop.

---


# TASK 20

****PROMPT 20 — Final documentation & handover****

****Objective:**** Make the repo self-explanatory for the next agent/team.

****Files:**** `README.md` (update), `drewel-backend/.env.example` docs, `RELEASE\_CHECKLIST.md`.

****Spec:****
- Refresh README quick-start, env tables, verification commands, deployment topology (accumulate all env vars introduced by prompts 1–19: Redis, Stripe, FCM, payments webhook, push, new rate-limit store).
- Add an "Architecture" section pointing to this file (`AI\_IMPLEMENTATION\_GUIDE.md`) as the living spec.
- Document all new endpoints added across prompts (payments, ratings, secure docs) in an `API.md` or the existing route comments.

****Expected result:**** A fresh agent can bootstrap dev, run tests, deploy staging/prod, and understand the domain from the docs alone.

**---**

**

## CODEX EXECUTION RULE
Execute this task only. Inspect the real codebase instead of assuming the file contents. Run all verification gates relevant to the changed surfaces. Return the mandatory report from the MASTER PROMPT and stop.

---


# FINAL PROJECT ACCEPTANCE GATE

Execute this only after TASK 20.

Perform a final end-to-end release audit. Drewel must not be declared finished or production-ready unless all mandatory gates below pass.

## 1. Repository
- no production secrets/signing artifacts tracked;
- no backup archives or generated admin `dist/` tracked;
- `.gitignore` protects sensitive/generated artifacts;
- CI is present and green;
- working tree contains only intentional release changes.

## 2. Backend
- all unit tests pass;
- all mandatory integration tests pass using a disposable MongoDB replica set;
- zero required integration tests are skipped;
- production configuration validation works;
- private documents require authenticated owner/admin access;
- ride state machine invariants remain intact;
- point ledger operations still use `pointsWalletService`;
- rate limiting matches deployment topology;
- structured logs and request IDs work;
- health/readiness endpoint works;
- database hot paths have appropriate verified indexes;
- no known critical vulnerability remains in production dependencies.

## 3. Flutter mobile
Verify:
- `flutter analyze`;
- `flutter test`;
- WhatsApp OTP authentication;
- passenger onboarding;
- two-stage driver onboarding;
- document upload/review flow;
- driver online/offline;
- nearby-driver discovery;
- contact ride;
- TripOffer creation;
- point deduction;
- offer acceptance/decline;
- complete ride lifecycle;
- pickup PIN;
- route/ETA;
- realtime driver location;
- chat;
- Agora calling;
- cancellation/dispute flows;
- driver points wallet;
- purchase flow;
- push notifications if enabled;
- ratings if enabled;
- English;
- Arabic/RTL;
- reconnect/resume behavior.

## 4. Admin panel
Verify:
- lint;
- tests;
- production build;
- authentication;
- RBAC;
- driver request review;
- secure document preview;
- user restriction;
- rides listing/detail;
- admin ride actions;
- points dashboard;
- wallet adjustment permissions;
- purchase requests;
- point packs/settings;
- audit logs;
- calls;
- chat;
- live driver map;
- no hardcoded admin identities;
- no production debug logging.

## 5. Deployment
Verify:
- dev/staging/prod isolation;
- correct URLs and origin allowlists;
- MongoDB replica-set requirement;
- secret injection;
- database backup/restore instructions;
- required backfills;
- Render/Docker health check;
- release checklist;
- rollback procedure;
- smoke-test procedure.

## 6. Documentation
Must exist and be current:
- `README.md`;
- backend `.env.example`;
- API documentation;
- `SECURITY.md`;
- `RELEASE_CHECKLIST.md`;
- architecture / AI implementation guide;
- operations notes.

## FINAL DELIVERABLE

Create `FINAL_RELEASE_REPORT.md` containing:

1. repository commit/release identifier;
2. architecture summary;
3. completed feature matrix;
4. exact test results;
5. integration test results;
6. security audit results;
7. dependency audit results;
8. performance/index findings;
9. infrastructure status;
10. environment status;
11. known limitations;
12. deferred optional features;
13. deployment steps;
14. rollback steps;
15. production smoke-test checklist;
16. GO / NO-GO recommendation.

If any mandatory gate fails or is skipped, the recommendation must be `NO-GO` and must explain what remains before production.

Stop after the final report.
