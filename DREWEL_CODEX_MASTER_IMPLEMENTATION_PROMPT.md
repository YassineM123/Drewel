# DREWEL — MASTER CODEX PROMPT
## Integrate the Figma Admin Dashboard, audit the entire product, fix missing logic, and make Drewel production-ready

You are working as a **Senior Full-Stack Engineer + Senior SaaS/Product Engineer + Senior Mobile Engineer + Senior UI/UX Engineer** on the existing **Drewel** platform.

Your mission is NOT to rebuild the project blindly.

Your mission is to:

1. deeply audit the existing Drewel codebase;
2. inspect the Figma Admin Dashboard folder I added to the repository;
3. understand Drewel's real business logic;
4. use the Figma implementation as the **visual/UX reference** for the admin portal;
5. reuse the existing backend, models, services, APIs, authentication, sockets, mobile apps, and business logic wherever possible;
6. fix incomplete, duplicated, inconsistent, broken, mocked, disconnected, or missing functionality;
7. complete the Passenger app, Driver app, Admin Dashboard, backend, realtime communication, notifications, points system, reservations, maps, profiles, settings, support, and operational tooling;
8. leave the repository in a clean, coherent, tested, production-oriented state.

---

# 0. NON-NEGOTIABLE WORKING RULE

Before modifying code, **scan the complete repository**.

Do not assume folder names.

Locate automatically:

- Passenger mobile application
- Driver mobile application
- Admin web application
- Backend/API
- database models/schemas
- API routes/controllers
- services
- Socket.IO/realtime logic
- authentication/authorization
- notification services
- maps/location services
- ride/reservation services
- TripOffer logic
- points/wallet logic
- messaging/chat
- secure calls
- uploads/documents
- configuration/env files
- tests
- documentation
- the newly added **Figma Admin Dashboard source folder**

Create a mental architecture map before editing.

If repository documentation exists (`README`, `AGENTS.md`, `CLAUDE.md`, architecture docs, API docs, etc.), read it before implementation.

**Do not delete or replace working architecture merely because the Figma prototype uses a different stack.**

---

# 1. FIGMA ADMIN DASHBOARD — SOURCE OF TRUTH FOR DESIGN, NOT BUSINESS LOGIC

I added into the Drewel repository a folder containing the Figma Make version of the new admin dashboard.

The original Figma Make project uses approximately:

- React
- TypeScript
- Vite
- Tailwind CSS
- React Router
- Lucide icons
- Recharts
- mock data

It contains screens/components corresponding to:

- Login
- Dashboard
- Drivers
- Users
- Online Drivers
- Verification Requests
- Verification Request Details
- Reservations / Rides
- Live Reservations
- All Reservations
- Completed Reservations
- Cancelled Reservations
- Disputes
- Stuck Rides
- Driver Points Overview
- Driver Wallets
- Point Purchase Requests
- Point Transactions
- Point Packs
- Chat
- Secure Calls
- Alerts
- Audit Logs
- Team & Roles
- System Health
- Sponsor Banners
- Settings
- shared Layout
- Sidebar
- TopBar
- shared UI primitives

Use that folder to reproduce:

- layout hierarchy
- spacing
- typography
- navigation
- cards
- tables
- filters
- badges
- empty states
- dialogs
- responsive behavior
- information density
- component styling
- burgundy Drewel identity
- overall premium operational feel

### Critical

Do **NOT** copy the prototype's mock architecture into production.

Do **NOT**:

- create a second backend;
- create duplicate Ride models;
- create duplicate users/drivers collections;
- create duplicate TripOffer logic;
- create a second points wallet system;
- create a separate chat system;
- create a second secure-call system;
- keep mock data where real APIs exist;
- replace working project components unnecessarily;
- migrate the existing app to Vite/React 19 just because the Figma source uses those technologies.

Adapt the design to the **existing Drewel project stack**.

---

# 2. DREWEL PRODUCT MODEL — UNDERSTAND THIS BEFORE CODING

Drewel is **not an Uber-style automatic dispatch application**.

The core marketplace flow is:

