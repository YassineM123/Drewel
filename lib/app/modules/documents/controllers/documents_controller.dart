import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:image_picker/image_picker.dart';
import 'package:responsive_sizer/responsive_sizer.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../../common/common_widgets.dart';
import '../../../../common/image_pick_and_crop.dart';
import '../../../../common/local_data.dart';
import '../../../../common/text_styles.dart';
import '../../../data/apis/api_constants/api_key_constants.dart';
import '../../../data/apis/api_methods/api_methods.dart';
import '../../../data/apis/api_models/get_add_driver_details_model.dart';
import '../../../data/constants/string_constants.dart';
import '../../driver_home/controllers/driver_home_controller.dart';

class DocumentsController extends GetxController {
  TextEditingController cityController = TextEditingController();
  TextEditingController typeController = TextEditingController();
  FocusNode focusNodeCity = FocusNode();
  FocusNode focusNodeType = FocusNode();
  final isType = false.obs;
  final isCity = false.obs;

  void startListener() {
    focusNodeCity.addListener(onFocusChange);
    focusNodeType.addListener(onFocusChange);
  }

  void onFocusChange() {
    isCity.value = focusNodeCity.hasFocus;
    isType.value = focusNodeType.hasFocus;
  }

  final count = 0.obs;
  final showLoading = false.obs;
  final isLoadingDetails = true.obs;
  final loadError = ''.obs;
  final countryDailCode = '+971'.obs;
  final whatsappCountryCode = '+971'.obs;

  AddDriverDetailModel? driverDetail;
  final hasPendingApproval = false.obs;
  final pendingApprovalMessage = ''.obs;
  final RxList<String> pendingApprovalItems = <String>[].obs;

  // Document uploads: 9 total (same as driver register)
  // 0: Car License Front, 1: Car License Back
  // 2: Driver License Front, 3: Driver License Back
  // 4: ID Proof Front, 5: ID Proof Back
  // 6: Profile Image, 7: Passport Copy, 8: License Company
  List<File?> selectedFile = List.filled(9, null);
  List<Uint8List?> selectedPreviewBytes = List.filled(9, null);
  List<String> documentUrl = List.filled(9, '');

  bool get isBasicRequestApproved {
    final driver = driverDetail?.driver;
    final status = (driver?.status ?? '').toLowerCase();
    return status == 'approved' ||
        status == 'completed' ||
        driver?.isApproved == true;
  }

  bool get isProfileRequestPending =>
      (driverDetail?.driver?.profileRequestStatus ?? '').toLowerCase() ==
      'pending';

  bool get canEditProfile => isBasicRequestApproved && !isProfileRequestPending;

  bool get canSubmit =>
      canEditProfile &&
      !isLoadingDetails.value &&
      !showLoading.value &&
      hasUnsavedChanges;

  String get profileLockMessage {
    final driver = driverDetail?.driver;
    if (isProfileRequestPending) {
      return 'Your profile and documents are waiting for admin approval.';
    }
    if ((driver?.status ?? '').toLowerCase() == 'rejected') {
      return 'Request 1 was rejected. Ask an administrator to reopen it before editing your documents.';
    }
    return 'Request 1 must be approved by an administrator before you can submit profile documents.';
  }

  bool get hasUnsavedChanges {
    if (selectedFile.any((File? file) => file != null)) return true;
    final driver = driverDetail?.driver;
    if (driver == null) return false;
    return cityController.text.trim() != (driver.city ?? '').trim() ||
        typeController.text.trim() != (driver.vehicleType ?? '').trim();
  }

  List<Map<String, dynamic>> fileNameList = [
    {
      'name': 'Car License - Front',
      'key': ApiKeyConstants.carLicenseFront,
      'isBack': false
    },
    {
      'name': 'Car License - Back',
      'key': ApiKeyConstants.carLicenseBack,
      'isBack': true
    },
    {
      'name': 'Driver License - Front',
      'key': ApiKeyConstants.drivingLicenseFront,
      'isBack': false
    },
    {
      'name': 'Driver License - Back',
      'key': ApiKeyConstants.drivingLicenseBack,
      'isBack': true
    },
    {
      'name': 'ID Proof - Front',
      'key': ApiKeyConstants.idProofFront,
      'isBack': false
    },
    {
      'name': 'ID Proof - Back',
      'key': ApiKeyConstants.idProofBack,
      'isBack': true
    },
    {
      'name': 'Profile Image',
      'key': ApiKeyConstants.profileImage,
      'isBack': false
    },
    {
      'name': 'Passport Copy',
      'key': ApiKeyConstants.passportCopy,
      'isBack': false
    },
    {
      'name': 'License Company',
      'key': ApiKeyConstants.licenseCompany,
      'isBack': false
    },
  ];
  @override
  void onInit() {
    super.onInit();
    startListener();
    // Ensure no stale document selections from previous sessions
    selectedFile = List.filled(9, null);
    selectedPreviewBytes = List.filled(9, null);
    documentUrl = List.filled(9, '');
    callingGetDriverDetails();
  }

