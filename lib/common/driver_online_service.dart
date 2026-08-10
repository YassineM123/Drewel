import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_foreground_task/flutter_foreground_task.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../app/data/apis/api_constants/api_key_constants.dart';
import '../app/data/apis/api_constants/api_url_constants.dart';

/// Shows a persistent "you're online" notification while the driver is
/// online, and flips the driver back offline on the backend if the task
/// (app) is removed from recents while still online.
class DriverOnlineService {
  DriverOnlineService._();

  static void _initCommon() {
    FlutterForegroundTask.init(
      androidNotificationOptions: AndroidNotificationOptions(
        channelId: 'drewel_driver_online',
        channelName: 'Driver online status',
        channelDescription:
            'Shown while you are online and available for rides.',
        channelImportance: NotificationChannelImportance.LOW,
        priority: NotificationPriority.LOW,
        onlyAlertOnce: true,
      ),
      iosNotificationOptions: const IOSNotificationOptions(
        showNotification: false,
      ),
      foregroundTaskOptions: ForegroundTaskOptions(
        eventAction: ForegroundTaskEventAction.nothing(),
        autoRunOnBoot: false,
        allowWakeLock: true,
        allowWifiLock: false,
      ),
    );
  }

  static Future<void> start() async {
    if (!isAndroidPlatform) return;
    _initCommon();

    final NotificationPermission permission =
        await FlutterForegroundTask.checkNotificationPermission();
    if (permission != NotificationPermission.granted) {
      await FlutterForegroundTask.requestNotificationPermission();
    }

    if (await FlutterForegroundTask.isRunningService) {
      await FlutterForegroundTask.updateService(
        notificationTitle: 'Drewel — Online',
        notificationText: 'You are online and visible to riders.',
        callback: startCallback,
      );
      return;
    }

    await FlutterForegroundTask.startService(
      serviceId: 256,
      notificationTitle: 'Drewel — Online',
      notificationText: 'You are online and visible to riders.',
      callback: startCallback,
    );
  }

  static Future<void> stop() async {
    if (!isAndroidPlatform) return;
    if (await FlutterForegroundTask.isRunningService) {
      await FlutterForegroundTask.stopService();
    }
  }
}

/// Kept as a plain bool check instead of importing dart:io directly here so
/// this file stays trivially testable; foreground services are Android-only.
bool get isAndroidPlatform => defaultTargetPlatform == TargetPlatform.android;

@pragma('vm:entry-point')
void startCallback() {
  FlutterForegroundTask.setTaskHandler(_DriverOnlineTaskHandler());
}

class _DriverOnlineTaskHandler extends TaskHandler {
  @override
  Future<void> onStart(DateTime timestamp, TaskStarter starter) async {}

  @override
  void onRepeatEvent(DateTime timestamp) {}

  @override
  Future<void> onDestroy(DateTime timestamp) async {
    // The app/task was removed while the driver was still online. Push a
    // best-effort offline update from this surviving service isolate.
    await _sendDriverOffline();
  }
}

Future<void> _sendDriverOffline() async {
  try {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final String token = prefs.getString(ApiKeyConstants.token) ?? '';
    if (token.isEmpty) return;

    await http.post(
      Uri.parse(ApiUrlConstants.endPointOfDriverUpdateOnlineStatus),
      headers: <String, String>{
        'Authorization': 'Bearer $token',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: jsonEncode(<String, dynamic>{ApiKeyConstants.isOnline: false}),
    );
  } catch (_) {
    // Best effort only — nothing else can be done from a dying service.
  }
}