1. Passenger selects/searches a nearby available driver.
2. Passenger sends a ride request.
3. Driver receives the request.
4. Driver sends an official priced **Trip Offer**.
5. Passenger accepts or declines.
6. Backend validates the transition.
7. Driver points may be reserved/captured/released according to the offer/ride lifecycle.
8. Ride becomes active only through valid backend state transitions.
9. Driver and passenger can communicate through Drewel.
10. Admin can supervise the operation.

The backend must remain authoritative for all important transitions.

Never let the frontend invent final ride states.

---

# 3. FIRST PHASE — COMPLETE REPOSITORY AUDIT

Before implementation, inspect the code and create/update a file such as:

`docs/DREWEL_IMPLEMENTATION_AUDIT.md`

Record:

## Architecture

- frontend applications
- backend
- database
- realtime layer
- authentication
- storage
- external services
- maps
- notifications
- deployment configuration

## Feature Matrix

For each feature mark:

- COMPLETE
- PARTIAL
- BROKEN
- MOCKED
- MISSING
- DUPLICATED
- UNUSED
- SECURITY RISK

Cover at least:

### Passenger
- Authentication
- Onboarding
- Home
- Location search
- Nearby drivers
- Driver details
- Ride request
- Trip offer
- Offer acceptance
- Current ride
- Ride history
- Ride detail
- Saved places
- Messaging
- Calls
- Notifications
- Profile
- Edit profile
- Saved addresses
- Favorites
- Settings
- Language
- Privacy
- Support
- Report issue
- Logout

### Driver
- Authentication
- Two-step signup
- Driver verification
- Personal information
- Vehicle information
- Documents
- Expiry/status
- Online/offline
- Availability
- Live GPS
- Ride requests
- Trip offers
- Current ride
- Ride history
- Earnings/activity if supported
- Points balance
- Point transactions
- Point purchases
- Messages
- Notifications
- Calls
- Ratings/reviews if supported
- Performance
- Support
- Report passenger/problem
- Settings
- Security
- Privacy
- Language
- Logout

### Admin
- Authentication
- Dashboard
- Users
- Drivers
- Online Drivers
- Live map
- Driver verification
- Reservations
- Ride details
- Disputes
- Stuck rides
- Points
- Chats
- Calls
- Alerts
- Notifications
- Sponsor content
- Audit logs
- Roles
- System health
- Settings

Do not stop after documenting. Continue directly with implementation.

---

# 4. ADMIN DESIGN SYSTEM

Preserve Drewel identity.

## Main colors

Primary burgundy:

`#BE1B2C`

Use darker burgundy tones for:

- admin sidebar
- hover states
- active states
- destructive emphasis where appropriate

Accent:

- amber / gold

Neutral UI:

- white
- soft neutral backgrounds
- charcoal text
- muted gray

Reference text colors:

- main: approximately `#222222`
- muted: approximately `#868686`

Avoid generic blue SaaS styling.

---

# 5. ADMIN SHELL

Implement/refine:

## Sidebar

Sections:

### Overview
- Dashboard

### People
- Drivers
- Users

### Requests
- Pending
- Approved
- Rejected
- All Requests

### Operations
- Live Reservations
- All Reservations
- Online Drivers
- Disputes
- Stuck Rides

### Driver Points
- Overview
- Wallets
- Purchase Requests
- Transactions
- Packs

### Communication
- Chat
- Secure Calls

### Content
- Sponsor Banners

### Governance
- Alerts
- Audit Logs
- Team & Roles
- System Health
- Settings

Requirements:

- collapsible desktop sidebar
- mobile drawer
- correct active states
- badges from real data
- no hardcoded badge counts
- keyboard accessible
- clean scrolling
- role-based visibility when necessary

## Top Bar

Include where relevant:

- page title
- contextual subtitle
- global/admin search only if genuinely useful
- notifications
- admin profile
- responsive actions
- breadcrumbs where useful

---

# 6. ADMIN DASHBOARD — REAL OPERATIONS OVERVIEW

Build a true operational dashboard.

Metrics must come from real APIs/database queries.

Include when supported:

