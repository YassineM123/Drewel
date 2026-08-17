import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:image_picker/image_picker.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../../common/common_widgets.dart';
import '../../../../common/driver_online_service.dart';
import '../../../../common/push_notification_service.dart';
import '../../../data/apis/api_constants/api_key_constants.dart';
import '../../../data/apis/api_models/active_ride_model.dart';
import '../../../data/apis/api_models/driver_points_models.dart';
import '../../../data/apis/api_models/get_add_driver_details_model.dart';
import '../../../data/apis/api_models/passenger_account_models.dart';
import '../../../data/apis/communication_api_client.dart';
import '../../../data/repositories/driver_account_repository.dart';
import '../../../routes/app_pages.dart';
import '../../communication/controllers/call_state_controller.dart';
import '../../points/controllers/driver_points_controller.dart';

class DriverPerformanceSummary {
  const DriverPerformanceSummary({
    required this.completed,
    required this.cancelled,
    required this.active,
    required this.totalValue,
    required this.completionRate,
    required this.cancellationRate,
  });

  final int completed;
  final int cancelled;
  final int active;
  final double totalValue;
  final double? completionRate;
  final double? cancellationRate;
}

class DriverAccountController extends GetxController {
  DriverAccountController({required DriverAccountRepository repository})
      : _repository = repository;

  final DriverAccountRepository _repository;
  final ImagePicker _picker = ImagePicker();

  final driver = Rxn<Driver>();
  final rides = <ActiveRideModel>[].obs;
  final preferences = Rxn<PassengerPreferenceModel>();
  final legalContent = Rxn<LegalContentModel>();
  final legalType = ''.obs;
  final appVersion = ''.obs;
  final loading = false.obs;
  final saving = false.obs;
  final error = ''.obs;
  final rideFilter = RideHistoryFilter.all.obs;

  @override
  void onInit() {
    super.onInit();
    unawaited(refreshAll());
    unawaited(_loadVersion());
  }

  DriverPointsController? get pointsController =>
      Get.isRegistered<DriverPointsController>()
          ? Get.find<DriverPointsController>()
          : null;

  DriverPointsWallet? get wallet => pointsController?.wallet.value;
  List<PointTransaction> get transactions =>
      pointsController?.transactions.toList(growable: false) ??
      const <PointTransaction>[];

  List<ActiveRideModel> get filteredRides => rides
      .where((ActiveRideModel ride) => RideHistoryFilter.matches(
            ride,
            rideFilter.value,
          ))
      .toList(growable: false);

  DriverPerformanceSummary get performance {
    final int completed = rides
        .where((ActiveRideModel ride) => ride.status == 'completed')
        .length;
    final int cancelled = rides
        .where((ActiveRideModel ride) => ride.status.startsWith('cancelled'))
        .length;
    final int active = rides
        .where((ActiveRideModel ride) => !ride.rideStatus.isTerminal)
        .length;
    final int decided = completed + cancelled;
    final double totalValue = rides.fold<double>(
      0,
      (double total, ActiveRideModel ride) =>
          ride.status == 'completed' ? total + (ride.agreedPrice ?? 0) : total,
    );
    return DriverPerformanceSummary(
      completed: completed,
      cancelled: cancelled,
      active: active,
      totalValue: totalValue,
      completionRate: decided == 0 ? null : completed / decided,
      cancellationRate: decided == 0 ? null : cancelled / decided,
    );
  }

  Future<void> refreshAll() async {
    loading.value = true;
    error.value = '';
    try {
      final SharedPreferences prefs = await SharedPreferences.getInstance();
      final String driverId =
          prefs.getString(ApiKeyConstants.userId)?.trim() ?? '';
      if (driverId.isEmpty) {
        throw const CommunicationApiException('Authentication required.');
      }
      final Driver nextDriver = await _repository.getDriver(driverId);
      driver.value = nextDriver;
      await _persistDriver(nextDriver);
      await Future.wait<void>(<Future<void>>[
        _refreshRides(),
        _refreshPreferences(),
        _refreshPoints(),
      ]);
    } on CommunicationApiException catch (catchError) {
      error.value = catchError.message;
    } catch (_) {
      error.value = 'Unable to load your driver account. Please retry.';
    } finally {
      loading.value = false;
    }
  }

  Future<void> _refreshRides() async {
    try {
      rides.assignAll(await _repository.listRides());
    } catch (_) {}
  }

  Future<void> _refreshPreferences() async {
    try {
      preferences.value = await _repository.getPreferences();
    } catch (_) {}
  }

  Future<void> _refreshPoints() async {
    try {
      await pointsController?.refreshAll(silent: true);
    } catch (_) {}
  }

