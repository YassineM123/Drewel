import 'package:flutter/material.dart';
import 'package:get/get.dart';

import 'app/routes/app_pages.dart';
import 'common/theme_data.dart';
import 'app/modules/communication/controllers/call_state_controller.dart';

void main() {
  runApp(
    GetMaterialApp(
      title: "Drewel",
      initialRoute: AppPages.INITIAL,
      getPages: AppPages.routes,
      initialBinding: CommunicationBinding(),
      debugShowCheckedModeBanner: false,
      theme: MThemeData.themeData(),
    ),
  );
}
