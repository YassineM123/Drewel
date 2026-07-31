import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:get/get.dart';

import 'app/routes/app_pages.dart';
import 'common/theme_data.dart';
import 'app/modules/communication/controllers/call_state_controller.dart';
import 'app/modules/points/points_translations.dart';

void main() {
  runApp(
    GetMaterialApp(
      title: "Drewel",
      initialRoute: AppPages.INITIAL,
      getPages: AppPages.routes,
      initialBinding: CommunicationBinding(),
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
