import 'package:flutter/material.dart';

import 'package:get/get.dart';
import 'package:responsive_sizer/responsive_sizer.dart';

import '../../../../common/colors.dart';
import '../../../../common/common_widgets.dart';
import '../../../../common/drewel_app_bar.dart';
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
          appBar: const DrewelAppBar(
            title: '',
            showBackButton: true,
            fallbackRoute: '/login',
          ),
          backgroundColor: primaryColor,
          resizeToAvoidBottomInset: true,
          body: SafeArea(
            child: LayoutBuilder(
              builder: (BuildContext context, BoxConstraints constraints) {
                final double fieldWidth =
                    ((constraints.maxWidth - 72.px) / controller.otpLength)
                        .clamp(42.0, 68.0);

                return Obx(() {
                  controller.count.value;
                  final bool isOtpComplete =
                      controller.pin.text.trim().length == controller.otpLength;
                  return SingleChildScrollView(
                    padding: EdgeInsets.fromLTRB(
                      20.px,
                      20.px,
                      20.px,
                      24.px + MediaQuery.of(context).viewInsets.bottom,
                    ),
                    child: ConstrainedBox(
                      constraints:
                          BoxConstraints(minHeight: constraints.maxHeight - 40),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: <Widget>[
                          Center(
                            child: CommonWidgets.appIcons(
                              assetName: IconConstants.icLogo,
                              height: 140.px,
                              width: 260.px,
                              fit: BoxFit.contain,
                            ),
                          ),
                          SizedBox(height: 18.px),
                          Expanded(
                            child: Container(
                              width: double.infinity,
                              padding: EdgeInsets.symmetric(
                                horizontal: 20.px,
                                vertical: 24.px,
                              ),
                              decoration: BoxDecoration(
                                color: primary3Color,
                                borderRadius: BorderRadius.only(
                                  topRight: Radius.circular(40.px),
                                  topLeft: Radius.circular(40.px),
                                ),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: <Widget>[
                                  Text(
                                    StringConstants.welcomeToDREWEL,
                                    style: MyTextStyle.titleStyle20bb,
                                  ),
                                  SizedBox(height: 10.px),
                                  Text(
                                    '${StringConstants.enterYourOTPCodeHere} (${controller.otpLength} digits)',
                                    style: MyTextStyle.titleStyle16b,
                                  ),
                                  SizedBox(height: 10.px),
                                  AutofillGroup(
                                    child: CommonWidgets.commonOtpView(
                                      controller: controller.pin,
                                      length: controller.otpLength,
                                      width: fieldWidth,
                                      height: 56.px,
                                      autoFocus: true,
                                      enablePinAutofill: true,
                                    ),
                                  ),
                                  if (controller.otpError.value.isNotEmpty) ...<Widget>[
                                    SizedBox(height: 12.px),
                                    Text(
                                      controller.otpError.value,
                                      style: MyTextStyle.titleStyle12b.copyWith(
                                        color: Colors.red.shade700,
                                      ),
                                    ),
                                  ],
                                  SizedBox(height: 12.px),
                                  Row(
                                    children: <Widget>[
                                      Expanded(
                                        child: Text(
                                          controller.canResend
                                              ? 'Didn\'t receive a code?'
                                              : 'Resend available in ${controller.resendSeconds.value}s',
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
                                                child:
                                                    CircularProgressIndicator(
                                                  strokeWidth: 2,
                                                ),
                                              )
                                            : Text(
                                                'Resend',
                                                style: MyTextStyle
                                                    .titleStyle14bb,
                                              ),
                                      ),
                                    ],
                                  ),
                                  const Spacer(),
                                  ResponsivePrimaryButton(
                                    onPressed: isOtpComplete &&
                                            !controller.showLoading.value
                                        ? () => controller
                                            .clickOnNextButton(context)
                                        : null,
                                    isLoading: controller.showLoading.value,
                                    child: Text(
                                      StringConstants.verifyNow,
                                      style: MyTextStyle.titleStyle16bw,
                                    ),
                                    semanticLabel: StringConstants.verifyNow,
                                  ),
                                ],
                              ),
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
