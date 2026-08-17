# Drewel Feature Matrix

Last updated: 2026-08-15

Legend: COMPLETE means backend-backed and represented in app/admin; PARTIAL means implemented but missing some master-prompt polish, production E2E, or external-provider verification; RISK means important security/configuration caveat remains.

## Passenger

| Feature | Status | Evidence |
| --- | --- | --- |
| Authentication | COMPLETE | User register/login/OTP routes and Flutter login/OTP modules. |
| Home/location search/nearby drivers | COMPLETE | Marketplace driver discovery, selected-origin refresh, server discoverability filters. |
| Ride request and Trip Offer | COMPLETE | Ride contact, ride messages, `TripOffer` lifecycle and Flutter points repository. |
| Offer acceptance/current ride/history/detail | PARTIAL | Backend lifecycle and Flutter active ride/history exist; authenticated two-device E2E still required. |
| Saved places/profile/settings/legal/support | COMPLETE | Account routes and passenger account repository/controllers. |
| Messaging/calls/notifications | PARTIAL | Ride chat, conversations, secure calls, device tokens and notifications exist; provider/device E2E required. |
| Language/RTL | PARTIAL | Mobile localization readiness exists in places; full RTL audit not completed in this slice. |

## Driver

| Feature | Status | Evidence |
| --- | --- | --- |
| Authentication and WhatsApp OTP | COMPLETE | Driver OTP lookup supports phone and WhatsApp number. |
| Two-step signup/verification/documents | COMPLETE | Request 1 and profile Request 2 workflow, pending amendments, admin review. |
| Online/offline/live GPS/discovery | COMPLETE | Presence lease, heartbeat, location update, freshness and service-area filters. |
| Ride requests/Trip Offers/current ride/history | PARTIAL | Backend and Flutter support exist; multi-role device E2E required. |
| Points wallet/transactions/purchases | COMPLETE | Server-authoritative wallet, transactions, purchase requests and admin tooling. |
| Messages/calls/notifications/support/settings | PARTIAL | Backed by repositories and controllers; provider/device E2E required. |

## Admin

| Feature | Status | Evidence |
| --- | --- | --- |
| Authentication/RBAC | PARTIAL | Admin JWT and points role middleware exist; broader role pages are not fully built. |
| Dashboard | COMPLETE | `/api/admin/dashboard` now returns real operational counters; React dashboard renders them. |
| Users/drivers/online drivers/live map | COMPLETE | Existing pages and endpoints use backend data; Users now expose server-backed search/filter/sort/pagination plus ride, active ride, support and restriction evidence; Drivers and Driver Detail expose server-backed operational summaries for verification, availability, discoverability, points, rides, TripOffers, calls, documents, GPS and audit history; Online Drivers and Live Driver Map surface server-computed marketplace discoverability, GPS freshness/accuracy diagnostics, masked contacts, realtime presence reconciliation, and Figma-style operational filters/KPIs. |
| Verification | COMPLETE | Pending/approved/rejected/all request pages and detail actions. |
| Reservations/ride details/disputes/stuck rides | COMPLETE | Backend-backed list/detail/actions exist; Figma-style live/all/completed/cancelled/disputed/stuck route aliases use real filters, sorting, refresh and CSV export. |
| Driver points | COMPLETE | Overview, wallets, purchases, transactions, packs/settings with backend permissions. |
| Chat/secure calls | PARTIAL | Existing admin chat/calls pages use backend data; support taxonomy still needs product review. |
| Sponsor banners | COMPLETE | Backend CRUD and admin page exist. |
| Alerts/audit logs/team roles/system health/settings | PARTIAL | Audit models and dashboard health exist; dedicated Figma pages are not all production-backed yet. |

## Security Risks

- Production credentials/signing materials in history require rotation and repository hygiene before release.
- Authenticated production and real-device E2E were not executed in this implementation slice.
- External notification, storage, Maps/Routes, Agora, and WhatsApp provider health depends on environment configuration.
