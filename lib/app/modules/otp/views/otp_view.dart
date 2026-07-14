import 'package:flutter/material.dart';

import 'package:get/get.dart';
import 'package:responsive_sizer/responsive_sizer.dart';

import '../../../../common/colors.dart';
import '../../../../common/common_widgets.dart';
import '../../../../common/text_styles.dart';
import '../../../data/constants/icons_constant.dart';
import '../../../data/constants/string_constants.dart';
import '../controllers/otp_controller.dart';

class OtpView extends GetView<OtpController> {
  const OtpView({super.key});
  @override
  Widget build(BuildContext context) {
    return Scaffold(
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
                  fit: BoxFit.contain),
              Container(
                width: MediaQuery.of(context).size.width,
                height: MediaQuery.of(context).size.height - 250.px,
                padding:
                    EdgeInsets.symmetric(horizontal: 20.px, vertical: 40.px),
                decoration: BoxDecoration(
                    color: primary3Color,
                    borderRadius: BorderRadius.only(
                        topRight: Radius.circular(40.px),
                        topLeft: Radius.circular(40.px))),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      StringConstants.welcomeToDREWEL,
                      style: MyTextStyle.titleStyle20bb,
                    ),
                    SizedBox(
                      height: 10.px,
                    ),
                    Text(
                      '${StringConstants.enterYourOTPCodeHere} (${controller.otpLength} digits)',
                      style: MyTextStyle.titleStyle16b,
                    ),
                    AutofillGroup(
                      child: CommonWidgets.commonOtpView(
                          controller: controller.pin,
                          length: controller.otpLength,
                          width: controller.isWhatsappLogin ? 52.px : 70.px,
                          height: 60.px,
                          autoFocus: true),
                    ),
                    CommonWidgets.commonElevatedButton(
                        onPressed: () {
                          controller.clickOnNextButton(context);
                        },
                        context: context,
                        child: Text(
                          StringConstants.verifyNow,
                          style: MyTextStyle.titleStyle16bw,
                        ),
                        buttonMargin: EdgeInsets.symmetric(vertical: 20.px),
                        showLoading: controller.showLoading.value)
                  ],
                ),
              )
            ],
          );
        }));
  }
}
