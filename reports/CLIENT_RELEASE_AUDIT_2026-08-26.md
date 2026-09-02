# Drewel client release audit — 2026-08-26

## Outcome

The Flutter, Express, and React release checks pass. The backend, React admin,
and Flutter web bundles were deployed to the AWS/Nginx production host on
2026-08-27. The Android release APK is available under `release-artifacts/`.
No Android device was connected for authenticated passenger/driver end-to-end
testing.

## Fixed in this audit

- Corrected custom-scheme deep-link parsing so links such as
  `drewel://chat/ride?rideId=...` open the intended route.
- Corrected ride-message notification payloads to use the canonical ride ID
  instead of a conversation document ID.
- Added the missing driver ride-history and passenger ride-summary deep links.
- Required authentication and ownership/participation checks for legacy
  expense, friend-list, group, and device-token administration endpoints.
- Removed active call/Agora runtime, admin call routes/pages, call health checks,
  call settings, and Android telephone intent visibility; historical call-log
  records remain schema-compatible.
- Repaired admin notification cancellation/search/toast behavior and normalized
  the roles permission response.
- Patched the admin React Router, Socket.IO parser, PostCSS, and NanoID dependency
  advisories; patched backend Socket.IO parser and IP address dependencies.
- Removed generated Android build output from the Git index and confirmed no
  tracked files match the audited private-key/cloud-key patterns.

## Verification

- Backend after hotfix: 204 tests, 183 passed, 21 explicitly skipped, 0 failed.
- Flutter: 87 tests passed; changed-file analysis reports no issues.
- Full Flutter analysis: no errors; 213 existing warning/info diagnostics.
- Android: universal and split-per-ABI release APKs built successfully.
- ARM64 APK: Android APK Signature Scheme v2 verification passed.
- Admin: 17 test files / 60 tests passed; production build passed; lint has
  0 errors and 213 existing warnings; production dependency audit is clean.
- Public smoke after production deploy: root admin 200, admin JS/CSS assets 200,
  Flutter `/app/` 200, Flutter bootstrap/main/manifest assets 200, API health
  200, protected admin endpoint 401 without a token, Socket.IO handshake 200.
- Diff whitespace checks passed.

## Artifacts and SHA-256

- `release-artifacts/Drewel-android-arm64-release-2026-08-26.apk`
  - `185D473311295C59FB8D11F6F56D863CAD63CA7E134820D79B4E99846C96DC71`
- `release-artifacts/Drewel-admin-dist-release-2026-08-26.tar.gz`
  - `EE73196AF523EE175251AA0415EEB05370150BEC1BD1BF91C4C99632A2278D29`
- `release-artifacts/Drewel-backend-20260827T125634Z.tar.gz`
  - `6D2712CD6BDE8138FE6CF66E3DC9CFA8BD169A694B2C8F57EDA4D0A7D90A3DFF`
- `release-artifacts/Drewel-admin-20260827T125634Z.tar.gz`
  - `7A42F22360763ADD19E49CEF542B7C088DE935842FB7993DF6D17EB1914DC9E9`
- `release-artifacts/Drewel-flutter-web-20260827T125634Z.tar.gz`
  - `2921EA82C9A39695D07EFBF993F8474FAEA2AB5B173665576FAF5EA90268397C`
- `release-artifacts/Drewel-backend-hotfix-20260827T143525Z.tar.gz`
  - `7EE771965AE414AC18D2771EE7F3E981EAC32199B55AED175A7EE8AB0A290966`

## Production deployment evidence

- Host: `admin-dreewel.com` / `100.24.178.122`.
- Backend path: `/var/www/drewel/drewel-backend`; PM2 process `backend-api`.
- React admin path: `/var/www/drewel/drewel-admin-panel/dist`; PM2 process
  `frontend-admin`.
- Flutter web path: `/var/www/drewel/drewel-flutter-web-root/app`.
- Full deployment backup: `/var/www/drewel/deploy-backups/release-20260827T125634Z`.
- Backend hotfix backup:
  `/var/www/drewel/deploy-backups/backend-hotfix-20260827T143525Z`.
- Nginx validation passed after deployment and after the backend hotfix.
- PM2 process list was saved after restart.
- Backend hotfix: passenger details now returns `recentCalls: []` instead of
  throwing `ReferenceError: recentCalls is not defined`.

## Remaining release boundaries

- No device was connected, so APK install/startup and authenticated passenger ↔
  driver ride/chat/notification flows were not executed.
- Authenticated admin browser E2E was not counted as complete because no current
  real admin login session/password was available. Public and internal health
  checks passed.
- The production image-asset audit connected to MongoDB but returned
  `UnknownError`; this remains a storage/data-audit follow-up and did not block
  process health or public route verification.
- Backend `npm audit --omit=dev` still reports eight moderate advisories in the
  Firebase Admin transitive dependency chain. The available Firebase Admin
  upgrade requires Node.js 22+, so production Node must be confirmed first.
- Flutter full analysis and admin lint still contain legacy non-error warnings.
- The admin bundle is large and should be code-split as a performance follow-up.
- Production Google/Firebase/AWS credentials should be restricted and rotated
  according to the client's operational security process before handoff.
