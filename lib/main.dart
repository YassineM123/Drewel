import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:get/get.dart';

import 'app/routes/app_pages.dart';
import 'common/theme_data.dart';
import 'common/notification_sound_service.dart';
import 'app/modules/communication/controllers/call_state_controller.dart';
import 'app/modules/points/points_translations.dart';
import 'app/modules/active_ride/bindings/active_ride_binding.dart';

void main() {
  final NotificationSoundService soundService = NotificationSoundService();
  soundService.init();
  runApp(
    GetMaterialApp(
      title: "Drewel",
      initialRoute: AppPages.INITIAL,
      getPages: AppPages.routes,
      initialBinding: BindingsBuilder(() {
        Get.put<NotificationSoundService>(soundService, permanent: true);
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
