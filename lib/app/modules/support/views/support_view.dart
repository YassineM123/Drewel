import 'package:flutter/material.dart';

import 'package:get/get.dart';
import 'package:responsive_sizer/responsive_sizer.dart';

import '../../../../common/colors.dart';
import '../../../../common/common_widgets.dart';
import '../../../../common/drewel_app_bar.dart';
import '../../../../common/drewel_pop_scope.dart';
import '../../../../common/text_styles.dart';
import '../../../data/constants/string_constants.dart';
import '../controllers/support_controller.dart';

class SupportView extends GetView<SupportController> {
  const SupportView({super.key});
  @override
  Widget build(BuildContext context) {
    return DrewelPopScope(
      child: Scaffold(
          appBar: const DrewelAppBar(
            title: '',
            showBackButton: true,
          ),
          backgroundColor: primaryColor,
          body: Obx(() {
            controller.count.value;
            return Column(
              mainAxisAlignment: MainAxisAlignment.end,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(
                  child: Container(
                    width: MediaQuery.of(context).size.width,
                    margin: EdgeInsets.only(top: 10.px),
                    padding: EdgeInsets.symmetric(
                        horizontal: 15.px, vertical: 25.px),
                    decoration: BoxDecoration(
                        color: primary3Color,
                        borderRadius: BorderRadius.only(
                            topRight: Radius.circular(40.px),
                            topLeft: Radius.circular(40.px))),
                    clipBehavior: Clip.hardEdge,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          StringConstants.support,
                          style: MyTextStyle.titleStyle18bb,
                        ),
                        CommonWidgets.commonElevatedButton(
                            onPressed: () {
                              controller.clickOnChatButton();
                            },
                            context: context,
                            child: Text(
                              StringConstants.newChat,
                              style: MyTextStyle.titleStyle16bw,
                            ),
                            buttonMargin:
                                EdgeInsets.symmetric(vertical: 10.px)),
                        Text(
                          StringConstants.yourConversation,
                          style: MyTextStyle.titleStyle18b,
                        ),
                        SizedBox(height: 10.px),
                        showConversationList()
                      ],
                    ),
                  ),
                )
              ],
            );
          })),
    );
  }

  Widget showConversationList() {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.all(20.px),
      decoration: BoxDecoration(
        color: const Color(0xFFF8F8F8),
        border: Border.all(
          color: backgroundColor.withValues(alpha: 0.18),
          width: 1.px,
        ),
        borderRadius: BorderRadius.circular(10.px),
      ),
      child: Column(
        children: [
          Icon(
            Icons.support_agent_rounded,
            size: 42.px,
            color: primaryColor,
          ),
          SizedBox(height: 10.px),
          Text(
            'No support conversations yet',
            textAlign: TextAlign.center,
            style: MyTextStyle.titleStyle14bb,
          ),
          SizedBox(height: 4.px),
          Text(
            'Start a new chat when you need help from Drewel Support.',
            textAlign: TextAlign.center,
            style: MyTextStyle.titleStyle12b.copyWith(color: text2Color),
          ),
        ],
      ),
    );
  }
}