- Total users
- Total drivers
- Online drivers
- Discoverable drivers
- Restricted users/drivers
- Pending Approval 1
- Pending Approval 2
- Active reservations
- Pending Trip Offers
- Completed today
- Cancelled today
- Open disputes
- Stuck rides
- Drivers with low point balance
- Pending point purchase requests
- Unread support chats
- Reported secure calls
- Realtime/Socket.IO health
- API health

Add useful operational sections such as:

- live operations
- recent reservations
- pending verification
- alerts requiring action
- driver availability
- point activity
- support queue

No decorative fake analytics.

Charts are allowed only if data is meaningful.

---

# 7. ONLINE DRIVER VS DISCOVERABLE DRIVER

These are NOT equivalent.

A driver may be technically connected/online but not eligible to appear to passengers.

Determine discoverability using the existing backend rules.

Where applicable, a discoverable driver should satisfy conditions similar to:

- account approved
- unrestricted
- online/realtime connected
- `availabilityStatus = Online`
- no active ride
- valid coordinates
- sufficiently recent GPS
- acceptable location accuracy
- inside active service area
- vehicle type matches active passenger filter

Do not hardcode these rules in multiple frontends.

Centralize them on the backend/service layer.

The admin UI should explain why an online driver may not be discoverable.

---

# 8. DRIVER LIVE MAP

Use the existing map provider/infrastructure.

Do not introduce another map provider unless unavoidable.

Requirements:

- initial REST fetch
- Socket.IO location updates
- markers for valid drivers only
- marker state based on:
  - online
  - offline
  - busy
  - available
  - stale location
- driver popup/detail
- vehicle type
- availability
- location freshness
- location accuracy
- heading if available
- active ride status
- last location update

Never fabricate GPS.

Do not show stale or invalid coordinates as trustworthy live positions.

---

# 9. RESERVATION / RIDE LIFECYCLE

Find the actual existing enums/status values first.

Do not create conflicting status names if the backend already defines them.

Normalize UI labels around the real lifecycle.

Typical lifecycle may include:

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

## Reservations page

Implement:

- search
- pagination
- status
- vehicle type
- city/service area
- date
- passenger
- driver
- sorting
- responsive table/list
- real refresh
- CSV export of current filtered dataset where appropriate

## Ride detail

Display:

- ride ID
- passenger
- selected/assigned driver
- vehicle
- pickup
- destination
- timestamps
- lifecycle timeline
- TripOffer information
- current status
- cancellation reason
- dispute information
- points impact
- related chat/call references where authorized
- audit history

Admin actions must be backend-driven.

Sensitive actions may include:

- cancel ride
- resolve dispute
- unlock participants
- refund/release points if allowed

Each dangerous mutation must use:

- confirmation
- reason
- authorization
- backend validation
- idempotency
- audit trail

---

# 10. DRIVER TRIP OFFER

Audit and fix the complete TripOffer workflow.

The driver must be able to:

- receive a valid ride request
- view passenger/request information allowed by privacy rules
- enter/send official price
- see expiration state
- withdraw only if product rules permit
- receive accepted/declined/expired state

Passenger must be able to:

- receive offer
- see clear price
- see driver
- accept
- decline
- see expiration

Backend must:

- verify ride state
- verify driver eligibility
- prevent duplicate conflicting offers
- enforce offer TTL
- enforce point logic
- transition ride atomically
- handle race conditions
- emit realtime events

Default offer TTL may be approximately **300 seconds** unless current backend/settings define another value.

Prefer backend-configurable values.

---

# 11. DRIVER POINTS SYSTEM

This is a core Drewel feature.

Do not implement points as frontend-only balances.

Audit existing:

- wallet schema
- transactions
- point packages
- purchases
- offer reservation
- capture
- refund/release
- admin credits
- transaction history

Suggested/default rules if not already configurable:

- Welcome points: `100`
- Ride offer cost: `20`
- Low balance warning: `20`
- Trip offer TTL: `300 seconds`

Existing configured backend values always override defaults.

## Admin pages

### Overview
- total issued
- total consumed
- total reserved
- purchased
- bonus
- low balance drivers
- pending purchase requests
- recent transactions

### Wallets
Show:

- driver
- available
- reserved
- purchased
- bonus
- consumed
- active offers
- last transaction

### Wallet detail
Include complete ledger.