  void increment() => count.value++;

  Future<void> showAlertDialog(int index) async {
    if (!canEditProfile) {
      CommonWidgets.snackBarView(title: profileLockMessage);
      return;
    }
    final file = await ImagePickerAndCropper.pickImage(
      context: Get.context!,
      wantCropper: true,
      color: Theme.of(Get.context!).primaryColor,
    );
    if (file == null) return;
    try {
      selectedFile[index] = file;
      selectedPreviewBytes[index] = kIsWeb
          ? await XFile(file.path).readAsBytes()
          : await file.readAsBytes();
      increment();
    } catch (_) {
      selectedFile[index] = null;
      selectedPreviewBytes[index] = null;
      CommonWidgets.snackBarView(
        title: 'The selected image could not be read. Please choose another.',
      );
    }
  }

  bool isDocumentPresent(int index) =>
      selectedFile[index] != null || documentUrl[index].trim().isNotEmpty;

  bool isBackRequired(int index) {
    const backToFront = <int, int>{1: 0, 3: 2, 5: 4};
    final frontIndex = backToFront[index];
    return frontIndex != null &&
        selectedFile[frontIndex] != null &&
        !isDocumentPresent(index);
  }

  bool isPendingDocument(int index) {
    if (!isProfileRequestPending) return false;
    final logs = driverDetail?.driver?.driverLogs;
    if (logs == null) return false;
    final pendingUrls = <String?>[
      logs.carLicenseFrontUrl,
      logs.carLicenseBackUrl,
      logs.drivingLicenseFrontUrl,
      logs.drivingLicenseBackUrl,
      logs.idProofFrontUrl,
      logs.idProofBackUrl,
      logs.profileImageUrl,
      logs.passportCopyUrl,
      logs.licenseCompanyUrl,
    ];
    return (pendingUrls[index] ?? '').trim().isNotEmpty;
  }

