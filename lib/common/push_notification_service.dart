import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:get/get.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../app/data/apis/api_constants/api_key_constants.dart';
import '../app/data/apis/communication_api_client.dart';
import '../app/data/repositories/device_token_repository.dart';
import 'deep_link_service.dart';

/// The single push entry point for Drewel.
///
/// FCM delivery is fully optional: when Firebase is not configured yet (no
/// google-services.json / APNS keys) the service degrades gracefully and the
/// app keeps working on the realtime socket + in-app pipeline. Everything here
/// is non-blocking and never throws into the app.
class PushNotificationService extends GetxService {
  PushNotificationService({CommunicationApiClient? api})
      : _tokenRepository =
            DeviceTokenRepository(api ?? CommunicationApiClient());

  final DeviceTokenRepository _tokenRepository;

  FlutterLocalNotificationsPlugin? _localNotifications;
  bool _fcmAvailable = false;
  bool _init = false;
  bool _permissionRequested = false;

  /// Invoked for every FCM message received while the app is in the
  /// foreground. The data map mirrors the backend `notification:new` payload.
  void Function(Map<String, dynamic> message)? onForegroundMessage;

  /// Invoked when the user taps a push notification (foreground or
  /// background/terminated) so the app can route to the deep link.
  void Function(String deepLink)? onDeepLink;

  bool get fcmAvailable => _fcmAvailable;

  /// Ids must match the OS channels created in MainActivity.kt and the
  /// backend `notificationChannelForType` mapping.
  static const List<AndroidNotificationChannel> channels =
      <AndroidNotificationChannel>[
    AndroidNotificationChannel(
      'drewel_ride_requests',
      'New ride requests',
      description: 'A new ride request is available for the driver.',
      importance: Importance.max,
    ),
    AndroidNotificationChannel(
      'drewel_messages',
      'Messages',
      description: 'New messages in an active ride chat.',
      importance: Importance.high,
    ),
    AndroidNotificationChannel(
      'drewel_rides',
      'Ride updates',
      description:
          'General ride updates such as driver accepted and ride completed.',
      importance: Importance.defaultImportance,
    ),
    AndroidNotificationChannel(
      'drewel_system',
      'System notifications',
      description: 'Account updates and important system messages.',
      importance: Importance.low,
    ),
  ];

  static AndroidNotificationChannel channelForType(String type) {
    final String t = type.toUpperCase();
    if (t == 'RIDE_REQUEST' || t == 'NEW_RIDE') return channels[0];
    if (t == 'RIDE_MESSAGE' || t == 'CHAT') return channels[1];
    if (t.startsWith('RIDE') ||
        t.startsWith('DRIVER_ARRIVED') ||
        t.startsWith('TRIP_OFFER') ||
        t.startsWith('OFFER')) {
      return channels[2];
    }
    return channels[3];
  }

  static String soundAssetForType(String type) {
    final String t = type.toUpperCase();
    if (t == 'RIDE_REQUEST' || t == 'NEW_RIDE') return 'drewel_ride_request';
    if (t == 'RIDE_MESSAGE' || t == 'CHAT') return 'drewel_message';
    if (t == 'DRIVER_ARRIVED') return 'drewel_driver_arrived';
    if (t == 'POINTS_LOW_BALANCE' || t == 'POINTS_INSUFFICIENT_BALANCE') {
      return 'drewel_warning';
    }
    if (t.startsWith('POINTS') ||
        t.startsWith('WELCOME') ||
        t.startsWith('OFFER_POINTS') ||
        t.startsWith('RIDE_POINTS')) {
      return 'drewel_success';
    }
    return 'drewel_notification';
  }

  Future<void> init() async {
    if (_init) return;
    _init = true;

    _localNotifications = FlutterLocalNotificationsPlugin();
    try {
      await _localNotifications!.initialize(
        settings: const InitializationSettings(
          android: AndroidInitializationSettings('ic_stat_drewel'),
          iOS: DarwinInitializationSettings(
            requestAlertPermission: false,
            requestBadgePermission: false,
            requestSoundPermission: false,
          ),
        ),
        onDidReceiveNotificationResponse: (NotificationResponse response) =>
            _handleTap(response.payload),
      );
      final AndroidFlutterLocalNotificationsPlugin? android =
          _localNotifications!.resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>();
      for (final AndroidNotificationChannel channel in channels) {
        try {
          await android?.createNotificationChannel(channel);
        } catch (_) {}
      }
      if (!_permissionRequested) {
        _permissionRequested = true;
        try {
          await android?.requestNotificationsPermission();
        } catch (_) {}
      }
    } catch (error) {
      debugPrint('Local notifications unavailable: $error');
      _localNotifications = null;
    }

    // ---- Firebase / FCM (optional) ----
    try {
      await Firebase.initializeApp();
      _fcmAvailable = true;
    } catch (error) {
      debugPrint('Firebase unavailable; push delivery disabled: $error');
      _fcmAvailable = false;
      return;
    }

    final FirebaseMessaging messaging = FirebaseMessaging.instance;
    try {
      await messaging.requestPermission(alert: true, badge: true, sound: true);
    } catch (_) {}

    FirebaseMessaging.onMessage.listen(_handleForegroundMessage);
    FirebaseMessaging.onMessageOpenedApp.listen(_handleOpenedMessage);
    final RemoteMessage? initial = await messaging.getInitialMessage();
    if (initial != null) _handleOpenedMessage(initial);

    messaging.onTokenRefresh.listen((String token) {
      unawaited(_registerToken(token));
    });
    try {
      unawaited(_registerToken(await messaging.getToken()));
    } catch (error) {
      debugPrint('FCM token unavailable: $error');
    }
  }