### Purchase requests
Actions:

- approve
- reject
- inspect payment reference

Approval must require:

- authorization
- verified payment reference
- duplicate prevention
- audit log
- transaction

### Transactions
Filter by:

- driver
- type
- date
- ride
- admin
- reference

### Packs
Owner-only editing if this exists in product logic.

Never mutate balances directly without a transaction/ledger operation.

---

# 12. DRIVER VERIFICATION

Support a clean two-stage verification process if this matches the existing Drewel backend.

Separate:

- Approval 1
- Approval 2

Show:

- driver
- status
- required documents
- submitted date
- reviewer
- review date
- SLA age
- rejection reason
- complete history

Detail screen:

- document preview/download according to permissions
- approve
- reject
- reopen where allowed

Rejection requires a reason.

Every decision must be persisted server-side and audited.

Do not allow UI-only approval.

---

# 13. USERS ADMIN

Provide:

- user search
- pagination
- status
- join date
- ride count if available
- restriction status
- detail view
- ride history
- support history where authorized

Dangerous actions should be explicit:

- restrict
- unrestrict
- suspend if supported

Protect private data.

---

# 14. DRIVERS ADMIN

Provide:

- search
- status
- verification stage
- availability
- online status
- discoverability
- vehicle
- point balance
- current ride
- last GPS
- account restriction
- document status

Driver detail should consolidate operational information instead of forcing admins to search across multiple pages.

---

# 15. COMMUNICATION — CHAT

Drewel must support direct passenger ↔ driver communication around rides, plus operational/admin support where required.

Audit current chat architecture first.

Do not create duplicate chat collections/services.

Support:

## Passenger
- conversation with driver for relevant ride
- existing conversations
- unread status
- timestamps
- delivery/read state if supported

## Driver
- incoming message notification
- open chats
- respond
- all conversations

## Admin
- support conversations
- All
- Unread
- Drivers
- Users filters

Critical realtime behavior:

A late socket event from another conversation must NOT replace the currently selected conversation.

Use stable conversation IDs.

Preserve unread counts.

Keep passenger/driver personal phone numbers private.

Keep ride chat and support chat distinct unless intentionally linked.

---

# 16. SECURE IN-APP CALLS

Audit the existing calling architecture.

Passenger and driver should be able to initiate calls according to product rules.

Admin should see metadata only.

Admin Secure Calls page may show:

- call ID
- ride ID
- caller role/name
- receiver role/name
- call state
- started time
- duration
- end reason
- reported flag
- safety review status

Never expose:

- private phone numbers unnecessarily
- call provider secrets
- session tokens
- audio recordings unless the product explicitly implements legal recording workflows

Do not invent recording.

---

# 17. NOTIFICATIONS — FIX END TO END

Audit every notification producer and consumer.

Support relevant events:

### Passenger
- driver offer received
- offer expiring
- offer accepted state
- driver on the way
- driver arrived
- ride started
- ride completed
- cancellation
- message
- call
- support response

### Driver
- new ride request
- passenger message
- offer accepted
- offer declined
- offer expired
- ride changes
- low points
- point purchase approved/rejected
- verification update
- document expiry
- admin/system message

### Admin
- pending verification
- dispute
- stuck ride
- reported call
- pending purchase request
- system/realtime issue
- support queue

Notifications must have:

- stable type
- title
- body
- actor/entity
- target screen/deep link
- timestamp
- read/unread state

Prevent duplicates.

Fix incorrect navigation/deep links.

If the mobile app has custom notification sound support, keep it tasteful and platform compliant.

---

# 18. PROFILE & SETTINGS — PASSENGER

Ensure Passenger contains:

- Profile
- Edit profile
- photo
- name
- phone
- email
- saved addresses: Home / Work
- ride history
- ride details
- current ride
- favorite/saved places
- notifications center
- messages
- call history
- language
- notification preferences
- privacy
- terms & conditions
- help & support
- report a problem
- logout
- app version/about Drewel

Do not create duplicate screens if they already exist.

Improve existing ones instead.

---

# 19. PROFILE & SETTINGS — DRIVER

Ensure Driver contains:

