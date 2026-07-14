import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../data/apis/api_methods/api_methods.dart';
import '../../../data/apis/api_models/get_add_driver_details_model.dart';
import '../../../data/apis/api_constants/api_key_constants.dart';
import '../../../routes/app_pages.dart';

class SplashController extends GetxController with GetTickerProviderStateMixin {
  final count = 0.obs;

  late final AnimationController logoAnimationController;
  late final RxDouble scale = 0.0.obs;

  @override
  void onInit() {
    super.onInit();
    _startLogoAnimation();
    manageSession();
  }

  void _startLogoAnimation() {
    logoAnimationController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    );

    final animation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: logoAnimationController,
        curve: Curves.easeOutBack,
      ),
    );

    animation.addListener(() {
      scale.value = animation.value;
    });

    logoAnimationController.forward();
  }

  String _normalizeDriverStatus(String? status) {
    final String value = (status ?? '').trim().toLowerCase();
    if (value == ApiKeyConstants.pending) return ApiKeyConstants.pending;
    if (value == ApiKeyConstants.approvedStatus) {
      return ApiKeyConstants.approvedStatus;
    }
    if (value == ApiKeyConstants.rejected) return ApiKeyConstants.rejected;
    if (value == ApiKeyConstants.completed) return ApiKeyConstants.completed;
    return '';
  }

  String _resolveDriverStatus(Driver? driver, String? cachedStatus) {
    final String apiStatus = _normalizeDriverStatus(driver?.status);
    if (apiStatus == ApiKeyConstants.completed) {
      return ApiKeyConstants.completed;
    }
    if (driver?.isApproved == true) return ApiKeyConstants.approvedStatus;
    if (apiStatus.isNotEmpty) return apiStatus;
    return _normalizeDriverStatus(cachedStatus);
  }

  void manageSession() async {
    await Future.delayed(const Duration(seconds: 2));
    SharedPreferences prefs = await SharedPreferences.getInstance();

    if (prefs.getString(ApiKeyConstants.userId) != null) {
      if (prefs.getString(ApiKeyConstants.type) == ApiKeyConstants.user) {
        Get.offNamed(Routes.USER_REGISTER);
      } else {
        final String driverId = prefs.getString(ApiKeyConstants.userId) ?? '';
        AddDriverDetailModel? driverModel;
        if (driverId.isNotEmpty) {
          driverModel =
              await ApiMethods.getDriverDetailsApi(driverId: driverId);
        }

        final String status = _resolveDriverStatus(
          driverModel?.driver,
          prefs.getString(ApiKeyConstants.driverStatus),
        );
        if (status.isNotEmpty) {
          prefs.setString(ApiKeyConstants.driverStatus, status);
        }

        if (status == ApiKeyConstants.completed) {
          Get.offNamed(Routes.DRIVER_HOME);
        } else if (status == ApiKeyConstants.approvedStatus) {
          Get.offNamed(Routes.DRIVER_COMPLETE_PROFILE);
        } else {
          Get.offNamed(Routes.DRIVER_REGISTER);
        }
      }
    } else {
      Get.offAndToNamed(Routes.USER_TYPE);
    }
  }

  @override
  void onClose() {
    logoAnimationController.dispose();
    super.onClose();
  }
}
