import 'package:get/get.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../app/data/apis/api_constants/api_key_constants.dart';
import '../app/routes/app_pages.dart';
import 'common_widgets.dart';

class AuthSessionManager {
  AuthSessionManager._();

  static bool _isHandlingExpiredSession = false;

  static Future<bool> hasStoredSession() async {
    final SharedPreferences preferences = await SharedPreferences.getInstance();
    final String userId =
        preferences.getString(ApiKeyConstants.userId)?.trim() ?? '';
    final String token =
        preferences.getString(ApiKeyConstants.token)?.trim() ?? '';
    return userId.isNotEmpty && token.isNotEmpty;
  }

  static Future<void> clearExpiredSession({
    bool showMessage = true,
  }) async {
    if (_isHandlingExpiredSession) return;
    _isHandlingExpiredSession = true;
    try {
      final SharedPreferences preferences =
          await SharedPreferences.getInstance();
      await preferences.clear();

      if (Get.currentRoute != Routes.USER_TYPE) {
        await Get.offAllNamed(Routes.USER_TYPE);
      }

      if (showMessage && Get.context != null) {
        CommonWidgets.snackBarView(
          title: 'Your session expired. Please sign in again.',
        );
      }
    } finally {
      _isHandlingExpiredSession = false;
    }
  }
}
