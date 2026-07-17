# Drewel

Drewel is a Flutter-based application with a companion admin panel and Node.js backend.

## Repository Layout

- `lib/` - Flutter app source code
- `android/`, `ios/`, `web/`, `windows/`, `linux/`, `macos/` - platform targets
- `drewel-admin-panel/` - Vite-based admin dashboard
- `drewel-backend/` - Express/MongoDB backend and utility scripts
- `assets/` - shared images, icons, and fonts

## Requirements

- Flutter SDK
- Node.js and npm
- A connected device, emulator, or browser for Flutter run targets

## Flutter App

From the repository root:

```bash
flutter pub get
flutter run
```

To build a release artifact, use the standard Flutter build command for your target platform, for example:

```bash
flutter build apk
```

## Admin Panel

From `drewel-admin-panel/`:

```bash
npm install
npm run dev
```

Available scripts:

- `npm run build`
- `npm run lint`
- `npm run preview`

## Backend

From `drewel-backend/`:

```bash
npm install
npm run start
```

Available scripts include:

- `npm run test`
- `npm run start:prod`
- `npm run backfill:driver-status`
- `npm run repair:admin-role`
- `npm run audit:image-assets`
- `npm run whatsapp:diagnose`
- `npm run whatsapp:otp-example`

## Notes

- The app title is set to `Drewel` in `lib/main.dart`.
- If you add environment variables or deployment steps, document them here so the setup stays current.
