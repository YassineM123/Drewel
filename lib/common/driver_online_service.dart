import 'dart:convert';
import 'dart:ui';

import 'package:flutter/foundation.dart';
import 'package:flutter_foreground_task/flutter_foreground_task.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../app/data/apis/api_constants/api_key_constants.dart';
import '../app/data/apis/api_constants/api_url_constants.dart';
import '../app/data/apis/api_models/get_simple_response_model.dart';

enum PresenceHeartbeatResult {
  renewed,
  networkFailure,
  staleSession,
  noSession
}

/// Maintains the backend presence lease while an Android driver is online.
///
/// Closing/backgrounding the activity must not send Offline. The service keeps
/// renewing the opaque server session, and the server is solely responsible
/// for expiring presence after its timeout when heartbeats really stop.
class DriverOnlineService {
  DriverOnlineService._();

  static const String _sessionPreferenceKey = 'driverPresenceSessionId';
  static const String _sessionTaskKey = 'driver_presence_session_id';
  static const String _intervalTaskKey = 'driver_presence_interval_ms';
  static const String _goOfflineButtonId = 'driver_presence_go_offline';
  static const String _mainEventWentOffline = 'driver_presence_offline';
  static const String _notificationTitle = 'Drewel - Online';
  static const String _notificationText =
      'Presence active.\nWaiting for ride requests.';
  static const int _defaultHeartbeatIntervalMs = 20000;
  static const int _minimumHeartbeatIntervalMs = 5000;

  static int _safeInterval(int? intervalMs) =>
      (intervalMs ?? _defaultHeartbeatIntervalMs)
          .clamp(_minimumHeartbeatIntervalMs, 60000)
          .toInt();

  static ForegroundTaskOptions _taskOptions(int intervalMs) =>
      ForegroundTaskOptions(
        eventAction: ForegroundTaskEventAction.repeat(intervalMs),
        autoRunOnBoot: false,
        allowWakeLock: true,
        allowWifiLock: true,
      );

  static void _initCommon(int intervalMs) {
    FlutterForegroundTask.init(
      androidNotificationOptions: AndroidNotificationOptions(
        channelId: 'drewel_driver_online',
        channelName: 'Driver online status',
        channelDescription:
            'Keeps your online presence active while waiting for rides.',
        channelImportance: NotificationChannelImportance.LOW,
        priority: NotificationPriority.LOW,
        onlyAlertOnce: true,
      ),
      iosNotificationOptions: const IOSNotificationOptions(
        showNotification: false,
      ),
      foregroundTaskOptions: _taskOptions(intervalMs),
    );
  }

  static List<NotificationButton> get _notificationButtons =>
      const <NotificationButton>[
        NotificationButton(
          id: _goOfflineButtonId,
          text: 'Go Offline',
          textColor: Color(0xFFBE1B2C),
        ),
      ];

  static void initUiCallbacks(void Function(Object data) onData) {
    if (!isAndroidPlatform) return;
    FlutterForegroundTask.initCommunicationPort();
    FlutterForegroundTask.addTaskDataCallback(onData);
  }

  static void removeUiCallback(void Function(Object data) onData) {
    if (!isAndroidPlatform) return;
    FlutterForegroundTask.removeTaskDataCallback(onData);
  }

  static bool isOfflineEvent(Object data) => data == _mainEventWentOffline;

  static Future<bool> start(DriverPresenceModel presence) async {
    final String sessionId = presence.sessionId?.trim() ?? '';
    if (sessionId.isEmpty) {
      throw StateError('Online response did not include a presence session.');
    }
    final int intervalMs = _safeInterval(presence.heartbeatIntervalMs);
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    await prefs.setString(_sessionPreferenceKey, sessionId);

    if (!isAndroidPlatform) return true;
    _initCommon(intervalMs);
    await FlutterForegroundTask.saveData(
      key: _sessionTaskKey,
      value: sessionId,
    );
    await FlutterForegroundTask.saveData(
      key: _intervalTaskKey,
      value: intervalMs,
    );

    final NotificationPermission permission =
        await FlutterForegroundTask.checkNotificationPermission();
    if (permission != NotificationPermission.granted) {
      await FlutterForegroundTask.requestNotificationPermission();
    }
    await _requestBatteryOptimizationExemption();

    if (await FlutterForegroundTask.isRunningService) {
      final ServiceRequestResult result =
          await FlutterForegroundTask.updateService(
        foregroundTaskOptions: _taskOptions(intervalMs),
        notificationTitle: _notificationTitle,
        notificationText: _notificationText,
        notificationButtons: _notificationButtons,
        callback: startCallback,
      );
      return result is ServiceRequestSuccess;
    }

    final ServiceRequestResult result =
        await FlutterForegroundTask.startService(
      serviceId: 256,
      notificationTitle: _notificationTitle,
      notificationText: _notificationText,
      notificationButtons: _notificationButtons,
      callback: startCallback,
    );
    return result is ServiceRequestSuccess;
  }

  static Future<void> _requestBatteryOptimizationExemption() async {
    if (!isAndroidPlatform) return;
    try {
      if (!await FlutterForegroundTask.isIgnoringBatteryOptimizations) {
        await FlutterForegroundTask.requestIgnoreBatteryOptimization();
      }
    } catch (error) {
      debugPrint('Battery optimization exemption skipped: $error');
    }
  }

