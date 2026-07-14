class ApiUrlConstants {
  static const String _defaultApiBaseUrl = 'https://admin-dreewel.com/api/';
  static const String _defaultSocketUrl = 'https://admin-dreewel.com';

  static const String _configuredApiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: _defaultApiBaseUrl,
  );
  static const String _configuredSocketUrl = String.fromEnvironment(
    'SOCKET_URL',
    defaultValue: _defaultSocketUrl,
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

  static String get baseUrl => _withTrailingSlash(_configuredApiBaseUrl);
  static String get socketUrl => _withoutTrailingSlash(_configuredSocketUrl);
  static String get baseUrlForGetMethodParams =>
      Uri.parse(baseUrl).authority;

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
  static String get endPointOfDriverDetails =>
      '${baseUrl}driver/get-driver-details';
  static String get endPointOfUserDetails =>
      '${baseUrl}users/get-user-details';
  static String get endPointOfAllDrivers => '${baseUrl}driver/all-drivers';
  static String get endPointOfAvailableDrivers =>
      '${baseUrl}driver/available';
  static String get endPointOfGetBanner => '${baseUrl}banner/get-all';

  // Delete account endpoints
  static String get endPointOfDeleteUser => '${baseUrl}users';
  static String get endPointOfDeleteDriver => '${baseUrl}driver';
}
