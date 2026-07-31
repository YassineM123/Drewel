# Drewel

Drewel is a Flutter user/driver application backed by Node.js, Express,
MongoDB and Socket.IO, with a Vite/React operations panel.

## Repository layout

- `lib/` — Flutter user and driver application
- `drewel-backend/` — authenticated API, ride lifecycle, points and realtime services
- `drewel-admin-panel/` — protected operations panel
- `test/` and `drewel-backend/test/` — mobile and backend tests

## Local development

Install Flutter dependencies from the repository root:

```bash
flutter pub get
```

Start the backend:

```bash
cd drewel-backend
npm ci
copy .env.example .env
npm start
```

Start the admin panel in a second terminal:

```bash
cd drewel-admin-panel
npm ci
copy .env.example .env
npm run dev
```

Never copy real credentials into an example file or commit `.env`, signing
keys, private keys, cloud access-key exports, generated builds, or deployment
archives.

## Required configuration

Backend configuration is documented in `drewel-backend/.env.example`. Ride
navigation requires `GOOGLE_ROUTES_API_KEY` on the backend. The key must never
be shipped in Flutter or the admin JavaScript bundle.

The mobile Google Maps display keys are separate client keys:

- Android: inject `GOOGLE_MAPS_ANDROID_API_KEY` into `android/local.properties`
  or the build environment. It supplies only the native Maps SDK placeholder.
- iOS: inject `GOOGLE_MAPS_IOS_API_KEY` through an untracked
  `ios/Flutter/Secrets.xcconfig` or CI-generated xcconfig supplying
  `GOOGLE_MAPS_IOS_API_KEY`.

Do not reuse the Routes key for map display.

## Google Cloud Console setup

Create separate keys and apply all available restrictions:

1. Enable Maps SDK for Android, Maps SDK for iOS, and Routes API.
2. Restrict the Android key by package name and SHA-1 signing certificate;
   allow only Maps SDK for Android.
3. Restrict the iOS key by bundle identifier; allow only Maps SDK for iOS.
4. Restrict the server key to Routes API and, where the deployment topology
   supports it, backend egress IP addresses.
5. Configure billing quotas and alerts. Rotate any key that was previously
   committed or shared without the correct restrictions.

## Verification

Run all gates before release:

```bash
flutter analyze
flutter test

cd drewel-backend
npm test

cd ../drewel-admin-panel
npm run lint
npm test
npm run build
```

The backend points and concurrency suite requires a disposable MongoDB
replica-set test database. Configure `MONGO_URI` and a non-empty
`POINTS_INTEGRATION_TEST_DB`; a run with skipped integration tests is not a
release pass. Never point integration tests at production.

## Production notes

- Deploy the backend with `NODE_ENV=production`, a long random `JWT_SECRET`,
  an explicit `ALLOWED_ORIGINS` list, and `ALLOW_START_WITHOUT_DB=false`.
- Set `TRUST_PROXY_HOPS` only to the known proxy count. Rate limiting relies on
  correct client-IP handling.
- Use a shared rate-limit store when running multiple backend instances.
- MongoDB transactions and the unique active-ride indexes require replica-set
  support.
- Before the first lifecycle rollout, back up the database and run
  `npm run backfill:active-ride-locks` from `drewel-backend/`. The command
  aborts if duplicate active rides need manual resolution, then reconciles
  account locks and synchronizes the unique indexes.
- Build the admin panel once and deploy the complete `dist/` directory as one
  immutable release. Do not commit generated `dist/`.
- Admin ride actions are authenticated, authorized, idempotent, and audited by
  the backend. The panel is never the source of truth for state or balances.
- Run secret scanning and dependency auditing in CI. Treat signing material,
  private keys, cloud credentials and database URLs as secrets.

## Admin ride operations

The operations panel exposes active, completed, cancelled and disputed ride
views. Ride details include participants, lifecycle state, pickup/destination,
route freshness, points evidence and audit history. Cancellation, dispute
resolution, controlled unlock and technical point refunds require an explicit
reason and an idempotency key; the backend must reject invalid transitions.

## Online hosting

The repository now includes deployment assets for hosting the backend and admin
panel in the cloud:

- [render.yaml](render.yaml) provisions a Node.js backend service and a static
  admin-panel build for Render.
- [drewel-backend/Dockerfile](drewel-backend/Dockerfile) and
  [drewel-admin-panel/Dockerfile](drewel-admin-panel/Dockerfile) make the app
  portable to other container-based hosts.

Required production environment variables:

- Backend: `MONGO_URI`, `JWT_SECRET`, `ALLOWED_ORIGINS`, `PUBLIC_API_URL`,
  `TRUST_PROXY_HOPS=1`, `NODE_ENV=production`
- Admin panel: `VITE_API_URL`, `VITE_SOCKET_URL`, and `VITE_LEGACY_API_URL`

The backend will listen on `0.0.0.0` by default so it can be reached from a
container or cloud load balancer.
