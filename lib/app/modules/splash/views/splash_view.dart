import 'package:flutter/material.dart';

import 'package:get/get.dart';
import 'package:responsive_sizer/responsive_sizer.dart';

import '../../../../common/colors.dart';
import '../../../../common/common_widgets.dart';
import '../../../data/constants/icons_constant.dart';
import '../controllers/splash_controller.dart';

class SplashView extends GetView<SplashController> {
  const SplashView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: primaryColor,
      body: Center(
        child: Obx(() {
          controller.count.value;
          return Transform.scale(
            scale: controller.scale.value,
            child: CommonWidgets.appIcons(
              assetName: IconConstants.icLogo,
              height: 165.px,
              width: 320.px,
              fit: BoxFit.contain,
            ),
          );
        }),
      ),
    );
  }
}
