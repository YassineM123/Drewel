import 'package:flutter/foundation.dart';
import 'package:get/get.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../app/data/apis/api_constants/api_key_constants.dart';
import '../app/routes/app_pages.dart';

/// Parses `drewel://...` deep links (from push taps and realtime events) and
/// navigates to the matching screen. Unknown or unavailable destinations fall
/// back to the notifications center so a tap is never a dead end.
class DeepLinkService {
  DeepLinkService._();

  static final DeepLinkService instance = DeepLinkService._();

  Future<void> handle(String? raw) async {
    if (raw == null || raw.isEmpty) return;
    final Uri? uri = Uri.tryParse(raw);
    if (uri == null || uri.scheme.toLowerCase() != 'drewel') return;

    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final String role = prefs.getString(ApiKeyConstants.type) ?? 'user';
    final bool isDriver = role == ApiKeyConstants.driver;

    final String path = uri.path;
    final Map<String, String> query = uri.queryParameters;
    final String rideId =
        (query['rideId'] ?? query['conversationId'] ?? '').trim();

    debugPrint('Deep link: $path${rideId.isNotEmpty ? '?rideId=$rideId' : ''}');

    switch (path) {
      case '/notifications':
        await Get.toNamed(Routes.NOTIFICATIONS);
        return;
      case '/driver/ride-request':
        if (isDriver) {
          await Get.offAllNamed(Routes.DRIVER_HOME);
        } else {
          await Get.toNamed(Routes.NOTIFICATIONS);
        }
        return;
      case '/passenger/active-ride':
      case '/driver/active-ride':
      case '/ride-summary':
        await Get.toNamed(Routes.ACTIVE_RIDE);
        return;
      case '/chat/ride':
        if (rideId.isEmpty) {
          await Get.toNamed(Routes.MESSAGES);
        } else {
          await Get.toNamed(Routes.RIDE_CHAT,
              arguments: <String, dynamic>{'rideId': rideId});
        }
        return;
      case '/call/active':
        await Get.toNamed(Routes.ACTIVE_RIDE);
        return;
      case '/documents':
      case '/driver/status':
        if (isDriver) {
          await Get.toNamed(Routes.DRIVER_REGISTER);
        } else {
          await Get.toNamed(Routes.NOTIFICATIONS);
        }
        return;
      case '/driver/points':
        if (isDriver) {
          await Get.toNamed(Routes.MY_POINTS);
        } else {
          await Get.toNamed(Routes.NOTIFICATIONS);
        }
        return;
      case '/rides':
        await Get.toNamed(isDriver ? Routes.DRIVER_HOME : Routes.USER_HOME);
        return;
      case '/support':
        await Get.toNamed(Routes.SUPPORT);
        return;
      default:
        await Get.toNamed(Routes.NOTIFICATIONS);
        return;
    }
  }
}
