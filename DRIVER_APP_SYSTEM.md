# Drewel Driver App System

## Driver Navigation

Driver Home remains the operational entry point for online/offline, live GPS, ride requests, active ride recovery, messages, notifications, and points. Driver Profile is now the account hub at `/driver/profile`.

Driver Profile groups account operations as:

- Account: Personal Information, Vehicle, Documents
- Work: Ride History, Earnings / Activity, Points, Performance
- Communication: Messages, Notifications, Call History
- Support: Support, Report a Problem
- Settings: Settings, Language, Privacy, Security, About, Logout

Existing operational modules are reused instead of duplicated: `DocumentsView`, `MyPointsView`, `BuyPointsView`, `MessagesView`, `NotificationView`, `SupportChatView`, and active ride screens.

## Profile Architecture

Flutter reads the authenticated driver from `GET /api/driver/get-driver-details/:id`. The backend still authorizes access with the authenticated token; non-admin drivers can only read/update themselves.

Personal profile edits use `POST /api/driver/update-personal-details`. For drivers, verified/profile-sensitive changes enter the existing admin review workflow through `DriverLogs` and `profileRequestStatus`; the app does not silently overwrite verified identity data.

Profile photo upload uses the same endpoint with `profileImage`.

## Vehicle Logic

Vehicle data comes from the existing `Driver` model:

- `vehicleType`
- `vehicleModel`
- `registration`
- `city`
- `licenseCompany`
- `status`
- `profileRequestStatus`

The UI displays unavailable fields as unavailable rather than inventing brand/year/color values that the backend does not currently store.

## Documents Lifecycle

The driver documents module remains `DocumentsView` and `DocumentsController`. It uses the existing required document set:

- Car license front
- Driver license front
- ID proof front
- Profile image
- Passport copy

Back-side scans and company-license documents remain supported as supplemental uploads. Pending profile updates are sourced from `DriverLogs`, and rejection reasons are read from `rejectionReason` / `profileRejectionReason`.

Document expiry dates are not currently modeled in `Driver` or `DriverLogs`; expiry alerts can only become backend-driven after expiry fields are added per document type.

## Online / Offline Logic

Driver Home remains the only online/offline control. Backend validation is authoritative in `POST /api/driver/update-online-status`:

- completed/approved driver required
- restricted/deleted drivers blocked
- fresh valid GPS required for discoverability
- active ride switches availability to Busy
- server presence session and heartbeat control runtime status

Logout now calls `DriverOnlineService.goOfflineForLogout()`, which posts `isOnline: false` with the stored presence session when available, stops foreground heartbeats, clears push/socket state, and then clears local credentials.

## Ride History

Ride history uses `GET /api/rides/mine?status=all`. Backend participant authorization derives the driver from the token through `resolvePrincipal`; the client does not send trusted driver IDs.

Driver ride rows show date/status context, passenger, route, ride value, and deep link to ride details.

## Earnings / Activity

The Earnings / Activity screen shows only metrics derivable from real ride history:

- completed rides
- active rides
- cancelled rides
- completed ride value

Driver payout logic is intentionally not invented. If Drewel later stores payout/commission fields, this screen should be extended from backend-calculated values.

## Points System

Points remain server-authoritative through the existing points module:

- `GET /api/driver/points/wallet`
- `GET /api/driver/points/transactions`
- `GET /api/driver/points/packs`
- `POST /api/driver/points/purchase-requests`

The profile hub reads the existing `DriverPointsController`; it does not calculate balance locally.

## Communication

Messages use ride-scoped conversations and the existing `MessagesView`. Calls use `GET /api/calls`, which returns only calls where the authenticated driver is caller or receiver. Phone numbers are not exposed in call history.

Notifications use the existing notification center and unread/read APIs.

## Support

Driver support reports use `POST /api/account/support-reports`. The backend account controller now allows both passenger and driver principals for preferences, legal content, and support reports, while saved places remain passenger-only.

Supported report categories now include driver-relevant categories: passenger, safety, pickup, points, document, technical, account, ride, app, and other.

## Settings

Driver settings are preference-focused:

- language
- notification preferences
- privacy/legal content
- security placeholder for backend-supported controls
- app information

Language uses the existing `UserPreference` storage and supports `en` and `ar`.

## Security Rules

Backend security remains token-derived:

- driver details use `canAccessDriver`
- rides/messages/calls use `resolvePrincipal` and `assertRideParticipant`
- points use authenticated driver endpoints
- support reports derive `userId` and `actorRole` from the token
- frontend `driverId` is not trusted for protected account data

Admin-only actions remain in admin routes.

## Feature Audit

| Feature | Status | Implementation |
| --- | --- | --- |
| Driver Profile | Added | `/driver/profile`, real driver details |
| Personal Information | Improved | `/driver/profile/edit`, submitted to driver update workflow |
| Vehicle Profile | Added | `/driver/vehicle`, real Driver model fields |
| Documents | Existing | Reused `DocumentsView` |
| Document Status | Existing / improved path | existing pending/rejected/approved fields surfaced |
| Expiry Alerts | Backend missing | expiry fields not modeled yet |
| Online / Offline | Existing / fixed logout | Driver Home + offline-on-logout |
| Ride History | Added | `/driver/rides/history`, real `rides/mine` |
| Earnings / Activity | Added | real ride-derived metrics only |
| Points Balance | Existing | reused points module |
| Points Transactions | Existing | reused points module |
| Buy / Recharge Points | Existing | backend point packs and purchase requests |
| Messages / All Chats | Existing | reused ride-linked inbox |
| Notifications | Existing | reused notification center |
| Call History | Added | `/driver/calls`, real `GET /calls` |
| Ratings / Reviews | Partial support | rating displayed only if backend provides it |
| Performance Statistics | Added | real ride-derived metrics |
| Support | Improved | driver-safe support hub and reports |
| Report Passenger / Problem | Added | structured report flow |
| Settings | Added | driver settings hub |
| Language | Added | existing i18n preference endpoint |
| Privacy | Added | backend legal content endpoint |
| Security | Limited | no unsupported controls invented |
| Logout | Fixed | backend offline + push/socket cleanup |
