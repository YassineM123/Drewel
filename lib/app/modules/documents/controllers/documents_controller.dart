import 'dart:io';

import 'package:flutter/material.dart';
import 'package:get/get.dart';
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
  List<String> documentUrl = List.filled(9, '');

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
      'requiresBack': true,
      'isBack': false
    },
    {
      'name': 'Car License - Back',
      'key': ApiKeyConstants.carLicenseBack,
      'requiresBack': false,
      'isBack': true
    },
    {
      'name': 'Driver License - Front',
      'key': ApiKeyConstants.drivingLicenseFront,
      'requiresBack': true,
      'isBack': false
    },
    {
      'name': 'Driver License - Back',
      'key': ApiKeyConstants.drivingLicenseBack,
      'requiresBack': false,
      'isBack': true
    },
    {
      'name': 'ID Proof - Front',
      'key': ApiKeyConstants.idProofFront,
      'requiresBack': true,
      'isBack': false
    },
    {
      'name': 'ID Proof - Back',
      'key': ApiKeyConstants.idProofBack,
      'requiresBack': false,
      'isBack': true
    },
    {
      'name': 'Profile Image',
      'key': ApiKeyConstants.profileImage,
      'requiresBack': false,
      'isBack': false
    },
    {
      'name': 'Passport Copy',
      'key': ApiKeyConstants.passportCopy,
      'requiresBack': false,
      'isBack': false
    },
    {
      'name': 'License Company',
      'key': ApiKeyConstants.licenseCompany,
      'requiresBack': false,
      'isBack': false
    },
  ];
  @override
  void onInit() async {
    super.onInit();
    startListener();
    // Ensure no stale document selections from previous sessions
    selectedFile = List.filled(9, null);
    documentUrl = List.filled(9, '');
    callingGetDriverDetails();
  }

  void increment() => count.value++;

  void showAlertDialog(int index) async {
    selectedFile[index] = await ImagePickerAndCropper.pickImage(
      context: Get.context!,
      wantCropper: true,
      color: Theme.of(Get.context!).primaryColor,
    );
    increment();
  }

  Future<void> callingGetDriverDetails() async {
    print('start driver details.......');
    try {
      SharedPreferences pref = await SharedPreferences.getInstance();
      String driverId = pref.getString(ApiKeyConstants.userId) ?? '';
      AddDriverDetailModel? loginModel =
          await ApiMethods.getDriverDetailsApi(driverId: driverId);
      if (loginModel != null &&
          loginModel.success != null &&
          loginModel.success! &&
          loginModel.driver != null) {
        print('get driver details successfully completed....');
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
        documentUrl[0] = driverDetail?.driver?.carLicenseFrontUrl ??
            driverDetail?.driver?.carLicenseUrl ??
            '';
        documentUrl[1] = driverDetail?.driver?.carLicenseBackUrl ?? '';
        documentUrl[2] = driverDetail?.driver?.drivingLicenseFrontUrl ??
            driverDetail?.driver?.drivingLicenseUrl ??
            '';
        documentUrl[3] = driverDetail?.driver?.drivingLicenseBackUrl ?? '';
        documentUrl[4] = driverDetail?.driver?.idProofFrontUrl ??
            driverDetail?.driver?.idProofUrl ??
            '';
        documentUrl[5] = driverDetail?.driver?.idProofBackUrl ?? '';
        documentUrl[6] = driverDetail?.driver?.profileImageUrl ?? '';
        documentUrl[7] = driverDetail?.driver?.passportCopyUrl ?? '';
        documentUrl[8] = driverDetail?.driver?.licenseCompanyUrl ?? '';
        _evaluatePendingApprovalStatus();
        increment();
      } else {
        CommonWidgets.snackBarView(
            title: loginModel?.message ?? 'Get driver data Failed ...');
      }
    } catch (e) {
      CommonWidgets.snackBarView(title: 'Somethings wrong...');
    }
    increment();
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
    if (cityController.text.isNotEmpty && typeController.text.isNotEmpty) {
      // Validate paired documents: If front is updated, back is required
      // Pairs: [0,1] Car License, [2,3] Driver License, [4,5] ID Proof
      bool pairedDocsValid = true;
      List<String> missingBackDocs = [];

      // Car License pair (index 0 = front, index 1 = back)
      // If new front is uploaded, back must exist OR be newly uploaded
      if (selectedFile[0] != null &&
          selectedFile[1] == null &&
          documentUrl[1].isEmpty) {
        pairedDocsValid = false;
        missingBackDocs.add('Car License Back');
      }

      // Driver License pair (index 2 = front, index 3 = back)
      if (selectedFile[2] != null &&
          selectedFile[3] == null &&
          documentUrl[3].isEmpty) {
        pairedDocsValid = false;
        missingBackDocs.add('Driver License Back');
      }

      // ID Proof pair (index 4 = front, index 5 = back)
      if (selectedFile[4] != null &&
          selectedFile[5] == null &&
          documentUrl[5].isEmpty) {
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

        // Include all existing driver data to prevent overwriting
        SharedPreferences sp = await SharedPreferences.getInstance();
        String driverId = sp.getString(ApiKeyConstants.userId) ??
            driverDetail?.driver?.sId ??
            '';

        // Get phone number without country code
        String phoneNumber = sp.getString(ApiKeyConstants.phone) ??
            driverDetail?.driver?.phone ??
            '';

        // Build whatsapp number with country code
        String whatsappNumber = driverDetail?.driver?.whatsappNumber ?? '';

        Map<String, String> bodyParams = {
          // Driver ID - required for update
          ApiKeyConstants.id: driverId,
          // Matching driver register fields
          ApiKeyConstants.countryCode: countryDailCode.value,
          ApiKeyConstants.fullName: driverDetail?.driver?.fullName ?? '',
          ApiKeyConstants.phone: phoneNumber,
          ApiKeyConstants.whatsappNumber: whatsappNumber,
          ApiKeyConstants.address: driverDetail?.driver?.address ?? '',
          // Updated fields
          ApiKeyConstants.city: cityController.text,
          ApiKeyConstants.vehicleType: typeController.text,
          // Location coordinates
          ApiKeyConstants.lat: driverDetail?.driver?.lat?.toString() ?? '0',
          ApiKeyConstants.long: driverDetail?.driver?.long?.toString() ?? '0',
        };

        // Debug logging
        print('=== UPDATE DOCUMENTS DEBUG ===');
        print('Driver ID: $driverId');
        print('Country Code: ${countryDailCode.value}');
        print('City: ${cityController.text}');
        print('Vehicle Type: ${typeController.text}');
        print('Full bodyParams: $bodyParams');
        print('==============================');

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

        print('Images to send: ${imageKeysToSend.length}');

        // Use the update API method
        AddDriverDetailModel? addDriverDetailModel =
            await ApiMethods.driverUpdateDetailsApi(
                bodyParams: bodyParams,
                imageList: imagesToSend,
                imageKeyList: imageKeysToSend);

        // Debug: Print server response
        print('=== SERVER RESPONSE ===');
        print('Success: ${addDriverDetailModel?.success}');
        print('Message: ${addDriverDetailModel?.message}');
        print(
            'Driver vehicle type from response: ${addDriverDetailModel?.driver?.vehicleType}');
        print('========================');

        if (addDriverDetailModel != null &&
            addDriverDetailModel.success != null &&
            addDriverDetailModel.success! &&
            addDriverDetailModel.driver != null) {
          print('update document successfully completed ....');

          // Refresh driver details to get updated data
          await callingGetDriverDetails();

          // Update driver home controller's userData if it exists
          await _updateDriverHomeUserData();

          // Clear selected files after successful upload
          selectedFile = List.filled(9, null);

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
        showLoading.value = false;
        print("Error:----${e.toString()}");
        CommonWidgets.snackBarView(title: 'Somethings wrong...');
      }
      showLoading.value = false;
    } else {
      CommonWidgets.snackBarView(title: 'Select city and vehicle type ...');
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
          print('Driver home userData updated with new profile image');
        }
      }
    } catch (e) {
      print('Error updating driver home userData: $e');
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
                          Get.back();
                        },
                        child: Container(
                          margin: EdgeInsets.symmetric(vertical: 5.px),
                          padding: EdgeInsets.symmetric(
                              horizontal: 15.px, vertical: 10.px),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(10.px),
                            border: Border.all(
                                color: Colors.black.withOpacity(0.4)),
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
                          print(
                              'Selected vehicle type: ${typeController.text}');
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
                                color: Colors.black.withOpacity(0.4)),
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
}
