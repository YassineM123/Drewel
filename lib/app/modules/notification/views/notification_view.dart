import 'package:flutter/material.dart';

import 'package:get/get.dart';
import 'package:responsive_sizer/responsive_sizer.dart';

import '../../../../common/colors.dart';
import '../../../../common/common_widgets.dart';
import '../../../../common/drewel_app_bar.dart';
import '../../../../common/drewel_pop_scope.dart';
import '../../../../common/text_styles.dart';
import '../../../data/constants/string_constants.dart';
import '../controllers/notification_controller.dart';

class NotificationView extends GetView<NotificationController> {
  const NotificationView({super.key});
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
                        horizontal: 15.px, vertical: 30.px),
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
                          StringConstants.notifications,
                          style: MyTextStyle.titleStyle18bb,
                        ),
                        Expanded(child: showNotificationList())
                      ],
                    ),
                  ),
                )
              ],
            );
          })),
    );
  }

  Widget showNotificationList() {
    return ListView.builder(
      itemCount: controller.notificationList.length,
      shrinkWrap: true,
      padding: EdgeInsets.zero,
      itemBuilder: (context, index) {
        return Container(
          width: MediaQuery.of(context).size.width,
          margin: EdgeInsets.symmetric(vertical: 10.px),
          child: Column(
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  CommonWidgets.appIcons(
                    assetName:
                        controller.notificationList[index]['image'] ?? '',
                    height: 50.px,
                    width: 50.px,
                  ),
                  Expanded(
                    child: Padding(
                      padding: EdgeInsets.symmetric(horizontal: 10.px),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('${controller.notificationList[index]['title']}',
                              style: MyTextStyle.titleStyle14bb),
                          Text(
                              '${controller.notificationList[index]['subtitle']}',
                              style: MyTextStyle.titleStyle12b),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
              SizedBox(
                height: 10.px,
              ),
              Divider(
                thickness: 1.px,
                color: Colors.black.withOpacity(0.1),
              )
            ],
          ),
        );
      },
    );
  }
}
