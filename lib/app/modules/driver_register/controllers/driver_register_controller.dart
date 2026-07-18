import 'dart:async';
import 'dart:io';

import 'package:drewel/common/common_widgets.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../../common/image_pick_and_crop.dart';
import '../../../data/apis/api_constants/api_key_constants.dart';
import '../../../data/apis/api_methods/api_methods.dart';
import '../../../data/apis/api_models/get_add_driver_details_model.dart';
import '../../../routes/app_pages.dart';

class DriverRegisterController extends GetxController {
  final TextEditingController firstNameController = TextEditingController();
  final TextEditingController lastNameController = TextEditingController();
  final TextEditingController whatsappController = TextEditingController();
  final TextEditingController addressController = TextEditingController();
  final TextEditingController contractNumberController =
      TextEditingController();
  final TextEditingController licenseCompanyController =
      TextEditingController();
  final TextEditingController cityController = TextEditingController();
  final TextEditingController typeController = TextEditingController();

  final FocusNode firstNameFocus = FocusNode();
  final FocusNode lastNameFocus = FocusNode();
  final FocusNode whatsappFocus = FocusNode();
  final FocusNode addressFocus = FocusNode();
  final FocusNode contractFocus = FocusNode();
  final FocusNode licenseCompanyFocus = FocusNode();
  final FocusNode cityFocus = FocusNode();
  final FocusNode typeFocus = FocusNode();

  final RxString driverStatus = ''.obs;
  final RxString rejectionReason = ''.obs;
  final RxString profileRequestStatus = 'not_submitted'.obs;
  final RxString profileRejectionReason = ''.obs;
  final RxBool showStatusModal = false.obs;
  final RxBool showBasicLoading = false.obs;
  final RxBool showSubmitLoading = false.obs;
  final RxBool showStatusLoading = false.obs;
  final RxBool hasSubmittedRequest = false.obs;
  final RxInt refreshTick = 0.obs;
  final Map<String, String> _initialValues = <String, String>{};
  bool _initialValuesReady = false;

  Timer? _statusPollTimer;

  final List<File?> selectedFiles = List<File?>.filled(5, null);
  final List<String> existingFileUrls = List<String>.filled(5, '');

  final List<Map<String, String>> documentConfig = const <Map<String, String>>[
    {'label': 'License Car', 'key': ApiKeyConstants.licenseCar},
    {'label': 'License Driver', 'key': ApiKeyConstants.licenseDriver},
    {'label': 'Profile Image', 'key': ApiKeyConstants.profileImageField},
    {'label': 'ID Document', 'key': ApiKeyConstants.idDocument},
    {'label': 'Passport Copy', 'key': ApiKeyConstants.passportCopyField},
  ];

  bool get isPending => driverStatus.value == ApiKeyConstants.pending;
  bool get isApproved => driverStatus.value == ApiKeyConstants.approvedStatus;
  bool get isRejected => driverStatus.value == ApiKeyConstants.rejected;
  bool get isCompleted => driverStatus.value == ApiKeyConstants.completed;
  bool get isProfilePending => profileRequestStatus.value == 'pending';
  bool get isProfileApproved => profileRequestStatus.value == 'approved';
  bool get isProfileRejected => profileRequestStatus.value == 'rejected';
  bool get isProfileSubmitted => profileRequestStatus.value != 'not_submitted';
  bool get isProfileLocked =>
      !isApproved || isProfilePending || isProfileApproved;

  @override
  void onInit() {
    super.onInit();
    for (final TextEditingController textController in <TextEditingController>[
      firstNameController,
      lastNameController,
      whatsappController,
      addressController,
      contractNumberController,
      licenseCompanyController,
      cityController,
      typeController,
    ]) {
      textController.addListener(_notifyFormChanged);
    }
    _bootstrap();
  }

  void _notifyFormChanged() => refreshTick.value++;

