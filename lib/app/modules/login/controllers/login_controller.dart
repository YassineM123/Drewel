import 'package:country_code_picker/country_code_picker.dart';
import 'package:drewel/app/data/apis/api_models/get_send_otp_model.dart';
import 'package:drewel/app/data/apis/api_models/get_simple_response_model.dart';
import 'package:drewel/app/data/constants/string_constants.dart';
import 'package:drewel/app/routes/app_pages.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../../common/common_widgets.dart';
import '../../../data/apis/api_constants/api_key_constants.dart';
import '../../../data/apis/api_methods/api_methods.dart';

class LoginController extends GetxController {
  TextEditingController mobileController = TextEditingController();
  FocusNode focusNodeMobile = FocusNode();
  final countryDailCode = '+971'.obs;
  final isMobile = false.obs;
  void startListener() {
    focusNodeMobile.addListener(onFocusChange);
  }

  void onFocusChange() {
    isMobile.value = focusNodeMobile.hasFocus;
  }

  final count = 0.obs;
  final showPhoneOtpLoading = false.obs;
  final showWhatsAppOtpLoading = false.obs;
  String type = '';
  bool get isAnyLoading =>
      showPhoneOtpLoading.value || showWhatsAppOtpLoading.value;

  void _log(String message) {
    if (kDebugMode) {
      debugPrint('[LoginController] $message');
    }
  }

  @override
  void onInit() async {
    SharedPreferences prefs = await SharedPreferences.getInstance();
    type = prefs.getString(ApiKeyConstants.type) ?? ApiKeyConstants.user;
    super.onInit();
    startListener();
  }

  void increment() => count.value++;
  clickOnCountryCode({required CountryCode value}) {
    countryDailCode.value = value.dialCode.toString();
  }

  String _getPhoneWithoutCountryCode() {
    final String phone =
        mobileController.text.trim().replaceAll(RegExp(r'[^0-9]'), '');
    final String dialCode = countryDailCode.value.replaceAll('+', '').trim();
    if (dialCode.isNotEmpty && phone.startsWith(dialCode)) {
      return phone.substring(dialCode.length);
    }
    return phone;
  }

  String _getPhoneWithCountryCode() {
    final String phone = _getPhoneWithoutCountryCode();
    final String dialCode = countryDailCode.value.replaceAll('+', '').trim();
    return '$dialCode$phone';
  }

  Future<void> clickOnNextButton() async {
    if (isAnyLoading) return;
    if (mobileController.text.trim().isNotEmpty) {
      try {
        showPhoneOtpLoading.value = true;
        final String phone = _getPhoneWithoutCountryCode();
        Map<String, String> bodyParams = {
          ApiKeyConstants.phone: phone,
          ApiKeyConstants.countryCode: countryDailCode.value,
          ApiKeyConstants.type: type,
        };
        _log('Normal OTP requested. type=$type');
        SendOtpModel? sendOtpModel =
            await ApiMethods.sendOtpApi(bodyParams: bodyParams);
        if (sendOtpModel != null &&
            sendOtpModel.success != null &&
            sendOtpModel.success! &&
            sendOtpModel.user != null) {
          _log('Normal OTP sent successfully. Navigating to OTP screen.');
          Get.toNamed(
            Routes.OTP,
            parameters: {
              ApiKeyConstants.phone: phone,
              ApiKeyConstants.countryCode: countryDailCode.value,
              ApiKeyConstants.type: type,
            },
          );
          // CommonWidgets.showMyToastMessage(' ${sendOtpModel.message}',duration: 3);
        } else {
          _log('Normal OTP send failed. message=${sendOtpModel?.message}');
          CommonWidgets.snackBarView(
              title: sendOtpModel?.message ?? 'Send Otp Failed ...');
        }
      } catch (e) {
        _log('Normal OTP send exception: $e');
        CommonWidgets.snackBarView(title: 'Somethings wrong...');
      }
      showPhoneOtpLoading.value = false;
    } else {
      CommonWidgets.snackBarView(title: 'Phone number is required...');
    }
  }

  Future<void> clickOnWhatsAppLoginButton() async {
    if (isAnyLoading) return;
    if (mobileController.text.trim().isEmpty) {
      CommonWidgets.snackBarView(title: 'Phone number is required...');
      return;
    }

    try {
      showWhatsAppOtpLoading.value = true;
      final String phone = _getPhoneWithoutCountryCode();
      _log('WhatsApp OTP requested. type=$type');
      Map<String, String> bodyParams = {
        ApiKeyConstants.phone: phone,
        ApiKeyConstants.countryCode: countryDailCode.value,
        ApiKeyConstants.type: type,
      };
      SimpleResponseModel? sendOtpModel =
          await ApiMethods.sendOtpWhatsAppApi(bodyParams: bodyParams);
      if (sendOtpModel != null &&
          sendOtpModel.success != null &&
          sendOtpModel.success!) {
        Get.toNamed(
          Routes.OTP,
          parameters: {
            ApiKeyConstants.phone: phone,
            ApiKeyConstants.countryCode: countryDailCode.value,
            ApiKeyConstants.type: type,
            ApiKeyConstants.isWhatsapp: 'true',
          },
        );
        _log('WhatsApp OTP sent successfully. Navigating to OTP screen.');
      } else {
        _log('WhatsApp OTP send failed. message=${sendOtpModel?.message}');
        CommonWidgets.snackBarView(
            title: _getWhatsAppOtpErrorMessage(sendOtpModel));
      }
    } catch (e) {
      _log('WhatsApp OTP send exception: $e');
      CommonWidgets.snackBarView(title: 'Somethings wrong...');
    } finally {
      showWhatsAppOtpLoading.value = false;
    }
  }

  String getWhatsAppLoginHelpText() {
    return '${StringConstants.useCountryCodeForWhatsapp} (${_getPhoneWithCountryCode()})';
  }

  String _getWhatsAppOtpErrorMessage(SimpleResponseModel? response) {
    final String? code = response?.code;
    if (code != null && code.startsWith('WHATSAPP_CONFIG_')) {
      return 'WhatsApp login is temporarily unavailable. Please contact support.';
    }
    return response?.message ?? 'Send WhatsApp Otp Failed ...';
  }
}