- Driver profile
- Personal information
- Vehicle profile
- Documents
- Document status
- Expiry alerts
- Online / Offline
- Ride history
- Activity / earnings if product supports it
- Points balance
- Points transactions
- Buy/recharge points
- Messages / All chats
- Notifications
- Call history
- Ratings/reviews if implemented
- Performance statistics if meaningful
- Support
- Report passenger/problem
- Settings
- Language
- Privacy
- Security
- Logout

Keep the current Drewel visual identity.

New screens must look native to the existing app, not pasted from another template.

---

# 20. TWO-STEP DRIVER REGISTRATION

Preserve or implement the intended two-step signup:

## Step 1
Minimal identity information such as:

- first name
- last name
- required basic signup data

## Step 2
Complete driver profile:

- phone/email where required
- vehicle
- vehicle category/type
- identification
- license
- required documents
- any additional compliance fields

Validate server-side.

Allow incomplete onboarding to resume safely.

Do not expose sensitive verification material unnecessarily.

---

# 21. ONLINE / OFFLINE DRIVER UX

Audit this flow carefully.

Driver must clearly understand current state.

Improve:

- Online card/status
- Go Online
- Go Offline

If relevant, allow Go Offline from notification/action UX.

Prevent going offline in states where business rules prohibit it, or show confirmation/explanation.

State must be server-authoritative and synchronized in realtime.

---

# 22. SPONSOR BANNERS / CMS

Use the Figma page if relevant.

Implement real CRUD only if the backend already supports or genuinely needs it.

Possible fields:

- title
- image
- destination/deep link
- active
- start date
- end date
- ordering
- audience

Validate uploaded content.

Do not leave mock CRUD pretending to be persisted.

---

# 23. ALERTS

Create/use a unified operational alerts model/view only if it fits current architecture.

Potential alerts:

- stuck ride
- dispute
- stale driver GPS
- low points
- verification backlog
- expiring driver documents
- failed notifications
- realtime outage
- reported call
- payment/purchase issue

Alerts must link to relevant entities.

No fake counts.

---

# 24. TEAM & ROLES — RBAC

Use existing auth architecture.

Support/administer roles such as:

- Owner
- Admin
- Finance Admin
- Support Admin
- Verification Admin

Only create these exact roles if compatible with current system.

Permissions should be backend-enforced.

Examples:

### Owner
Full access.

### Finance
- point purchase
- wallet/transactions
- permitted credits/refunds

### Support
- rides
- disputes
- chats
- call reports

### Verification
- driver verification

Dangerous configuration such as points pricing should be Owner-only.

UI hiding is not security.

Backend authorization is mandatory.

---

# 25. AUDIT LOGS

Critical admin actions must be logged.

Capture:

- admin ID
- role
- action
- entity type
- entity ID
- before state when appropriate
- after state when appropriate
- reason
- timestamp
- IP/user agent if current infrastructure supports it

Do not log secrets.

Admin audit page:

- filters
- actor
- action
- entity
- date
- detail

---

# 26. SYSTEM HEALTH

Connect to real health/realtime status.

Display when available:

- API status
- DB connectivity
- Socket.IO status
- location stream freshness
- notification provider status
- storage status
- last successful synchronization
- application version/build

Do not create fake incidents.

If a metric is unavailable, display a truthful unavailable/not configured state instead of synthetic data.

---

# 27. SETTINGS

Separate:

- user/admin personal preferences
- global system configuration

Potential global settings, only when supported:

- point rules
- offer TTL
- low balance threshold
- service areas
- location freshness
- GPS accuracy
- notification settings
- support settings

Use validated backend settings.

Avoid magic constants spread across clients.

---

# 28. RESPONSIVE ADMIN

The admin dashboard must work properly on:

- large desktop
- laptop
- tablet
- mobile admin fallback

Tables on small screens must:

- become scrollable safely, or
- collapse into cards where more usable

Do not allow broken horizontal overflow.

Sidebars/drawers must remain usable.

Dialogs must fit viewport.

Touch targets should remain accessible.

---

# 29. MOBILE UX QUALITY

Preserve Drewel's original mobile theme, but improve newly added screens.

Rules:

