import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'package:get/get.dart';
import 'package:responsive_sizer/responsive_sizer.dart';

import '../../../../common/colors.dart';
import '../../../../common/common_widgets.dart';
import '../../../../common/drewel_app_bar.dart';
import '../../../../common/drewel_pop_scope.dart';
import '../../../../common/text_styles.dart';
import '../../../data/constants/icons_constant.dart';
import '../../../data/constants/string_constants.dart';
import '../controllers/login_controller.dart';

class LoginView extends GetView<LoginController> {
  const LoginView({super.key});

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<TextEditingValue>(
      valueListenable: controller.mobileController,
      builder: (BuildContext context, TextEditingValue value, Widget? child) =>
          DrewelPopScope(
        fallbackRoute: '/user-type',
        hasUnsavedChanges: value.text.trim().isNotEmpty,
        child: Scaffold(
          appBar: const DrewelAppBar(
            title: '',
            showBackButton: true,
            fallbackRoute: '/user-type',
          ),
          backgroundColor: primaryColor,
          resizeToAvoidBottomInset: false,
          body: Obx(() {
            controller.count.value;
            return Column(
              mainAxisAlignment: MainAxisAlignment.end,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                CommonWidgets.appIcons(
                  assetName: IconConstants.icLogo,
                  height: 165.px,
                  width: 320.px,
                  fit: BoxFit.contain,
                ),
                Expanded(
                  child: Container(
                    width: MediaQuery.of(context).size.width,
                    padding: EdgeInsets.symmetric(
                        horizontal: 20.px, vertical: 40.px),
                    decoration: BoxDecoration(
                      color: primary3Color,
                      borderRadius: BorderRadius.only(
                        topRight: Radius.circular(40.px),
                        topLeft: Radius.circular(40.px),
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          StringConstants.welcomeToDREWEL,
                          style: MyTextStyle.titleStyle20bb,
                        ),
                        SizedBox(height: 10.px),
                        Text(
                          StringConstants.loginWithYourWhatsAppNumber,
                          style: MyTextStyle.titleStyle16b,
                        ),
                        AbsorbPointer(
                          absorbing: controller.isAnyLoading,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              CommonWidgets.commonTextFieldForLoginSignUP(
                                controller: controller.mobileController,
                                focusNode: controller.focusNodeMobile,
                                isCard: controller.isMobile.value,
                                hintText: StringConstants.whatsappNumber,
                                keyboardType: TextInputType.phone,
                                inputFormatters: [
                                  FilteringTextInputFormatter.digitsOnly,
                                ],
                                readOnly: controller.isAnyLoading,
                                prefixIcon: CommonWidgets.countryCodePicker(
                                  onChanged: (value) => controller
                                      .clickOnCountryCode(value: value),
                                  initialSelection:
                                      controller.countryDailCode.value,
                                ),
                              ),
                              CommonWidgets.commonElevatedButton(
                                onPressed: () {
                                  controller.clickOnWhatsAppLoginButton();
                                },
                                context: context,
                                buttonColor: Colors.green,
                                buttonMargin: EdgeInsets.only(top: 20.px),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    CommonWidgets.appIcons(
                                      assetName: IconConstants.icWhatsApp,
                                      height: 20.px,
                                      width: 20.px,
                                    ),
                                    SizedBox(width: 10.px),
                                    Text(
                                      StringConstants.next,
                                      style: MyTextStyle.titleStyle16bw,
                                    ),
                                  ],
                                ),
                                showLoading:
                                    controller.showWhatsAppOtpLoading.value,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            );
          }),
        ),
      ),
    );
  }
}
