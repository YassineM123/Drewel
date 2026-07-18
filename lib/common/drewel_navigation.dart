import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../app/data/apis/api_constants/api_key_constants.dart';
import '../app/routes/app_pages.dart';

class DrewelNavigation {
  DrewelNavigation._();

  static Future<void> resetTo(String route) async {
    if (Get.currentRoute == route) return;
    await Get.offAllNamed(route);
  }

  static Future<String> authenticatedHomeRoute() async {
    final SharedPreferences preferences = await SharedPreferences.getInstance();
    final String userId =
        preferences.getString(ApiKeyConstants.userId)?.trim() ?? '';
    if (userId.isEmpty) return Routes.USER_TYPE;
    return preferences.getString(ApiKeyConstants.type) == ApiKeyConstants.driver
        ? Routes.DRIVER_HOME
        : Routes.USER_HOME;
  }

  static Future<void> back(
    BuildContext context, {
    String? fallbackRoute,
  }) async {
    final NavigatorState navigator = Navigator.of(context);
    if (navigator.canPop()) {
      await navigator.maybePop();
      return;
    }

    final String target = fallbackRoute ?? await authenticatedHomeRoute();
    if (Get.currentRoute != target) {
      await Get.offNamed(target);
      return;
    }

    // A root route must remain visible instead of closing the application.
    if (target != Routes.USER_TYPE) {
      await Get.offNamed(Routes.USER_TYPE);
    }
  }
}
