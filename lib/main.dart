import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:get/get.dart';

import 'app/routes/app_pages.dart';
import 'common/theme_data.dart';
import 'common/notification_sound_service.dart';
import 'common/push_notification_service.dart';
import 'app/modules/communication/controllers/call_state_controller.dart';
import 'app/modules/points/points_translations.dart';
import 'app/modules/active_ride/bindings/active_ride_binding.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final NotificationSoundService soundService = NotificationSoundService();
  final PushNotificationService pushService = PushNotificationService();
  WidgetsBinding.instance.addPostFrameCallback((_) {
    _startOptionalService(
      'Notification sounds',
      soundService.init,
    );
    _startOptionalService(
      'Push notifications',
      pushService.init,
    );
  });
  runApp(
    GetMaterialApp(
      title: "Drewel",
      initialRoute: AppPages.INITIAL,
      getPages: AppPages.routes,
      initialBinding: BindingsBuilder(() {
        Get.put<NotificationSoundService>(soundService, permanent: true);
        Get.put<PushNotificationService>(pushService, permanent: true);
        CommunicationBinding().dependencies();
        ActiveRideBinding().dependencies();
      }),
      debugShowCheckedModeBanner: false,
      theme: MThemeData.themeData(),
      translations: PointsTranslations(),
      locale: Get.deviceLocale,
      fallbackLocale: const Locale('en'),
      supportedLocales: const <Locale>[Locale('en'), Locale('ar')],
      localizationsDelegates: const <LocalizationsDelegate<dynamic>>[
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
    ),
  );
}

void _startOptionalService(
  String label,
  Future<void> Function() init,
) {
  unawaited(
    init().catchError((Object error, StackTrace stackTrace) {
      debugPrint('$label unavailable: $error');
      if (kDebugMode) debugPrintStack(stackTrace: stackTrace);
    }),
  );
}