  Future<void> _handleForegroundMessage(RemoteMessage message) async {
    // firebase_messaging keeps `notification` separate from `data`. Merge so
    // the shared in-app pipeline (title/message/type/deepLink) always works.
    final Map<String, dynamic> data = Map<String, dynamic>.from(message.data);
    final RemoteNotification? note = message.notification;
    if (note != null) {
      data['title'] ??= note.title ?? '';
      data['body'] ??= note.body ?? '';
      data['message'] ??= note.body ?? '';
    }
    onForegroundMessage?.call(data);
    // Foreground apps must surface the notification themselves.
    await _showLocalNotification(data);
  }

  void _handleOpenedMessage(RemoteMessage message) {
    final String link = message.data['deepLink']?.toString() ?? '';
    if (link.isNotEmpty) {
      _handleTap(link);
    }
  }

  void _handleTap(String? payload) {
    final String link = payload ?? '';
    if (link.isEmpty) return;
    if (onDeepLink != null) {
      onDeepLink!(link);
    } else {
      unawaited(DeepLinkService.instance.handle(link));
    }
  }

  Future<void> _showLocalNotification(Map<String, dynamic> data) async {
    final FlutterLocalNotificationsPlugin? plugin = _localNotifications;
    if (plugin == null) return;
    final String type = (data['type'] ?? 'GENERAL').toString();
    final String title = (data['title'] ?? '').toString().trim();
    final String body =
        (data['body'] ?? data['message'] ?? '').toString().trim();
    if (title.isEmpty && body.isEmpty) return;
    final String idString = (data['id'] ?? data['messageId'] ?? '').toString();
    final int id = idString.hashCode & 0x7fffffff;
    final AndroidNotificationChannel channel = channelForType(type);
    try {
      await plugin.show(
        id: id,
        title: title.isNotEmpty ? title : 'Drewel',
        body: body,
        notificationDetails: NotificationDetails(
          android: AndroidNotificationDetails(
            channel.id,
            channel.name,
            channelDescription: channel.description,
            importance: channel.importance,
            priority: channel.importance == Importance.max
                ? Priority.high
                : Priority.defaultPriority,
            playSound: true,
            sound: RawResourceAndroidNotificationSound(soundAssetForType(type)),
            enableVibration: true,
          ),
          iOS: const DarwinNotificationDetails(),
        ),
        payload: (data['deepLink'] ?? '').toString(),
      );
    } catch (error) {
      debugPrint('Local notification display failed: $error');
    }
  }

  /// Registers the FCM token for the current session (if signed in).
  Future<void> registerCurrentToken() async {
    if (!_fcmAvailable) return;
    try {
      await _registerToken(await FirebaseMessaging.instance.getToken());
    } catch (error) {
      debugPrint('FCM token unavailable: $error');
    }
  }

  Future<void> _registerToken(String? token) async {
    final String value = (token ?? '').trim();
    if (value.isEmpty) return;
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final String sessionToken =
        prefs.getString(ApiKeyConstants.token)?.trim() ?? '';
    final String sessionUserId =
        prefs.getString(ApiKeyConstants.userId)?.trim() ?? '';
    if (sessionToken.isEmpty || sessionUserId.isEmpty) return;
    await _tokenRepository.register(value);
  }

  /// Unregisters the current FCM token (logout). Best-effort.
  Future<void> unregisterToken(String? token) async {
    final String value = (token ?? '').trim();
    if (value.isEmpty) return;
    await _tokenRepository.unregister(value);
  }

  /// Convenience used before the session is wiped on logout.
  Future<void> unregisterForLogout() async {
    if (!_fcmAvailable) return;
    try {
      final String? token = await FirebaseMessaging.instance.getToken();
      await unregisterToken(token);
    } catch (error) {
      debugPrint('FCM unregister skipped: $error');
    }
  }
}
