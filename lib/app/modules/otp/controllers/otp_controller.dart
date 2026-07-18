import 'package:drewel/app/data/apis/api_constants/api_key_constants.dart';
import 'package:drewel/app/data/apis/api_models/get_login_model.dart';
import 'package:drewel/app/data/constants/string_constants.dart';
import 'package:drewel/app/routes/app_pages.dart';
import 'package:drewel/common/text_styles.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:responsive_sizer/responsive_sizer.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../../common/common_widgets.dart';
import '../../../data/apis/api_methods/api_methods.dart';

class OtpController extends GetxController {
  TextEditingController pin = TextEditingController();
  final showLoading = false.obs;
  Map<String, String?> parameter = Get.parameters;
  final count = 0.obs;
  bool get isWhatsappLogin => parameter[ApiKeyConstants.isWhatsapp] == 'true';
  int get otpLength => isWhatsappLogin ? 6 : 4;

  void _log(String message) {
    if (kDebugMode) {
      debugPrint('[OtpController] $message');
    }
  }

  String _normalizeType(String? type) {
    final String value = (type ?? '').trim().toLowerCase();
    if (value == ApiKeyConstants.driver) return ApiKeyConstants.driver;
    return ApiKeyConstants.user;
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

  String _resolveDriverStatus(User? user) {
    final String status = _normalizeDriverStatus(user?.status);
    if (status == ApiKeyConstants.completed) {
      return ApiKeyConstants.completed;
    }
    if (user?.isApproved == true) return ApiKeyConstants.approvedStatus;
    return status;
  }

  Future<String> _resolveSelectedType() async {
    final String routeType = _normalizeType(parameter[ApiKeyConstants.type]);
    if (parameter[ApiKeyConstants.type] != null &&
        parameter[ApiKeyConstants.type]!.trim().isNotEmpty) {
      _log('Type resolved from route param: $routeType');
      return routeType;
    }

    SharedPreferences sp = await SharedPreferences.getInstance();
    final String storedType =
        _normalizeType(sp.getString(ApiKeyConstants.type));
    _log('Type resolved from SharedPreferences fallback: $storedType');
    return storedType;
  }

  void increment() => count.value++;

  Future<void> clickOnNextButton(BuildContext context) async {
    final String otp = pin.text.trim();
    if (otp.isNotEmpty) {
      _log(
          'Verify OTP clicked. flow=${isWhatsappLogin ? 'whatsapp' : 'normal'}, enteredOtpLength=${otp.length}, expectedOtpLength=$otpLength');
      if (otp.length != otpLength) {
        _log('OTP length mismatch. Verification aborted.');
        CommonWidgets.snackBarView(
            title: isWhatsappLogin
                ? StringConstants.otpMustBe6Digits
                : StringConstants.otpMustBe4Digits);
        return;
      }
      try {
        showLoading.value = true;
        final String selectedType = await _resolveSelectedType();
        _log('Proceeding OTP verification with selectedType=$selectedType');
        late LoginModel? loginModel;
        if (isWhatsappLogin) {
          Map<String, String> bodyParams = {
            ApiKeyConstants.phone: parameter[ApiKeyConstants.phone] ?? '',
            ApiKeyConstants.countryCode:
                parameter[ApiKeyConstants.countryCode] ?? '',
            ApiKeyConstants.otp: otp,
            ApiKeyConstants.type: selectedType,
          };
          _log(
              'Calling verifyOtpWhatsAppApi. type=$selectedType, otpLength=${otp.length}');
          loginModel =
              await ApiMethods.verifyOtpWhatsAppApi(bodyParams: bodyParams);
        } else {
          Map<String, String> bodyParams = {
            ApiKeyConstants.phone: parameter[ApiKeyConstants.phone] ?? '',
            ApiKeyConstants.otp: otp,
            ApiKeyConstants.type: selectedType,
          };
          _log(
              'Calling otpVerifyApi. type=$selectedType, otpLength=${otp.length}');
          loginModel = await ApiMethods.otpVerifyApi(bodyParams: bodyParams);
        }
        if (loginModel != null &&
            loginModel.success != null &&
            loginModel.success! &&
            loginModel.user != null) {
          pin.clear();
          _log(
              'OTP verify success. isApproved=${loginModel.user?.isApproved ?? false}');
          SharedPreferences sp = await SharedPreferences.getInstance();
          sp.setString(ApiKeyConstants.token, loginModel.token!);
          sp.setString(ApiKeyConstants.userId, loginModel.user?.sId ?? '');
          sp.setString(ApiKeyConstants.phone, loginModel.user?.phone ?? '');
          sp.setString(ApiKeyConstants.type, selectedType);
          _log('Saved session in SharedPreferences with type=$selectedType');
          if (selectedType == ApiKeyConstants.user) {
            _log('Navigating as USER to splash.');
            Get.offAllNamed(Routes.SPLASH);
          } else {
            // Driver flow is status-driven across Step 1 and Step 3 screens.
            final String status = _resolveDriverStatus(loginModel.user);
            if (status.isNotEmpty) {
              sp.setString(ApiKeyConstants.driverStatus, status);
            }
            if (status == ApiKeyConstants.completed) {
              _log('Driver status completed. Navigating to splash/home.');
              Get.offAllNamed(Routes.SPLASH);
            } else if (status == ApiKeyConstants.approvedStatus) {
              _log('Driver status approved. Navigating to complete profile.');
              Get.offAllNamed(Routes.DRIVER_COMPLETE_PROFILE);
            } else {
              _log('Navigating as DRIVER to registration status screen.');
              Get.offAllNamed(Routes.DRIVER_REGISTER);
            }
          }
        } else {
          _log('OTP verify failed. message=${loginModel?.message}');
          CommonWidgets.snackBarView(
              title: loginModel?.message ?? 'Otp Verified Failed ...');
        }
      } catch (e) {
        showLoading.value = false;
        _log('OTP verify exception: $e');
        CommonWidgets.snackBarView(title: 'Something is wrong...');
      }
      showLoading.value = false;
    } else {
      CommonWidgets.snackBarView(title: 'Please enter otp ...');
    }
  }

  void showProcessingDialog(BuildContext context) {
    showDialog(
      context: context,
      barrierDismissible: false, // Prevents closing by tapping outside
      builder: (BuildContext context) {
        return AlertDialog(
          backgroundColor: Colors.white,
          surfaceTintColor: Colors.white,
          title: Text(
            'Your account is in verification process',
            style: MyTextStyle.titleStyle16bb,
            textAlign: TextAlign.center,
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'Thanks for login with Drewel! Your documents have been sent to the admin for approval.',
                textAlign: TextAlign.center,
              ),
              SizedBox(
                height: 20.px,
              ),
              CommonWidgets.commonElevatedButton(
                  onPressed: () {
                    Get.back();
                  },
                  context: context,
                  child: Text(
                    StringConstants.close,
                    style: MyTextStyle.titleStyle16bw,
                  ))
            ],
          ),
        );
      },
    );
  }

  /// Shows dialog when driver has already registered but awaiting approval
  void showPendingApprovalDialog(BuildContext context) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext context) {
        return AlertDialog(
          backgroundColor: Colors.white,
          surfaceTintColor: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16.px),
          ),
          title: Text(
            'Registration Submitted',
            style: MyTextStyle.titleStyle18bb,
            textAlign: TextAlign.center,
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.hourglass_top_rounded,
                size: 60.px,
                color: Colors.orange,
              ),
              SizedBox(height: 16.px),
              Text(
                'Thanks for registering with Drewel! Your documents have been sent to the admin for approval.',
                textAlign: TextAlign.center,
                style: MyTextStyle.titleStyle14b,
              ),
              SizedBox(height: 24.px),
              CommonWidgets.commonElevatedButton(
                onPressed: () {
                  Get.back();
                  Get.offAllNamed(Routes.SPLASH);
                },
                context: context,
                child: Text(
                  StringConstants.close,
                  style: MyTextStyle.titleStyle16bw,
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
