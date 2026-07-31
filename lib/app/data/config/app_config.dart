class AppConfig {
  // Legacy Places lookup only. Never add a default secret here. Map display
  // keys belong in the native Android/iOS build configuration.
  static const String googleMapsApiKey = String.fromEnvironment(
    'GOOGLE_PLACES_CLIENT_API_KEY',
    defaultValue: '',
  );
}
