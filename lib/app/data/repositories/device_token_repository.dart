import 'dart:io';
import 'dart:math';

import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../apis/api_constants/api_url_constants.dart';
import '../apis/communication_api_client.dart';

/// Registers and revokes the device push token (FCM) for the signed-in user.
class DeviceTokenRepository {
  DeviceTokenRepository(this._api);

  final CommunicationApiClient _api;

  static const String _deviceIdKey = 'drewel.deviceId';

  Future<String> _deviceId() async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    String? id = prefs.getString(_deviceIdKey);
    if (id == null || id.isEmpty) {
      final Random random = Random.secure();
      id = List<String>.generate(
        32,
        (_) => random.nextInt(16).toRadixString(16),
      ).join();
      await prefs.setString(_deviceIdKey, id);
    }
    return id;
  }

  Future<String> _platform() async {
    if (kIsWeb) return 'web';
    if (Platform.isIOS) return 'ios';
    if (Platform.isAndroid) return 'android';
    return 'unknown';
  }

  Future<String> _appVersion() async {
    try {
      final DeviceInfoPlugin info = DeviceInfoPlugin();
      if (Platform.isAndroid) {
        final AndroidDeviceInfo android = await info.androidInfo;
        return '${android.version.release} ${android.version.sdkInt}';
      }
      if (Platform.isIOS) {
        final IosDeviceInfo ios = await info.iosInfo;
        return ios.systemVersion;
      }
    } catch (_) {
      // Fall through to a generic version.
    }
    return '';
  }

  /// Sends the current FCM token to the backend. Failures are silent — the
  /// token is retried on the next session / app start.
  Future<void> register(String token) async {
    if (token.isEmpty) return;
    try {
      await _api.post(
        ApiUrlConstants.endPointOfRegisterDeviceToken,
        <String, dynamic>{
          'token': token,
          'platform': await _platform(),
          'deviceId': await _deviceId(),
          'appVersion': await _appVersion(),
        },
      );
    } catch (error) {
      debugPrint('Device token registration failed: ${error.runtimeType}');
    }
  }

  /// Revokes the current token on logout. Best-effort.
  Future<void> unregister(String token) async {
    if (token.isEmpty) return;
    try {
      await _api.post(
        ApiUrlConstants.endPointOfUnregisterDeviceToken,
        <String, dynamic>{'token': token},
      );
    } catch (error) {
      debugPrint('Device token unregister failed: ${error.runtimeType}');
    }
  }
}