  /// Used on resume for immediate recovery instead of waiting for the next
  /// scheduled service tick.
  static Future<PresenceHeartbeatResult> heartbeatNow() async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    await prefs.reload();
    final String sessionId = prefs.getString(_sessionPreferenceKey) ?? '';
    if (sessionId.isEmpty) return PresenceHeartbeatResult.noSession;
    return _sendPresenceHeartbeat(sessionId);
  }

  /// Stops heartbeats only after an explicit, successful Go Offline request.
  static Future<void> stop({bool clearStoredSession = true}) async {
    if (clearStoredSession) await clearSession();
    if (!isAndroidPlatform) return;
    if (await FlutterForegroundTask.isRunningService) {
      await FlutterForegroundTask.stopService();
    }
  }

  static Future<void> goOfflineForLogout() async {
    final String sessionId = await currentSessionId() ?? '';
    await _sendOfflineRequest(sessionId);
    await stop();
  }

  static Future<String?> currentSessionId() async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    await prefs.reload();
    final String value = prefs.getString(_sessionPreferenceKey) ?? '';
    return value.isEmpty ? null : value;
  }

  static Future<void> clearSession() async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    await prefs.remove(_sessionPreferenceKey);
    if (isAndroidPlatform) {
      await FlutterForegroundTask.removeData(key: _sessionTaskKey);
    }
  }
}

bool get isAndroidPlatform =>
    !kIsWeb && defaultTargetPlatform == TargetPlatform.android;

@pragma('vm:entry-point')
void startCallback() {
  DartPluginRegistrant.ensureInitialized();
  FlutterForegroundTask.setTaskHandler(_DriverPresenceTaskHandler());
}

class _DriverPresenceTaskHandler extends TaskHandler {
  bool _requestInFlight = false;
  bool _offlineRequestInFlight = false;

  @override
  Future<void> onStart(DateTime timestamp, TaskStarter starter) async {
    await _heartbeat();
  }

  @override
  void onRepeatEvent(DateTime timestamp) {
    _heartbeat();
  }

  Future<void> _heartbeat() async {
    if (_requestInFlight) return;
    _requestInFlight = true;
    try {
      final String sessionId = await FlutterForegroundTask.getData<String>(
            key: DriverOnlineService._sessionTaskKey,
          ) ??
          '';
      if (sessionId.isEmpty) return;
      final PresenceHeartbeatResult result =
          await _sendPresenceHeartbeat(sessionId);
      if (result == PresenceHeartbeatResult.staleSession) {
        await DriverOnlineService.clearSession();
        await FlutterForegroundTask.stopService();
      }
    } finally {
      _requestInFlight = false;
    }
  }

  @override
  void onNotificationButtonPressed(String id) {
    if (id == DriverOnlineService._goOfflineButtonId) {
      _goOfflineFromNotification();
    }
  }

  Future<void> _goOfflineFromNotification() async {
    if (_offlineRequestInFlight) return;
    _offlineRequestInFlight = true;
    try {
      final String sessionId = await FlutterForegroundTask.getData<String>(
            key: DriverOnlineService._sessionTaskKey,
          ) ??
          '';
      final bool wentOffline = await _sendOfflineRequest(sessionId);
      if (wentOffline) {
        await DriverOnlineService.clearSession();
        FlutterForegroundTask.sendDataToMain(
          DriverOnlineService._mainEventWentOffline,
        );
        await FlutterForegroundTask.stopService();
      }
    } finally {
      _offlineRequestInFlight = false;
    }
  }

  @override
  Future<void> onDestroy(DateTime timestamp) async {
    // Deliberately do not send Offline. If Android actually kills the service,
    // the backend lease expires after its configured heartbeat timeout.
  }
}

Future<bool> _sendOfflineRequest(String sessionId) async {
  try {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    await prefs.reload();
    final String token = prefs.getString(ApiKeyConstants.token) ?? '';
    if (token.isEmpty) return false;

    final Map<String, Object> body = <String, Object>{
      'isOnline': false,
      if (sessionId.isNotEmpty) 'sessionId': sessionId,
    };
    final http.Response response = await http
        .post(
          Uri.parse(ApiUrlConstants.endPointOfDriverUpdateOnlineStatus),
          headers: <String, String>{
            'Authorization': 'Bearer $token',
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: jsonEncode(body),
        )
        .timeout(const Duration(seconds: 10));

    return (response.statusCode >= 200 && response.statusCode < 300) ||
        response.statusCode == 409;
  } catch (_) {
    return false;
  }
}

Future<PresenceHeartbeatResult> _sendPresenceHeartbeat(
  String sessionId,
) async {
  try {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    await prefs.reload();
    final String token = prefs.getString(ApiKeyConstants.token) ?? '';
    if (token.isEmpty) return PresenceHeartbeatResult.noSession;

    final http.Response response = await http
        .post(
          Uri.parse(ApiUrlConstants.endPointOfDriverPresenceHeartbeat),
          headers: <String, String>{
            'Authorization': 'Bearer $token',
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: jsonEncode(<String, String>{'sessionId': sessionId}),
        )
        .timeout(const Duration(seconds: 10));

    if (response.statusCode == 409) {
      await DriverOnlineService.clearSession();
      return PresenceHeartbeatResult.staleSession;
    }
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return PresenceHeartbeatResult.renewed;
    }
    return PresenceHeartbeatResult.networkFailure;
  } catch (_) {
    // Keep retrying on the next tick. A temporary outage should not cause an
    // explicit Offline transition; only the server lease timeout may do that.
    return PresenceHeartbeatResult.networkFailure;
  }
}