  Future<void> saveProfile({
    required String firstName,
    required String lastName,
    required String phone,
    required String email,
    required String whatsappNumber,
  }) async {
    final Driver? current = driver.value;
    if (current?.sId?.trim().isNotEmpty != true) return;
    if (firstName.trim().length < 2 || lastName.trim().length < 2) {
      CommonWidgets.snackBarView(title: 'Enter your first and last name.');
      return;
    }
    if (phone.trim().length < 6) {
      CommonWidgets.snackBarView(title: 'Enter a valid phone number.');
      return;
    }
    final String trimmedEmail = email.trim();
    if (trimmedEmail.isNotEmpty &&
        !RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(trimmedEmail)) {
      CommonWidgets.snackBarView(title: 'Enter a valid email address.');
      return;
    }
    saving.value = true;
    try {
      driver.value = await _repository.updateProfile(
        driverId: current!.sId!,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        email: trimmedEmail,
        whatsappNumber: whatsappNumber.trim(),
      );
      await _persistDriver(driver.value);
      CommonWidgets.snackBarView(
        title: 'Profile update submitted',
        success: true,
      );
    } on CommunicationApiException catch (catchError) {
      CommonWidgets.snackBarView(title: catchError.message);
    } finally {
      saving.value = false;
    }
  }

  Future<void> changePhoto() async {
    final Driver? current = driver.value;
    if (current?.sId?.trim().isNotEmpty != true) return;
    final XFile? picked = await _picker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 82,
      maxWidth: 1200,
    );
    if (picked == null) return;
    saving.value = true;
    try {
      final String url = await _repository.updateProfilePhoto(
        driverId: current!.sId!,
        file: File(picked.path),
      );
      driver.value = Driver.fromJson(<String, dynamic>{
        ...current.toJson(),
        'profileImageUrl': url,
      });
      await _persistDriver(driver.value);
      CommonWidgets.snackBarView(
          title: 'Photo update submitted', success: true);
    } on CommunicationApiException catch (catchError) {
      CommonWidgets.snackBarView(title: catchError.message);
    } finally {
      saving.value = false;
    }
  }

  Future<void> updateLanguage(String language) async {
    saving.value = true;
    try {
      preferences.value =
          await _repository.updatePreferences(language: language);
      Get.updateLocale(Locale(language));
      final SharedPreferences prefs = await SharedPreferences.getInstance();
      await prefs.setString('app_language', language);
    } finally {
      saving.value = false;
    }
  }

  Future<void> updateNotificationPreference(
    NotificationPreferenceModel next,
  ) async {
    saving.value = true;
    try {
      preferences.value =
          await _repository.updatePreferences(notifications: next);
    } finally {
      saving.value = false;
    }
  }

  Future<void> loadLegal(String type) async {
    legalType.value = type;
    legalContent.value = null;
    error.value = '';
    try {
      legalContent.value = await _repository.legal(type);
    } on CommunicationApiException catch (catchError) {
      error.value = catchError.message;
    }
  }

  Future<void> reportProblem({
    required String category,
    String? rideId,
    required String description,
  }) async {
    if (description.trim().length < 10) {
      CommonWidgets.snackBarView(title: 'Please describe the issue.');
      return;
    }
    saving.value = true;
    try {
      await _repository.reportProblem(
        category: category,
        rideId: rideId,
        description: description.trim(),
      );
      CommonWidgets.snackBarView(title: 'Report sent', success: true);
      Get.back();
    } on CommunicationApiException catch (catchError) {
      CommonWidgets.snackBarView(title: catchError.message);
    } finally {
      saving.value = false;
    }
  }

  Future<void> logout() async {
    await DriverOnlineService.goOfflineForLogout();
    try {
      if (Get.isRegistered<PushNotificationService>()) {
        await Get.find<PushNotificationService>().unregisterForLogout();
      }
    } catch (_) {}
    if (Get.isRegistered<CallStateController>()) {
      await Get.find<CallStateController>().disposeForLogout();
    }
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    await prefs.clear();
    Get.offNamedUntil(Routes.USER_TYPE, (route) => false);
  }

  Future<void> _loadVersion() async {
    final PackageInfo info = await PackageInfo.fromPlatform();
    appVersion.value = '${info.version}+${info.buildNumber}';
  }

  Future<void> _persistDriver(Driver? next) async {
    if (next == null) return;
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    await prefs.setString(ApiKeyConstants.fullName, next.fullName ?? '');
    await prefs.setString(ApiKeyConstants.phone, next.phone ?? '');
    await prefs.setString(ApiKeyConstants.countryCode, next.countryCode ?? '');
    await prefs.setString(
      ApiKeyConstants.profileImage,
      next.profileImageUrl ?? '',
    );
  }
}
