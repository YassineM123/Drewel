import 'package:shared_preferences/shared_preferences.dart';

import '../app/data/apis/api_constants/api_key_constants.dart';

class AuthenticatedImageUrl {
  AuthenticatedImageUrl._();

  static String? _cachedToken;

  static Future<String> _token() async {
    if (_cachedToken != null) return _cachedToken!;
    final SharedPreferences preferences = await SharedPreferences.getInstance();
    _cachedToken = preferences.getString(ApiKeyConstants.token)?.trim() ?? '';
    return _cachedToken!;
  }

  static Future<String> withToken(String url) async {
    final String trimmed = url.trim();
    if (trimmed.isEmpty) return url;
    final Uri? uri = Uri.tryParse(trimmed);
    if (uri == null ||
        !(uri.scheme == 'http' || uri.scheme == 'https') ||
        !trimmed.contains('/users/get-image/')) {
      return url;
    }
    if (uri.queryParameters.containsKey('token')) return url;
    final String token = await _token();
    if (token.isEmpty) return url;
    return uri
        .replace(queryParameters: <String, String>{
          ...uri.queryParameters,
          'token': token,
        })
        .toString();
  }
}