- simple
- premium
- fast
- not visually overloaded
- clear hierarchy
- native-feeling
- consistent spacing
- consistent icons
- consistent button hierarchy
- meaningful empty states
- loading skeletons where appropriate
- retry state for API failures
- offline/reconnect awareness where relevant

Do not redesign the entire mobile application into a different brand unless necessary.

---

# 30. RTL / ARABIC / LOCALIZATION

Where localization already exists or is required:

- support RTL correctly
- no mirrored map semantics that become confusing
- icons that represent direction should behave appropriately
- dates and numbers should be localization-ready
- no hardcoded English-only layout assumptions

Do not break existing languages.

---

# 31. API INTEGRATION

No important production page should rely on mock data if a real endpoint exists.

Create a consistent API/client architecture based on the current project.

Requirements:

- auth token handling
- refresh/session handling if supported
- 401
- 403
- 404
- validation errors
- server errors
- retry strategy where safe
- request cancellation where useful
- loading state
- empty state
- mutation state

Do not silently swallow API errors.

---

# 32. IDEMPOTENCY & RACE CONDITIONS

Critical mutations must be safe.

Use idempotency keys for operations such as:

- approving point purchase
- manual point credit
- point refund
- ride cancellation
- dispute resolution
- verification decisions where relevant

Protect TripOffer acceptance from double-processing.

Protect points from duplicate capture/deduction.

Use transactions/atomic updates where supported by the current database architecture.

---

# 33. SOCKET.IO / REALTIME

Audit existing events before inventing new ones.

Create a documented event map.

Ensure:

- authentication
- correct rooms
- user rooms
- driver rooms
- ride rooms
- admin/operations rooms if required
- reconnect handling
- duplicate listener cleanup
- stale subscription cleanup

Potential realtime domains:

- driver location
- driver online status
- ride state
- TripOffer
- chat
- call metadata
- notification
- admin operations

Do not create multiple competing realtime clients.

---

# 34. SECURITY

Audit at minimum:

- JWT/session handling
- authorization
- admin RBAC
- IDOR risks
- upload validation
- document access
- XSS
- input validation
- rate limiting
- OTP endpoints
- authentication attempts
- Socket.IO authentication
- sensitive logs
- API secrets
- environment variables
- CORS
- production config

Never expose secret tokens to clients.

Never rely on frontend role checks alone.

---

# 35. DATA PRIVACY

Admin views should show only operationally necessary information.

Avoid exposing:

- phone numbers when not needed
- private documents to unauthorized roles
- provider secrets
- call tokens
- sensitive identity data in logs

Use masked values when appropriate.

---

# 36. REMOVE BAD MOCK / PLACEHOLDER DATA

Remove production-visible fake data such as:

- fake countries/cities unrelated to Drewel
- fake currencies
- stale timestamps
- impossible relative dates
- fake system incident numbers
- lorem ipsum
- hardcoded dashboard counters

If a page has no backend yet, either:

1. implement the backend cleanly if required by the product, or
2. clearly mark the feature as unavailable / not configured.

Do not deceive with mock operational data.

---

# 37. CSV EXPORT

Where admin screens offer CSV export:

- use the currently applied filters
- generate valid CSV
- proper encoding
- correct headers
- safe escaping
- real dataset
- meaningful filename with date

Do not leave a dead button.

---

# 38. SEARCH / FILTER / REFRESH

Every visible control must work.

No fake UI.

Search affects results.

Filters affect results.

Reset clears filters.

Refresh actually refetches.

Pagination works.

Sort works where shown.

Actions produce backend mutations.

---

# 39. LOADING / EMPTY / ERROR STATES

Every data-dependent screen must have:

- loading
- empty
- error
- retry

Critical mutation flows additionally need:

- pending state
- success feedback
- failure feedback

Avoid blank screens.

---

# 40. ACCESSIBILITY

Improve:

- labels
- form associations
- keyboard navigation
- focus states
- modal focus trapping
- contrast
- button names
- icon-only button aria-labels
- meaningful status text

Do not rely only on color for status.

---

# 41. PERFORMANCE

Avoid unnecessary rewrites.

Optimize only where valuable:

