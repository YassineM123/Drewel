import 'dart:io';

import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:image_picker/image_picker.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../../common/common_widgets.dart';
import '../../../../common/push_notification_service.dart';
import '../../../data/apis/api_constants/api_key_constants.dart';
import '../../../data/apis/api_models/active_ride_model.dart';
import '../../../data/apis/api_models/passenger_account_models.dart';
import '../../../data/apis/communication_api_client.dart';
import '../../../data/repositories/passenger_account_repository.dart';
import '../../../routes/app_pages.dart';
import '../../communication/controllers/call_state_controller.dart';

class PassengerAccountController extends GetxController {
  PassengerAccountController({required PassengerAccountRepository repository})
      : _repository = repository;

  final PassengerAccountRepository _repository;
  final ImagePicker _picker = ImagePicker();

  final profile = Rxn<PassengerProfileModel>();
  final savedPlaces = <SavedPlaceModel>[].obs;
  final rides = <ActiveRideModel>[].obs;
  final calls = <PassengerCallModel>[].obs;
  final preferences = Rxn<PassengerPreferenceModel>();
  final legalContent = Rxn<LegalContentModel>();
  final appVersion = ''.obs;
  final loading = false.obs;
  final saving = false.obs;
  final error = ''.obs;
  final rideFilter = RideHistoryFilter.all.obs;

  @override
  void onInit() {
    super.onInit();
    refreshAll();
    _loadVersion();
  }

  List<ActiveRideModel> get filteredRides => rides
      .where((ActiveRideModel ride) => RideHistoryFilter.matches(
            ride,
            rideFilter.value,
          ))
      .toList(growable: false);

  SavedPlaceModel? placeByType(String type) {
    for (final SavedPlaceModel place in savedPlaces) {
      if (place.type == type) return place;
    }
    return null;
  }

  Future<void> refreshAll() async {
    loading.value = true;
    error.value = '';
    try {
      final results = await Future.wait<dynamic>(<Future<dynamic>>[
        _repository.getProfile(),
        _repository.listSavedPlaces(),
        _repository.listRides(),
        _repository.listCalls(),
        _repository.getPreferences(),
      ]);
      profile.value = results[0] as PassengerProfileModel;
      savedPlaces.assignAll(results[1] as List<SavedPlaceModel>);
      rides.assignAll(results[2] as List<ActiveRideModel>);
      calls.assignAll(results[3] as List<PassengerCallModel>);
      preferences.value = results[4] as PassengerPreferenceModel;
      await _persistProfile(profile.value);
    } on CommunicationApiException catch (catchError) {
      error.value = catchError.message;
    } catch (_) {
      error.value = 'Unable to load your account. Please retry.';
    } finally {
      loading.value = false;
    }
  }

  Future<void> saveProfile({
    required String fullName,
    required String phone,
    required String email,
  }) async {
    final PassengerProfileModel? current = profile.value;
    if (fullName.trim().length < 2) {
      CommonWidgets.snackBarView(title: 'Enter your full name.');
      return;
    }
    if (phone.trim().length < 6) {
      CommonWidgets.snackBarView(title: 'Enter a valid phone number.');
      return;
    }
    saving.value = true;
    try {
      final PassengerProfileModel updated = await _repository.updateProfile(
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        countryCode: current?.countryCode,
      );
      profile.value = updated;
      await _persistProfile(updated);
      CommonWidgets.snackBarView(title: 'Profile updated', success: true);
    } on CommunicationApiException catch (catchError) {
      CommonWidgets.snackBarView(title: catchError.message);
    } finally {
      saving.value = false;
    }
  }

  Future<void> changePhoto() async {
    final XFile? picked = await _picker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 82,
      maxWidth: 1200,
    );
    if (picked == null) return;
    saving.value = true;
    try {
      final String url =
          await _repository.updateProfilePhoto(File(picked.path));
      final PassengerProfileModel? current = profile.value;
      if (current != null) {
        profile.value = PassengerProfileModel(
          id: current.id,
          fullName: current.fullName,
          countryCode: current.countryCode,
          phone: current.phone,
          email: current.email,
          profileImageUrl: url,
          isVerified: current.isVerified,
        );
        await _persistProfile(profile.value);
      }
      CommonWidgets.snackBarView(title: 'Photo updated', success: true);
    } on CommunicationApiException catch (catchError) {
      CommonWidgets.snackBarView(title: catchError.message);
    } finally {
      saving.value = false;
    }
  }

  Future<void> savePlace({
    String? id,
    required String type,
    required String name,
    required String address,
    required double lat,
    required double long,
    String category = '',
  }) async {
    if (name.trim().isEmpty || address.trim().isEmpty) {
      CommonWidgets.snackBarView(title: 'Name and address are required.');
      return;
    }
    saving.value = true;
    try {
      await _repository.savePlace(
        id: id,
        type: type,
        name: name.trim(),
        address: address.trim(),
        lat: lat,
        long: long,
        category: category,
      );
      savedPlaces.assignAll(await _repository.listSavedPlaces());
      CommonWidgets.snackBarView(title: 'Saved place updated', success: true);
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

  Future<void> _persistProfile(PassengerProfileModel? next) async {
    if (next == null) return;
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    await prefs.setString(ApiKeyConstants.fullName, next.fullName);
    await prefs.setString(ApiKeyConstants.phone, next.phone);
    await prefs.setString(ApiKeyConstants.countryCode, next.countryCode);
    await prefs.setString(ApiKeyConstants.profileImage, next.profileImageUrl);
  }
}