  Map<String, String> get _currentValues => <String, String>{
        'firstName': firstNameController.text,
        'lastName': lastNameController.text,
        'whatsapp': whatsappController.text,
        'address': addressController.text,
        'contract': contractNumberController.text,
        'licenseCompany': licenseCompanyController.text,
        'city': cityController.text,
        'type': typeController.text,
      };

  bool get hasUnsavedChanges {
    if (!_initialValuesReady) return false;
    if (selectedFiles.any((File? file) => file != null)) return true;
    final Map<String, String> current = _currentValues;
    return current.entries.any(
      (MapEntry<String, String> entry) =>
          entry.value.trim() != (_initialValues[entry.key] ?? '').trim(),
    );
  }

  void _captureInitialValues() {
    _initialValues
      ..clear()
      ..addAll(_currentValues);
    _initialValuesReady = true;
    refreshTick.value++;
  }

  Future<void> _bootstrap() async {
    await _prefillFromSession();
    await loadDriverState(showPendingModal: true);
    _captureInitialValues();
    _statusPollTimer = Timer.periodic(
      const Duration(seconds: 15),
      (_) => refreshStatus(showModalOnPending: false),
    );
  }

  Future<void> _prefillFromSession() async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final String phone = prefs.getString(ApiKeyConstants.phone) ?? '';
    if (phone.isNotEmpty && whatsappController.text.trim().isEmpty) {
      whatsappController.text = phone;
    }
  }

  Future<void> loadDriverState({bool showPendingModal = false}) async {
    try {
      showStatusLoading.value = true;
      final SharedPreferences prefs = await SharedPreferences.getInstance();
      final String driverId = prefs.getString(ApiKeyConstants.userId) ?? '';
      if (driverId.isEmpty) return;

      final AddDriverDetailModel? model =
          await ApiMethods.getDriverDetailsApi(driverId: driverId);
      if (model?.success == true && model?.driver != null) {
        _applyDriverData(model!.driver!);
      }
      await refreshStatus(showModalOnPending: showPendingModal);
    } catch (_) {
      CommonWidgets.snackBarView(title: 'Unable to load driver status');
    } finally {
      showStatusLoading.value = false;
      refreshTick.value++;
    }
  }

  void _applyDriverData(Driver driver) {
    final String resolvedFirstName = (driver.firstName ?? '').trim().isNotEmpty
        ? (driver.firstName ?? '').trim()
        : _splitFullName(driver.fullName).$1;
    final String resolvedLastName = (driver.lastName ?? '').trim().isNotEmpty
        ? (driver.lastName ?? '').trim()
        : _splitFullName(driver.fullName).$2;

    if (resolvedFirstName.isNotEmpty) {
      firstNameController.text = resolvedFirstName;
    }
    if (resolvedLastName.isNotEmpty) {
      lastNameController.text = resolvedLastName;
    }

    if ((driver.whatsappNumber ?? '').trim().isNotEmpty) {
      whatsappController.text = (driver.whatsappNumber ?? '').trim();
    }
    addressController.text = driver.address ?? '';
    contractNumberController.text = driver.contractNumber ?? '';
    licenseCompanyController.text = driver.licenseCompany ?? '';
    cityController.text = driver.city ?? '';
    typeController.text = driver.vehicleType ?? '';

    existingFileUrls[0] =
        driver.licenseCarUrl ?? driver.carLicenseFrontUrl ?? '';
    existingFileUrls[1] =
        driver.licenseDriverUrl ?? driver.drivingLicenseFrontUrl ?? '';
    existingFileUrls[2] = driver.profileImageUrl ?? '';
    existingFileUrls[3] = driver.idDocumentUrl ?? driver.idProofFrontUrl ?? '';
    existingFileUrls[4] = driver.passportCopyUrl ?? '';

    profileRequestStatus.value =
        _normalizeProfileStatus(driver.profileRequestStatus);
    profileRejectionReason.value = driver.profileRejectionReason ?? '';

    final String resolvedStatus = _resolveStatus(
      driver.status,
      driver.isApproved,
    );
    if (resolvedStatus.isNotEmpty) {
      driverStatus.value = resolvedStatus;
      hasSubmittedRequest.value = true;
    }
    rejectionReason.value = driver.rejectionReason ?? '';
    _syncRouteWithDriverStatus();
  }

  String _normalizeStatus(String? status) {
    final String cleaned = (status ?? '').trim().toLowerCase();
    if (cleaned == ApiKeyConstants.pending) return ApiKeyConstants.pending;
    if (cleaned == ApiKeyConstants.approvedStatus) {
      return ApiKeyConstants.approvedStatus;
    }
    if (cleaned == ApiKeyConstants.rejected) return ApiKeyConstants.rejected;
    if (cleaned == ApiKeyConstants.completed) return ApiKeyConstants.completed;
    return '';
  }

  String _normalizeProfileStatus(String? status) {
    final String cleaned = (status ?? '').trim().toLowerCase();
    if (<String>{'pending', 'approved', 'rejected'}.contains(cleaned)) {
      return cleaned;
    }
    return 'not_submitted';
  }

  String _resolveStatus(String? status, bool? isApproved) {
    final String normalizedStatus = _normalizeStatus(status);
    if (normalizedStatus == ApiKeyConstants.completed) {
      return ApiKeyConstants.completed;
    }
    // Legacy admin builds can leave status as pending while isApproved is true.
    if (isApproved == true) return ApiKeyConstants.approvedStatus;
    if (normalizedStatus.isNotEmpty) return normalizedStatus;
    if (firstNameController.text.trim().isNotEmpty &&
        lastNameController.text.trim().isNotEmpty &&
        whatsappController.text.trim().isNotEmpty) {
      return ApiKeyConstants.pending;
    }
    return '';
  }

  (String, String) _splitFullName(String? fullName) {
    final String name = (fullName ?? '').trim();
    if (name.isEmpty) return ('', '');
    final List<String> parts = name.split(RegExp(r'\s+'));
    final String first = parts.first;
    final String last = parts.length > 1 ? parts.sublist(1).join(' ') : '';
    return (first, last);
  }

  void _syncRouteWithDriverStatus() {
    final String currentRoute = Get.currentRoute;
    if (isApproved && currentRoute == Routes.DRIVER_REGISTER) {
      Future<void>.microtask(() {
        if (Get.currentRoute == Routes.DRIVER_REGISTER) {
          Get.offNamed(Routes.DRIVER_COMPLETE_PROFILE);
        }
      });
      return;
    }

    if (isCompleted &&
        (currentRoute == Routes.DRIVER_REGISTER ||
            currentRoute == Routes.DRIVER_COMPLETE_PROFILE)) {
      Future<void>.microtask(() {
        final String currentStatus = Get.currentRoute;
        if (currentStatus == Routes.DRIVER_REGISTER ||
            currentStatus == Routes.DRIVER_COMPLETE_PROFILE) {
          Get.offNamed(Routes.DRIVER_HOME);
        }
      });
      return;
    }

    if ((isPending || isRejected) &&
        currentRoute == Routes.DRIVER_COMPLETE_PROFILE) {
      Future<void>.microtask(() {
        if (Get.currentRoute == Routes.DRIVER_COMPLETE_PROFILE) {
          Get.offNamed(Routes.DRIVER_REGISTER);
        }
      });
    }
  }

  Future<void> refreshStatus({bool showModalOnPending = false}) async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final String driverId = prefs.getString(ApiKeyConstants.userId) ?? '';
    if (driverId.isEmpty) return;

    final Map<String, dynamic>? statusResponse =
        await ApiMethods.getDriverStatusApi(driverId: driverId);
    if (statusResponse == null || statusResponse['success'] != true) return;

    String nextStatus = _normalizeStatus('${statusResponse['status'] ?? ''}');
    if (nextStatus.isEmpty && statusResponse['isProfileUnlocked'] == true) {
      nextStatus = ApiKeyConstants.approvedStatus;
    }
    if (nextStatus.isNotEmpty) {
      driverStatus.value = nextStatus;
      hasSubmittedRequest.value = true;
      await prefs.setString(ApiKeyConstants.driverStatus, nextStatus);
    }
    profileRequestStatus.value = _normalizeProfileStatus(
        '${statusResponse['profileRequestStatus'] ?? 'not_submitted'}');
    profileRejectionReason.value =
        '${statusResponse['profileRejectionReason'] ?? ''}'.trim();
    rejectionReason.value =
        '${statusResponse[ApiKeyConstants.rejectionReason] ?? ''}'.trim();

    if (showModalOnPending &&
        (isPending ||
            isRejected ||
            isCompleted ||
            isProfilePending ||
            isProfileRejected)) {
      showStatusModal.value = true;
    }
    _syncRouteWithDriverStatus();
    refreshTick.value++;
  }

  Future<void> submitBasicRequest() async {
    final String firstName = firstNameController.text.trim();
    final String lastName = lastNameController.text.trim();
    final String whatsapp = whatsappController.text.trim();
    if (firstName.isEmpty || lastName.isEmpty || whatsapp.isEmpty) {
      CommonWidgets.snackBarView(
        title: 'First name, last name and WhatsApp number are required',
      );
      return;
    }

    try {
      showBasicLoading.value = true;
      final Map<String, dynamic> body = <String, dynamic>{
        ApiKeyConstants.firstName: firstName,
        ApiKeyConstants.lastName: lastName,
        ApiKeyConstants.whatsappNumberField: whatsapp,
      };

      final AddDriverDetailModel? response =
          await ApiMethods.driverRequestApi(bodyParams: body);
      if (response?.success == true) {
        hasSubmittedRequest.value = true;
        driverStatus.value = ApiKeyConstants.pending;
        showStatusModal.value = true;
        await loadDriverState();
        _captureInitialValues();
      } else {
        CommonWidgets.snackBarView(
          title: response?.message ?? 'Failed to send request',
        );
      }
    } catch (_) {
      CommonWidgets.snackBarView(title: 'Failed to send request');
    } finally {
      showBasicLoading.value = false;
    }
  }

  Future<void> pickDocument(int index) async {
    final File? file = await ImagePickerAndCropper.pickImage(
      context: Get.context!,
      wantCropper: true,
      color: Theme.of(Get.context!).primaryColor,
    );
    if (file != null) {
      selectedFiles[index] = file;
      refreshTick.value++;
    }
  }

  Future<void> submitCompleteProfile() async {
    if (!isApproved || isProfilePending) {
      CommonWidgets.snackBarView(
          title: isProfilePending
              ? 'Request 2 is already waiting for admin approval'
              : 'Profile is locked until Request 1 is approved');
      return;
    }

    final String firstName = firstNameController.text.trim();
    final String lastName = lastNameController.text.trim();
    final String address = addressController.text.trim();
    final String contractNumber = contractNumberController.text.trim();
    final String licenseCompany = licenseCompanyController.text.trim();
    final String city = cityController.text.trim();
    final String vehicleType = typeController.text.trim();

    if (firstName.isEmpty || lastName.isEmpty) {
      CommonWidgets.snackBarView(
        title: 'First name and last name are required',
      );
      return;
    }

    if (address.isEmpty || contractNumber.isEmpty || licenseCompany.isEmpty) {
      CommonWidgets.snackBarView(
        title: 'Address, contract number and license company are required',
      );
      return;
    }

    for (int i = 0; i < documentConfig.length; i++) {
      if (selectedFiles[i] == null && existingFileUrls[i].trim().isEmpty) {
        CommonWidgets.snackBarView(
          title: '${documentConfig[i]['label']} is required',
        );
        return;
      }
    }

    try {
      showSubmitLoading.value = true;
      final SharedPreferences prefs = await SharedPreferences.getInstance();
      final String driverId = prefs.getString(ApiKeyConstants.userId) ?? '';
      if (driverId.isEmpty) {
        CommonWidgets.snackBarView(
            title: 'Session expired. Please login again');
        return;
      }

      final List<File?> images = <File?>[];
      final List<String> imageKeys = <String>[];
      for (int i = 0; i < selectedFiles.length; i++) {
        if (selectedFiles[i] != null) {
          images.add(selectedFiles[i]);
          imageKeys.add(documentConfig[i]['key']!);
        }
      }

      final Map<String, dynamic> body = <String, dynamic>{
        ApiKeyConstants.firstName: firstName,
        ApiKeyConstants.lastName: lastName,
        ApiKeyConstants.address: address,
        ApiKeyConstants.contractNumber: contractNumber,
        ApiKeyConstants.licenseCompanyField: licenseCompany,
        ApiKeyConstants.city: city,
        'vehicle_type': vehicleType,
      };

      final AddDriverDetailModel? response =
          await ApiMethods.completeDriverProfileApi(
        driverId: driverId,
        bodyParams: body,
        imageList: images,
        imageKeyList: imageKeys,
      );

      if (response?.success == true) {
        // Uploading documents submits Request 2; it does not approve it.
        driverStatus.value = ApiKeyConstants.approvedStatus;
        profileRequestStatus.value = 'pending';
        profileRejectionReason.value = '';
        showStatusModal.value = true;
        await loadDriverState();
        _captureInitialValues();
      } else {
        final String message = (response?.message ?? '').trim();
        CommonWidgets.snackBarView(
          title: message.isNotEmpty
              ? message
              : 'Failed to submit documents. Please check internet/CORS and try again.',
        );
      }
    } catch (e) {
      CommonWidgets.snackBarView(
        title: 'Failed to submit documents: ${e.toString()}',
      );
    } finally {
      showSubmitLoading.value = false;
    }
  }

  void openStatusModal() {
    showStatusModal.value = true;
  }

  void closeStatusModal() {
    showStatusModal.value = false;
    _syncRouteWithDriverStatus();
  }

  String get statusTitle {
    if (isProfilePending) return 'Request 2 Submitted';
    if (isProfileRejected) return 'Request 2 Needs Changes';
    if (isPending) return 'Registration Submitted';
    if (isRejected) return 'Request Rejected';
    if (isCompleted) return 'Profile Completed';
    if (isApproved) return 'Approved';
    return 'Driver Verification';
  }

  String get statusMessage {
    if (isProfilePending) {
      return 'Your profile and documents were sent for Approval 2. You can access driver services after the admin approves them.';
    }
    if (isProfileRejected) {
      final String reason = profileRejectionReason.value.trim();
      return reason.isNotEmpty
          ? 'Request 2 was rejected. Please correct and resubmit your profile. Reason: $reason'
          : 'Request 2 was rejected. Please correct and resubmit your profile and documents.';
    }
    if (isPending) {
      return 'Your request has been sent to admin for review. You will be able to complete your profile after approval.';
    }
    if (isRejected) {
      final String reason = rejectionReason.value.trim();
      if (reason.isNotEmpty) {
        return 'Your request was not approved. Reason: $reason';
      }
      return 'Your request was not approved. Please contact support.';
    }
    if (isCompleted) {
      return 'Approval 1 and Approval 2 are complete. Your driver account is active.';
    }
    if (isApproved) {
      return 'Your request is approved. Please complete your profile.';
    }
    return '';
  }

  @override
  void onClose() {
    _statusPollTimer?.cancel();
    firstNameController.dispose();
    lastNameController.dispose();
    whatsappController.dispose();
    addressController.dispose();
    contractNumberController.dispose();
    licenseCompanyController.dispose();
    cityController.dispose();
    typeController.dispose();
    firstNameFocus.dispose();
    lastNameFocus.dispose();
    whatsappFocus.dispose();
    addressFocus.dispose();
    contractFocus.dispose();
    licenseCompanyFocus.dispose();
    cityFocus.dispose();
    typeFocus.dispose();
    super.onClose();
  }
}
