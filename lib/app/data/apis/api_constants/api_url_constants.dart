class ApiUrlConstants {
  static String _defaultApiBaseUrl() {
    return 'https://admin-dreewel.com/api/';
  }

  static String _defaultSocketUrl() {
    return 'https://admin-dreewel.com';
  }

  static const String supportAdminId = String.fromEnvironment(
    'SUPPORT_ADMIN_ID',
    defaultValue: '6861224ceac0edaf19ffa056',
  );

  static const String _configuredApiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: '',
  );
  static const String _configuredSocketUrl = String.fromEnvironment(
    'SOCKET_URL',
    defaultValue: '',
  );

  static String _withTrailingSlash(String value) {
    final trimmed = value.trim();
    return trimmed.endsWith('/') ? trimmed : '$trimmed/';
  }

  static String _withoutTrailingSlash(String value) {
    final trimmed = value.trim();
    return trimmed.endsWith('/')
        ? trimmed.substring(0, trimmed.length - 1)
        : trimmed;
  }

  static String get baseUrl => _withTrailingSlash(
        _configuredApiBaseUrl.isNotEmpty
            ? _configuredApiBaseUrl
            : _defaultApiBaseUrl(),
      );
  static String get socketUrl => _withoutTrailingSlash(
        _configuredSocketUrl.isNotEmpty
            ? _configuredSocketUrl
            : _defaultSocketUrl(),
      );
  static String get baseUrlForGetMethodParams => Uri.parse(baseUrl).authority;

  static String get endPointOfLogin => '${baseUrl}users/login';
  static String get endPointOfOtpVerify => '${baseUrl}users/verify-otp';
  static String get endPointOfSendOtpWhatsapp =>
      '${baseUrl}users/send-otp-whatsapp';
  static String get endPointOfVerifyOtpWhatsapp =>
      '${baseUrl}users/verify-otp-whatsapp';
  static String get endPointOfDriverAddPersonalDetails =>
      '${baseUrl}driver/add-personal-details';
  static String get endPointOfDriverRequest => '${baseUrl}driver/request';
  static String get endPointOfDriverBase => '${baseUrl}driver';
  static String get endPointOfDriverUpdatePersonalDetails =>
      '${baseUrl}driver/update-personal-details';
  static String get endPointOfGetProfile => '${baseUrl}get-profile';
  static String get endPointOfUpdateProfile => '${baseUrl}update-profile';
  static String get endPointOfDriverUpdateLocation =>
      '${baseUrl}driver/update-location';
  static String get endPointOfDriverUpdateOnlineStatus =>
      '${baseUrl}driver/update-online-status';
  static String get endPointOfDriverPresenceHeartbeat =>
      '${baseUrl}driver/presence/heartbeat';
  static String get endPointOfDriverDetails =>
      '${baseUrl}driver/get-driver-details';
  static String get endPointOfUserDetails => '${baseUrl}users/get-user-details';
  static String get endPointOfAllDrivers => '${baseUrl}driver/all-drivers';
  static String get endPointOfAvailableDrivers => '${baseUrl}driver/available';
  static String get endPointOfGetBanner => '${baseUrl}banner/get-all';

  static String get endPointOfActiveRide => '${baseUrl}rides/active';
  static String rideMessages(String rideId) =>
      '${baseUrl}rides/$rideId/messages';
  static String conversations(String suffix) => '${baseUrl}conversations$suffix';
  static String get endPointOfNotifications =>
      '${baseUrl}notification/get-notifications';
  static String markNotificationAsRead(String notificationId) =>
      '${baseUrl}notification/mark-as-read/$notificationId';
  static String get endPointOfNotificationUnreadCount =>
      '${baseUrl}notification/unread-count';
  static String get endPointOfMarkAllNotificationsRead =>
      '${baseUrl}notification/mark-all-as-read';

  // Device push-token lifecycle (FCM).
  static String get endPointOfRegisterDeviceToken =>
      '${baseUrl}device-tokens/register';
  static String get endPointOfUnregisterDeviceToken =>
      '${baseUrl}device-tokens/unregister';

  // Delete account endpoints
  static String get endPointOfDeleteUser => '${baseUrl}users';
  static String get endPointOfDeleteDriver => '${baseUrl}driver';
}