- duplicate API requests
- map marker updates
- large tables
- socket event storms
- expensive rerenders
- unbounded chat history
- large images
- long lists

Use pagination/virtualization only when justified.

---

# 42. CODE QUALITY

Follow current repository conventions.

Prefer:

- reusable components
- typed interfaces/models
- centralized constants
- domain services
- small focused hooks
- consistent error handling
- clear naming

Avoid:

- enormous god components
- duplicated status logic
- duplicated API calls
- magic strings
- copy/pasted Figma mock data
- unrelated refactors

---

# 43. FIGMA → CODE MAPPING PROCEDURE

For every admin screen:

1. identify corresponding Figma source page/component;
2. identify corresponding existing Drewel production page;
3. identify existing API/model/service;
4. retain useful production behavior;
5. port the Figma visual hierarchy;
6. replace mock data with production data;
7. wire filters/actions;
8. apply role permissions;
9. add states;
10. test.

If Figma has a screen missing from production:

- determine if it is a legitimate Drewel requirement;
- reuse existing backend domain logic;
- implement it cleanly.

If production has an important feature absent from Figma:

- do not delete it;
- redesign it using the same Drewel admin design language.

---

# 44. IMPORTANT: DO NOT BREAK WORKING FEATURES

Before replacing an existing implementation:

- identify callers;
- inspect routes;
- inspect imports;
- inspect backend contract;
- inspect mobile usage;
- inspect Socket.IO events.

Maintain backward compatibility where reasonable.

If an API contract must change:

- update all clients;
- document migration;
- update tests.

---

# 45. TESTING

Add/fix focused tests for critical flows.

At minimum prioritize:

- authentication
- authorization
- driver discoverability
- TripOffer creation
- TripOffer acceptance
- TripOffer expiry
- points reservation
- points capture
- points release/refund
- purchase request approval
- duplicate payment reference
- ride state transitions
- verification decisions
- chat realtime selection behavior
- relevant Socket.IO authorization
- critical admin actions

Also run existing tests.

---

# 46. BUILD VALIDATION

Before considering the mission complete:

- install dependencies correctly
- lint if configured
- typecheck
- run unit/integration tests
- build admin
- build backend if applicable
- validate mobile static analysis/build where practical

Fix errors caused by your changes.

Do not finish with known TypeScript/compiler errors.

---

# 47. CLEANUP

After migration:

Remove only items that are proven unused:

- dead mocks
- obsolete prototype components
- unused imports
- duplicate routes
- dead CSS
- abandoned temporary files

Do not delete the Figma reference folder until implementation is complete.

Prefer keeping it under a clearly named location such as:

`design-reference/figma-admin/`

or use the actual folder already present.

---

# 48. DOCUMENTATION

Update/create:

## `docs/DREWEL_ARCHITECTURE.md`
Current architecture.

## `docs/DREWEL_FEATURE_MATRIX.md`
Feature completion.

## `docs/DREWEL_ADMIN_FIGMA_MAPPING.md`
Map:

Figma page → production route → API → backend domain.

## `docs/DREWEL_REALTIME_EVENTS.md`
Socket events and ownership.

## `docs/DREWEL_IMPLEMENTATION_SUMMARY.md`
What you changed.

Do not create documentation that becomes inconsistent with the code.

---

# 49. IMPLEMENTATION PRIORITY

Use this priority order:

## P0 — Product correctness / security
- auth
- permissions
- Ride/TripOffer correctness
- points correctness
- driver discoverability
- state transitions
- duplicate mutations
- security

## P1 — Core operational UX
- admin shell
- dashboard
- reservations
- verification
- live drivers/map
- driver points
- chat
- notifications

## P2 — Product completeness
- profiles
- settings
- saved places
- calls
- support
- banners/CMS
- system health
- audit logs

## P3 — Polish
- animation
- micro-interactions
- advanced charts
- visual refinement

Do not sacrifice correctness for animation.

---

# 50. DESIGN QUALITY BAR

The resulting admin should feel like a real premium operations product, not a generic template.

Characteristics:

- strong information hierarchy
- dense but readable
- polished
- responsive
- consistent Drewel branding
- minimal visual noise
- operationally useful
- high quality tables
- predictable actions
- restrained motion
- excellent states

