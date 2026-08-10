import 'package:flutter/foundation.dart';

bool shouldPreferOpenStreetMap({
  required bool isWeb,
  required bool googleWebMapEnabled,
  required String googleWebApiKey,
}) =>
    isWeb && (!googleWebMapEnabled || googleWebApiKey.trim().isEmpty);

class AppConfig {
  // Legacy Places lookup only. Never add a default secret here. Map display
  // keys belong in the native Android/iOS build configuration.
  static const String googleMapsApiKey = String.fromEnvironment(
    'GOOGLE_PLACES_CLIENT_API_KEY',
    defaultValue: '',
  );

  // QA builds can use real Tunisian GPS only when the backend has also enabled
  // its server-side test gate. Normal production builds remain UAE-only.
  static const bool tunisiaTestMode = bool.fromEnvironment(
    'DREWEL_TUNISIA_TEST_MODE',
    defaultValue: false,
  );

  static const String marketplaceCountryCode = tunisiaTestMode ? 'tn' : 'ae';
  static const String marketplaceRegionLabel =
      tunisiaTestMode ? 'Tunisia' : 'the UAE';

  static const bool enableGoogleWebMap = bool.fromEnvironment(
    'DREWEL_ENABLE_GOOGLE_WEB_MAP',
    defaultValue: false,
  );
  static final bool useOpenStreetMapOnWeb = shouldPreferOpenStreetMap(
    isWeb: kIsWeb,
    googleWebMapEnabled: enableGoogleWebMap,
    googleWebApiKey: googleMapsApiKey,
  );
}

bool isMarketplaceServiceAreaAllowed(
  String? serviceArea, {
  bool tunisiaTestMode = AppConfig.tunisiaTestMode,
}) {
  final String normalized =
      (serviceArea ?? '').trim().toLowerCase().replaceAll(RegExp(r'\s+'), ' ');
  if (tunisiaTestMode) return normalized == 'tunisia-test';
  return normalized == 'uae' || normalized == 'dubai';
}
