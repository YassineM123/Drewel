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

    final String path = normalizedDrewelDeepLinkPath(uri);
    final Map<String, String> query = uri.queryParameters;
    // Ride chat endpoints are keyed by Ride._id, but accept conversationId
    // for backward compatibility with older push payloads.
    final String rideId = (query['rideId'] ?? query['conversationId'] ?? '').trim();

    debugPrint('Deep link: $path${rideId.isNotEmpty ? '?rideId=$rideId' : ''}');

    switch (path) {
      case '/notifications':
        await Get.toNamed(Routes.NOTIFICATIONS);
        return;
      case '/driver/ride-request':
      case '/ride-request':
        if (isDriver) {
          await Get.offAllNamed(Routes.DRIVER_HOME);
        } else {
          await Get.toNamed(Routes.NOTIFICATIONS);
        }
        return;
      case '/passenger/active-ride':
      case '/driver/active-ride':
      case '/active-ride':
      case '/passenger/ride-summary':
      case '/ride-summary':
        await Get.toNamed(Routes.ACTIVE_RIDE);
        return;
      case '/chat':
      case '/chat/ride':
        if (rideId.isEmpty) {
          await Get.toNamed(Routes.MESSAGES);
        } else {
          await Get.toNamed(Routes.RIDE_CHAT,
              arguments: <String, dynamic>{'rideId': rideId});
        }
        return;
      case '/messages':
        await Get.toNamed(Routes.MESSAGES);
        return;
      case '/documents':
      case '/driver/status':
      case '/status':
        if (isDriver) {
          await Get.toNamed(Routes.DRIVER_REGISTER);
        } else {
          await Get.toNamed(Routes.NOTIFICATIONS);
        }
        return;
      case '/driver/points':
      case '/points':
        if (isDriver) {
          await Get.toNamed(Routes.MY_POINTS);
        } else {
          await Get.toNamed(Routes.NOTIFICATIONS);
        }
        return;
      case '/rides':
        await Get.toNamed(isDriver ? Routes.DRIVER_HOME : Routes.USER_HOME);
        return;
      case '/driver/rides':
        await Get.toNamed(
          isDriver ? Routes.DRIVER_RIDE_HISTORY : Routes.NOTIFICATIONS,
        );
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

/// Custom-scheme links such as `drewel://chat/ride` encode `chat` as the URI
/// host and `/ride` as the path. The app routes use the combined `/chat/ride`
/// form. Triple-slash links (`drewel:///chat/ride`) already have no host, so
/// this also keeps them compatible.
@visibleForTesting
String normalizedDrewelDeepLinkPath(Uri uri) {
  final String path = uri.path.isEmpty
      ? ''
      : (uri.path.startsWith('/') ? uri.path : '/${uri.path}');
  final String host = uri.host.trim();
  if (host.isEmpty) return path.isEmpty ? '/' : path;
  return '/$host$path';
}
