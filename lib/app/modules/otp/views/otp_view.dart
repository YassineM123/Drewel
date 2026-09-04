import 'package:flutter/material.dart';

import 'package:get/get.dart';
import 'package:responsive_sizer/responsive_sizer.dart';

import '../../../../common/colors.dart';
import '../../../../common/common_widgets.dart';
import '../../../../common/drewel_navigation.dart';
import '../../../../common/drewel_pop_scope.dart';
import '../../../../common/responsive_primary_button.dart';
import '../../../../common/text_styles.dart';
import '../../../data/constants/icons_constant.dart';
import '../../../data/constants/string_constants.dart';
import '../controllers/otp_controller.dart';

class OtpView extends GetView<OtpController> {
  const OtpView({super.key});
  @override
  Widget build(BuildContext context) {
    return DrewelPopScope(
      fallbackRoute: '/login',
      child: Scaffold(
        backgroundColor: primaryColor,
        resizeToAvoidBottomInset: true,
        body: SafeArea(
          bottom: false,
          child: LayoutBuilder(
            builder: (BuildContext context, BoxConstraints constraints) {
              final double horizontalPadding = 20.px;
              final double sheetTopRadius = 40.px;
              final double headerHeight =
                  (constraints.maxHeight * 0.38).clamp(260.0, 360.0);
              final double fieldWidth =
                  ((constraints.maxWidth - (horizontalPadding * 2) - 42.px) /
                          controller.otpLength)
                      .clamp(38.0, 60.0);

              return Obx(() {
                controller.count.value;
                final bool isOtpComplete =
                    controller.pin.text.trim().length == controller.otpLength;
                return SingleChildScrollView(
                  padding: EdgeInsets.only(
                    bottom: MediaQuery.of(context).viewInsets.bottom,
                  ),
                  child: ConstrainedBox(
                    constraints:
                        BoxConstraints(minHeight: constraints.maxHeight),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: <Widget>[
                        SizedBox(
                          height: headerHeight,
                          child: Stack(
                            children: <Widget>[
                              Positioned(
                                top: 22.px,
                                left: 20.px,
                                child: Material(
                                  color: primary3Color.withValues(alpha: 0.95),
                                  shape: const CircleBorder(),
                                  elevation: 6,
                                  shadowColor: Colors.black26,
                                  child: InkWell(
                                    customBorder: const CircleBorder(),
                                    onTap: () => DrewelNavigation.back(
                                      context,
                                      fallbackRoute: '/login',
                                    ),
                                    child: SizedBox.square(
                                      dimension: 56.px,
                                      child: const Icon(
                                        Icons.arrow_back_ios_new_rounded,
                                        color: Colors.black,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                              Center(
                                child: Padding(
                                  padding: EdgeInsets.only(
                                    top: 46.px,
                                    left: 28.px,
                                    right: 28.px,
                                  ),
                                  child: CommonWidgets.appIcons(
                                    assetName: IconConstants.icLogo,
                                    height: 160.px,
                                    width: double.infinity,
                                    fit: BoxFit.contain,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        Container(
                          width: double.infinity,
                          constraints: BoxConstraints(
                            minHeight: constraints.maxHeight - headerHeight,
                          ),
                          padding: EdgeInsets.fromLTRB(
                            horizontalPadding,
                            34.px,
                            horizontalPadding,
                            36.px,
                          ),
                          decoration: BoxDecoration(
                            color: primary3Color,
                            borderRadius: BorderRadius.only(
                              topRight: Radius.circular(sheetTopRadius),
                              topLeft: Radius.circular(sheetTopRadius),
                            ),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: <Widget>[
                              Text(
                                StringConstants.welcomeToDREWEL.tr,
                                style: MyTextStyle.titleStyle24bb.copyWith(
                                  height: 1.1,
                                ),
                              ),
                              SizedBox(height: 24.px),
                              Text(
                                '${StringConstants.enterYourOTPCodeHere.tr} '
                                '(${controller.otpLength} digits)',
                                style: MyTextStyle.titleStyle20b.copyWith(
                                  height: 1.25,
                                ),
                              ),
                              SizedBox(height: 18.px),
                              AutofillGroup(
                                child: CommonWidgets.commonOtpView(
                                  controller: controller.pin,
                                  length: controller.otpLength,
                                  width: fieldWidth,
                                  height: 58.px,
                                  borderWidth: 4.px,
                                  autoFocus: true,
                                  enablePinAutofill: true,
                                  mainAxisAlignment:
                                      MainAxisAlignment.spaceBetween,
                                  textStyle:
                                      MyTextStyle.titleStyle24bb.copyWith(
                                    height: 1,
                                  ),
                                ),
                              ),
                              if (controller
                                  .otpError.value.isNotEmpty) ...<Widget>[
                                SizedBox(height: 14.px),
                                Text(
                                  controller.otpError.value,
                                  style: MyTextStyle.titleStyle12b.copyWith(
                                    color: Colors.red.shade700,
                                  ),
                                ),
                              ],
                              SizedBox(height: 18.px),
                              Row(
                                children: <Widget>[
                                  Expanded(
                                    child: Text(
                                      controller.canResend
                                          ? 'didnt_receive_code'.tr
                                          : 'resend_available_in'.trParams({'seconds': '${controller.resendSeconds.value}'}),
                                      style: MyTextStyle.titleStyle12b,
                                    ),
                                  ),
                                  TextButton(
                                    onPressed: controller.canResend &&
                                            !controller.resendLoading.value
                                        ? controller.resendOtp
                                        : null,
                                    child: controller.resendLoading.value
                                        ? const SizedBox.square(
                                            dimension: 16,
                                            child: CircularProgressIndicator(
                                              strokeWidth: 2,
                                            ),
                                          )
                                        : Text(
                                            'resend'.tr,
                                            style: MyTextStyle.titleStyle14bb
                                                .copyWith(color: primaryColor),
                                          ),
                                  ),
                                ],
                              ),
                              SizedBox(height: 30.px),
                              ResponsivePrimaryButton(
                                onPressed: isOtpComplete &&
                                        !controller.showLoading.value
                                    ? () =>
                                        controller.clickOnNextButton(context)
                                    : null,
                                isLoading: controller.showLoading.value,
                                height: 58.px,
                                backgroundColor: primaryColor,
                                semanticLabel: StringConstants.verifyNow.tr,
                                child: Text(
                                  StringConstants.verifyNow.tr,
                                  style: MyTextStyle.titleStyle20bw.copyWith(
                                    height: 1,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              });
            },
          ),
        ),
      ),
    );
  }
}