Use the supplied Figma folder as the visual target.

---

# 51. FORBIDDEN SHORTCUTS

Do not:

- implement everything with mock JSON;
- add TODO buttons that do nothing;
- create duplicated data models;
- migrate stacks unnecessarily;
- hardcode admin counts;
- hardcode current timestamps;
- generate fake GPS;
- fake API success;
- bypass backend validation;
- directly change wallet totals;
- expose phone numbers as a shortcut for calls;
- replace in-app messaging with WhatsApp;
- perform client-side-only authorization;
- silently ignore errors;
- remove working features simply because they are not in Figma;
- redesign unrelated screens without reason.

---

# 52. FINAL ACCEPTANCE CHECKLIST

The project is complete only when all applicable items below are satisfied:

- [ ] Repository audited
- [ ] Figma folder identified
- [ ] Existing architecture preserved
- [ ] Admin visual system migrated
- [ ] Dashboard uses real data
- [ ] Users admin works
- [ ] Drivers admin works
- [ ] Verification works
- [ ] Online Drivers works
- [ ] Live Map works
- [ ] Reservations work
- [ ] Ride details work
- [ ] TripOffer works end to end
- [ ] Points system is server-authoritative
- [ ] Purchase approvals are safe
- [ ] Chat works
- [ ] Secure calls integration is coherent
- [ ] Notifications work
- [ ] Passenger profiles/settings are complete
- [ ] Driver profiles/settings are complete
- [ ] Driver two-step signup is complete
- [ ] Online/offline logic is correct
- [ ] Alerts are meaningful
- [ ] Audit logs work
- [ ] RBAC is backend enforced
- [ ] System health is truthful
- [ ] Mock production data removed
- [ ] Search works
- [ ] Filters work
- [ ] Refresh works
- [ ] CSV export works where shown
- [ ] Loading states exist
- [ ] Empty states exist
- [ ] Error/retry states exist
- [ ] Responsive admin works
- [ ] Mobile app remains consistent
- [ ] RTL/localization readiness preserved
- [ ] Critical security issues fixed
- [ ] Critical race conditions addressed
- [ ] Tests added/fixed
- [ ] Typecheck passes
- [ ] Builds pass
- [ ] Documentation updated

---

# 53. HOW TO EXECUTE THIS TASK

Do not ask me to manually identify every file.

Inspect the repository yourself.

Work iteratively.

For each domain:

1. audit;
2. identify existing implementation;
3. compare against product requirement;
4. compare against Figma;
5. implement;
6. test;
7. document.

When uncertain, prefer the existing Drewel backend/domain model over assumptions from the Figma prototype.

Do not stop after an audit and ask me what to do next.

Continue to implement all safe, clearly required work.

If something genuinely cannot be completed because an external credential/provider is missing:

- implement the integration boundary;
- provide proper configuration;
- provide a truthful disabled/unconfigured UI state;
- document the exact missing external requirement;
- continue with the rest of the project.

---

# 54. REQUIRED FINAL RESPONSE FROM CODEX

At the end, return a concise engineering report containing:

## Completed
List the implemented/fixed domains.

## Architecture decisions
Only important decisions.

## API/backend changes
New/changed endpoints, schemas, services, events.

## Figma integration
Which Figma screens were mapped into production.

## Tests/build
Commands run and results.

## Remaining external blockers
Only genuine blockers such as missing credentials/provider configuration.

## Files changed
Group by:
- Mobile Passenger
- Mobile Driver
- Admin
- Backend
- Shared
- Docs

Do not claim success for anything not actually implemented or tested.

---

# FINAL OBJECTIVE

The final Drewel repository must behave as **one coherent product**:

- Passenger app
- Driver app
- Admin operations dashboard
- backend
- database
- realtime
- points
- reservations
- Trip Offers
- notifications
- communication
- maps
- verification
- security

The Figma Admin Dashboard is the new **visual and UX reference for administration**, while the **existing Drewel production logic remains the engineering source of truth** unless it is broken or incomplete.

Deliver a stable, professional, scalable implementation suitable for real users and a growing number of drivers.