  Future<void> callingGetDriverDetails() async {
    if (isLoadingDetails.value && driverDetail != null) return;
    isLoadingDetails.value = true;
    loadError.value = '';
    try {
      SharedPreferences pref = await SharedPreferences.getInstance();
      String driverId = pref.getString(ApiKeyConstants.userId) ?? '';
      AddDriverDetailModel? loginModel =
          await ApiMethods.getDriverDetailsApi(driverId: driverId).timeout(
        const Duration(seconds: 20),
      );
      if (loginModel != null &&
          loginModel.success != null &&
          loginModel.success! &&
          loginModel.driver != null) {
        driverDetail = loginModel;
        cityController.text = driverDetail?.driver?.city ?? '';
        typeController.text = driverDetail?.driver?.vehicleType ?? '';

        // Set country codes from driver details
        countryDailCode.value = driverDetail?.driver?.countryCode ?? '+971';
        // Extract whatsapp country code if available
        String whatsapp = driverDetail?.driver?.whatsappNumber ?? '';
        if (whatsapp.startsWith('+')) {
          // Try to extract country code (assuming it's before the main number)
          whatsappCountryCode.value =
              driverDetail?.driver?.countryCode ?? '+971';
        }

        // Document URLs mapping (9 total - matching driver register structure)
        // Index 0: Car License Front, 1: Car License Back
        // Index 2: Driver License Front, 3: Driver License Back
        // Index 4: ID Proof Front, 5: ID Proof Back
        // Index 6: Profile Image, 7: Passport Copy, 8: License Company
        final driver = driverDetail!.driver!;
        final logs = driver.driverLogs;
        final usePending = isProfileRequestPending && logs != null;
        String resolved(String? approved, String? pending) {
          final pendingValue = (pending ?? '').trim();
          return usePending && pendingValue.isNotEmpty
              ? pendingValue
              : (approved ?? '').trim();
        }

        documentUrl[0] = resolved(
          driver.carLicenseFrontUrl ?? driver.carLicenseUrl,
          logs?.carLicenseFrontUrl,
        );
        documentUrl[1] =
            resolved(driver.carLicenseBackUrl, logs?.carLicenseBackUrl);
        documentUrl[2] = resolved(
          driver.drivingLicenseFrontUrl ?? driver.drivingLicenseUrl,
          logs?.drivingLicenseFrontUrl,
        );
        documentUrl[3] =
            resolved(driver.drivingLicenseBackUrl, logs?.drivingLicenseBackUrl);
        documentUrl[4] = resolved(
          driver.idProofFrontUrl ?? driver.idProofUrl,
          logs?.idProofFrontUrl,
        );
        documentUrl[5] = resolved(driver.idProofBackUrl, logs?.idProofBackUrl);
        documentUrl[6] =
            resolved(driver.profileImageUrl, logs?.profileImageUrl);
        documentUrl[7] =
            resolved(driver.passportCopyUrl, logs?.passportCopyUrl);
        documentUrl[8] =
            resolved(driver.licenseCompanyUrl, logs?.licenseCompanyUrl);
        _evaluatePendingApprovalStatus();
      } else {
        loadError.value =
            loginModel?.message ?? 'Unable to load your driver profile.';
      }
    } catch (_) {
      loadError.value =
          'Check your internet connection, then try loading the page again.';
    } finally {
      isLoadingDetails.value = false;
      increment();
    }
  }

  bool _fieldEquals(String? a, String? b) =>
      (a ?? '').trim() == (b ?? '').trim();

  /// Compare main driver data vs driverLogs and approval flags
  void _evaluatePendingApprovalStatus() {
    final driver = driverDetail?.driver;
    final logs = driver?.driverLogs;

    if (driver == null || logs == null) {
      hasPendingApproval.value = false;
      pendingApprovalMessage.value = '';
      pendingApprovalItems.clear();
      return;
    }

    final bool mainApproved = driver.isApproved ?? false;
    final bool logsApproved = logs.isApproved ?? false;

    // If both main and logs are approved, nothing is pending
    if (mainApproved && logsApproved) {
      hasPendingApproval.value = false;
      pendingApprovalMessage.value = '';
      pendingApprovalItems.clear();
      return;
    }

    // Collect only the fields that are managed from the documents screen
    // and are not yet approved
    final List<String> items = [];

    // City (from documents/profile screen)
    if (!_fieldEquals(driver.city, logs.city)) {
      items.add('City');
    }
    // Vehicle type (from documents/profile screen)
    if (!_fieldEquals(driver.vehicleType, logs.vehicleType)) {
      items.add('Vehicle type');
    }
    // License company document
    if (!_fieldEquals(driver.licenseCompanyUrl, logs.licenseCompanyUrl)) {
      items.add('License company document');
    }
    // Car license (front/back pair)
    if (!_fieldEquals(driver.carLicenseFrontUrl, logs.carLicenseFrontUrl) ||
        !_fieldEquals(driver.carLicenseBackUrl, logs.carLicenseBackUrl)) {
      items.add('Car license');
    }
    // Driving license (front/back pair)
    if (!_fieldEquals(
            driver.drivingLicenseFrontUrl, logs.drivingLicenseFrontUrl) ||
        !_fieldEquals(
            driver.drivingLicenseBackUrl, logs.drivingLicenseBackUrl)) {
      items.add('Driving license');
    }
    // ID proof (front/back pair)
    if (!_fieldEquals(driver.idProofFrontUrl, logs.idProofFrontUrl) ||
        !_fieldEquals(driver.idProofBackUrl, logs.idProofBackUrl)) {
      items.add('ID proof');
    }
    // Passport copy
    if (!_fieldEquals(driver.passportCopyUrl, logs.passportCopyUrl)) {
      items.add('Passport copy');
    }
    // Profile image (also updated from documents section)
    if (!_fieldEquals(driver.profileImageUrl, logs.profileImageUrl)) {
      items.add('Profile image');
    }
    hasPendingApproval.value =
        (!mainApproved || !logsApproved) && items.isNotEmpty;
    if (hasPendingApproval.value) {
      pendingApprovalMessage.value =
          'Your recent changes have been sent for approval and will be updated once approved by the admin.';
      pendingApprovalItems
        ..clear()
        ..addAll(items);
    } else {
      // If nothing from the documents section is pending, clear the banner
      hasPendingApproval.value = false;
      pendingApprovalMessage.value = '';
      pendingApprovalItems.clear();
    }
  }

