# Drewel Architecture

Last updated: 2026-08-15

## Applications

- Flutter passenger/driver app: `lib/`, with GetX routes in `lib/app/routes/app_pages.dart`.
- React/Vite admin portal: `drewel-admin-panel/`, authenticated by `AuthContext` and protected routes.
- Express/MongoDB API: `drewel-backend/`, with routes under `src/routes`, controllers under `src/controllers`, domain services under `src/services`, and Mongoose models under `src/models`.
- Figma admin reference: `Drewel  Admin Dashboard/`. It is a React/TypeScript mock-backed design source only.

## Backend Domains

- Auth: user, driver WhatsApp OTP, and admin JWT login in `userRoutes`, `driverRoutes`, and `adminRoute`.
- Driver marketplace: `driverController`, `availableDrivers.js`, `driverPresenceService.js`, and Socket.IO driver presence/location.
- Ride lifecycle: `Ride`, `rideController`, `rideTransitionService`, `adminRideController`, and `RideAudit`.
- Trip offers and points: `TripOffer`, `tripOfferService`, `DriverPointsWallet`, `PointTransaction`, `PointPurchaseRequest`, `PointsSettings`, and admin points routes.
- Verification: `Driver`, `Driverlogs`, `adminRequestController`, and `RequestAudit`.
- Communication: ride messages, conversation threads, secure call sessions, Agora token boundary, and admin call listing.
- Notifications: `Notification`, `notificationService`, device token routes, and mobile notification repositories.
- Content: sponsor banners in `Banner` and `bannerRoute`.

## Realtime

Socket.IO is initialized in `drewel-backend/src/socket/index.js`. Admin connects through `drewel-admin-panel/src/context/SocketContext.jsx`; Flutter connects through `lib/common/socket_services.dart` and domain controllers.

## Deployment

The documented production shape is backend under `/api`, React admin at `/`, and Flutter web under `/app/`. Build artifacts are not committed. Production validation requires real server authority and authenticated checks; local builds do not prove deployment.
