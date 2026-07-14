class AppConfig {
  // Inject with: flutter run --dart-define=GOOGLE_MAPS_API_KEY=xxx
  static const String googleMapsApiKey =
      String.fromEnvironment('GOOGLE_MAPS_API_KEY', defaultValue: 'AIzaSyANiWgr3u86BpMVKFGD50GpoZ2u5u4aDbk');
}