  Future<void> clickOnSubmit(BuildContext context) async {
    if (showLoading.value) return;
    if (!canEditProfile) {
      CommonWidgets.snackBarView(title: profileLockMessage);
      return;
    }
    if (!hasUnsavedChanges) {
      CommonWidgets.snackBarView(title: 'There are no changes to update.');
      return;
    }
    final city = cityController.text.trim();
    final vehicleType = typeController.text.trim();
    if (city.isNotEmpty && vehicleType.isNotEmpty) {
      // Validate paired documents: If front is updated, back is required
      // Pairs: [0,1] Car License, [2,3] Driver License, [4,5] ID Proof
      bool pairedDocsValid = true;
      List<String> missingBackDocs = [];

      // Car License pair (index 0 = front, index 1 = back)
      // If new front is uploaded, back must exist OR be newly uploaded
      if (selectedFile[0] != null && !isDocumentPresent(1)) {
        pairedDocsValid = false;
        missingBackDocs.add('Car License Back');
      }

      // Driver License pair (index 2 = front, index 3 = back)
      if (selectedFile[2] != null && !isDocumentPresent(3)) {
        pairedDocsValid = false;
        missingBackDocs.add('Driver License Back');
      }

      // ID Proof pair (index 4 = front, index 5 = back)
      if (selectedFile[4] != null && !isDocumentPresent(5)) {
        pairedDocsValid = false;
        missingBackDocs.add('ID Proof Back');
      }

      if (!pairedDocsValid) {
        CommonWidgets.snackBarView(
            title: 'Please upload: ${missingBackDocs.join(', ')}');
        return;
      }

      try {
        showLoading.value = true;

        SharedPreferences sp = await SharedPreferences.getInstance();
        String driverId = sp.getString(ApiKeyConstants.userId) ??
            driverDetail?.driver?.sId ??
            '';

        Map<String, String> bodyParams = {
          ApiKeyConstants.id: driverId,
          ApiKeyConstants.city: city,
          ApiKeyConstants.vehicleType: vehicleType,
        };

        // Build image list from fileNameList keys
        List<File?> imagesToSend = [];
        List<String> imageKeysToSend = [];

        for (int i = 0; i < selectedFile.length; i++) {
          // Only add if a new image was selected
          if (selectedFile[i] != null) {
            imagesToSend.add(selectedFile[i]);
            imageKeysToSend.add(fileNameList[i]['key']);
          }
        }

        AddDriverDetailModel? addDriverDetailModel =
            await ApiMethods.driverUpdateDetailsApi(
                bodyParams: bodyParams,
                imageList: imagesToSend,
                imageKeyList: imageKeysToSend);

        if (addDriverDetailModel != null &&
            addDriverDetailModel.success != null &&
            addDriverDetailModel.success! &&
            addDriverDetailModel.driver != null) {
          // Clear local previews before refreshing the authoritative state.
          selectedFile = List.filled(9, null);
          selectedPreviewBytes = List.filled(9, null);
          increment();

          // Refresh driver details to get updated data
          await callingGetDriverDetails();

          // Update driver home controller's userData if it exists
          await _updateDriverHomeUserData();

          CommonWidgets.snackBarView(
            title:
                'Your updated documents have been sent to the admin for approval.',
            success: true,
          );
        } else {
          CommonWidgets.snackBarView(
              title:
                  addDriverDetailModel?.message ?? 'Driver Details Failed ...');
        }
      } catch (e) {
        CommonWidgets.snackBarView(
          title: 'The update could not be completed. Please try again.',
        );
      } finally {
        showLoading.value = false;
        increment();
      }
    } else {
      CommonWidgets.snackBarView(title: 'Select a city and vehicle type.');
    }
  }

