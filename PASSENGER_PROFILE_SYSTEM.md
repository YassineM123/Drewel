# Drewel Passenger Profile System

## Scope

The passenger account area is a single coherent profile space, not a set of duplicate feature pages. It is routed from `Routes.PASSENGER_PROFILE` and groups passenger functions into Personal, Communication, Preferences, Support, Legal, and Logout.

## Screens

- `PassengerProfileView`: account hub with identity, verified contact indicator, grouped navigation, and logout.
- `EditProfileView`: profile photo, full name, phone, and email editing with loading, validation, and backend errors.
- `SavedPlacesView`: Home, Work, and favorite saved places with address plus coordinates.
- `RideHistoryView`: all/completed/cancelled passenger ride history from `/api/rides/mine`.
- `RideDetailsView`: ride reference, status, pickup, destination, driver, vehicle, fare, and support actions.
- Existing `ActiveRideView`: remains the current ride recovery UI backed by `/api/rides/active`.
- Existing `MessagesView`: ride-linked conversations from `/api/conversations`.
- Existing `NotificationView`: real notifications from `/api/notification/get-notifications`.
- `CallHistoryView`: ride communication calls from `/api/calls`.
- `LanguageSettingsView`: English/Arabic preference persisted locally and to backend.
- `NotificationPreferencesView`: user notification preferences; ride updates and calls are kept mandatory.
- `LegalView`: Privacy and Terms content loaded from backend configuration.
- `HelpSupportView`: support hub with Drewel-relevant issue categories and support chat.
- `ReportProblemView`: structured report flow with category, optional ride, and description.
- `AboutDrewelView`: logo, minimal Drewel information, version/build from package metadata, and legal/support links.

## Navigation

Routes are defined in `lib/app/routes/app_routes.dart` and registered in `lib/app/routes/app_pages.dart`.

Passenger drawer entry:

- Drawer `Profile` opens `Routes.PASSENGER_PROFILE`.
- Existing support, messages, notifications, active ride, and ride chat routes are reused.

## Models

Flutter:

- `PassengerProfileModel`
- `SavedPlaceModel`
- `PassengerPreferenceModel`
- `NotificationPreferenceModel`
- `PassengerCallModel`
- `LegalContentModel`

Backend:

- `SavedPlace`: passenger-owned saved locations with type `home`, `work`, or `favorite`.
- `UserPreference`: language and notification preferences.
- `SupportReport`: passenger issue reports with optional ride link.
- Existing `User`, `Ride`, `RideConversation`, `RideMessage`, `CallSession`, and `Notification` remain the source of truth for their domains.

## APIs

Profile:

- `GET /api/users/get-user`
- `POST /api/users/update-profile`
- `POST /api/users/add-profile-picture`

Saved places:

- `GET /api/account/saved-places`
- `POST /api/account/saved-places`
- `PUT/PATCH /api/account/saved-places/:placeId`
- `DELETE /api/account/saved-places/:placeId`

Preferences:

- `GET /api/account/preferences`
- `PATCH /api/account/preferences`

Rides and communication:

- `GET /api/rides/active`
- `GET /api/rides/mine?status=all`
- `GET /api/rides/:rideId`
- `GET /api/conversations`
- `GET /api/notification/get-notifications`
- `GET /api/calls`

Support and legal:

- `POST /api/account/support-reports`
- `GET /api/account/legal/privacy`
- `GET /api/account/legal/terms`

## State Management

`PassengerAccountController` owns account-level state:

- profile
- saved places
- ride history
- call history
- preferences
- legal content
- loading/saving/error state

It reuses `CommunicationBinding` for existing ride, chat, call, and notification services. It does not create a parallel communication system.

## Saved Places Logic

Home and Work are unique per passenger on the backend. Favorites are separate records. Every saved place stores:

- name
- address
- latitude
- longitude
- optional category

The UI currently accepts explicit coordinates. Booking/search integration can reuse these records as destination inputs without adding another saved-place model.

## Ride History

History uses `/api/rides/mine?status=all`, scoped from the authenticated token. Active rides and terminal rides are separated in UI filters. Completed and cancelled states are derived from the existing ride status model.

## Notifications

Notification center reuses the existing server-backed notification repository and `CallStateController`. Account preferences are stored in `UserPreference`; mandatory ride/call safety notifications remain enabled in the UI and backend update logic.

## Communication

Messages remain ride-linked conversations. Call history uses existing `CallSession` records and returns only participant display metadata. No private phone numbers or audio recordings are exposed.

## Settings

Language supports the app's existing `en` and `ar` locales. The selected language is persisted to backend preferences and local storage before `GetMaterialApp` initializes on restart.

## Support

Report submissions are passenger-owned `SupportReport` records. If a ride is selected, the backend verifies the authenticated passenger is a participant before linking the report.

## Security Rules

- Backend account routes use `requireSignIn`.
- Passenger account routes resolve the principal from the authenticated token.
- User IDs from the frontend are not trusted for saved places, preferences, reports, calls, or ride history.
- Ride-linked reports call `assertRideParticipant`.
- Call history filters by authenticated caller/receiver only.
- Saved places are queried and modified by `{ userId: principal.id }`.
- Legal content can be served after authentication; official body content must come from backend configuration.

## Current Limitations

- Official legal text is not invented. The backend returns empty legal bodies until `PRIVACY_CONTENT` and `TERMS_CONTENT` are configured.
- Saved-place selection does not yet open the existing map/search picker directly; the records are real and coordinate-backed, ready for booking/search reuse.
- Phone change OTP enforcement is server-dependent. The client validates and submits changes; the backend currently validates uniqueness and format.