  /// Update driver home controller's userData with latest profile info
  Future<void> _updateDriverHomeUserData() async {
    try {
      // Check if DriverHomeController is registered
      if (Get.isRegistered<DriverHomeController>()) {
        final driverHomeController = Get.find<DriverHomeController>();
        if (driverDetail?.driver != null) {
          driverHomeController.userData.value = {
            ApiKeyConstants.phone: driverDetail!.driver!.phone ?? '',
            ApiKeyConstants.countryCode:
                driverDetail!.driver!.countryCode ?? '',
            ApiKeyConstants.profileImage:
                driverDetail!.driver!.profileImageUrl ?? '',
            ApiKeyConstants.fullName: driverDetail!.driver!.fullName ?? '',
            ApiKeyConstants.type: ApiKeyConstants.driver,
          };
        }
      }
    } catch (e) {
      debugPrint('Unable to refresh the driver home profile: $e');
    }
  }

  void openCityButtonSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(10.0)),
      ),
      backgroundColor: Colors.white,
      builder: (BuildContext context) {
        return Padding(
          padding: EdgeInsets.symmetric(horizontal: 15.px, vertical: 10.px),
          child: SingleChildScrollView(
            child: Column(
              children: [
                Center(
                    child: Text(
                  StringConstants.selectCity,
                  style: MyTextStyle.titleStyle18bb,
                )),
                ListView.builder(
                    shrinkWrap: true,
                    itemCount: LocalData().cityList.length,
                    physics: const NeverScrollableScrollPhysics(),
                    itemBuilder: (context, index) {
                      return GestureDetector(
                        onTap: () {
                          cityController.text = LocalData()
                              .cityList[index]
                              .replaceAll('\n', '')
                              .trim();
                          increment();
                          Get.back();
                        },
                        child: Container(
                          margin: EdgeInsets.symmetric(vertical: 5.px),
                          padding: EdgeInsets.symmetric(
                              horizontal: 15.px, vertical: 10.px),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(10.px),
                            border: Border.all(
                                color: Colors.black.withValues(alpha: 0.4)),
                          ),
                          child: Text(
                            LocalData()
                                .cityList[index]
                                .replaceAll('\n', '')
                                .trim(),
                            style: MyTextStyle.titleStyle16bb,
                          ),
                        ),
                      );
                    }),
              ],
            ),
          ),
        );
      },
    );
  }

  void openvehicleTypeButtonSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(10.0)),
      ),
      backgroundColor: Colors.white,
      builder: (BuildContext context) {
        return Padding(
          padding: EdgeInsets.symmetric(horizontal: 15.px, vertical: 10.px),
          child: SingleChildScrollView(
            child: Column(
              children: [
                Center(
                    child: Text(
                  StringConstants.selectvehicleType,
                  style: MyTextStyle.titleStyle18bb,
                )),
                ListView.builder(
                    shrinkWrap: true,
                    itemCount: LocalData().transportList.length,
                    physics: const NeverScrollableScrollPhysics(),
                    itemBuilder: (context, index) {
                      return GestureDetector(
                        onTap: () {
                          typeController.text = LocalData()
                              .transportList[index]['name']
                              .toString()
                              .trim();
                          Get.back();
                          increment(); // Trigger UI update
                        },
                        child: Container(
                          margin: EdgeInsets.symmetric(vertical: 5.px),
                          padding: EdgeInsets.symmetric(
                              horizontal: 15.px, vertical: 10.px),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(10.px),
                            border: Border.all(
                                color: Colors.black.withValues(alpha: 0.4)),
                          ),
                          child: Row(
                            children: [
                              CommonWidgets.appIcons(
                                  assetName: LocalData().transportList[index]
                                          ['image'] ??
                                      '',
                                  height: 35.px,
                                  width: 35.px,
                                  color: Colors.black87),
                              SizedBox(
                                width: 10.px,
                              ),
                              Text(
                                LocalData()
                                    .transportList[index]['name']
                                    .toString(),
                                style: MyTextStyle.titleStyle16bb,
                              ),
                            ],
                          ),
                        ),
                      );
                    }),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  void onClose() {
    focusNodeCity.removeListener(onFocusChange);
    focusNodeType.removeListener(onFocusChange);
    focusNodeCity.dispose();
    focusNodeType.dispose();
    cityController.dispose();
    typeController.dispose();
    super.onClose();
  }
}
