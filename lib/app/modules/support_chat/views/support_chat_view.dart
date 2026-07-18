import 'package:flutter/material.dart';

import 'package:get/get.dart';
import 'package:responsive_sizer/responsive_sizer.dart';

import '../../../../common/colors.dart';
import '../../../../common/common_widgets.dart';
import '../../../../common/drewel_app_bar.dart';
import '../../../../common/drewel_pop_scope.dart';
import '../../../../common/text_styles.dart';
import '../../../data/constants/image_constants.dart';
import '../controllers/support_chat_controller.dart';

class SupportChatView extends GetView<SupportChatController> {
  const SupportChatView({super.key});
  @override
  Widget build(BuildContext context) {
    return DrewelPopScope(
      child: Scaffold(
        appBar: const DrewelAppBar(
          title: '',
          showBackButton: true,
        ),
        backgroundColor: primaryColor,
        resizeToAvoidBottomInset: true, // Fixes keyboard overlap
        floatingActionButtonLocation: FloatingActionButtonLocation.centerDocked,
        floatingActionButton: Container(
          margin: EdgeInsets.all(15.px),
          padding: EdgeInsets.symmetric(horizontal: 15.px, vertical: 5.px),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(50.px),
            border: Border.all(color: backgroundColor.withOpacity(0.2)),
          ),
          child: TextFormField(
            controller: controller.messageController,
            decoration: InputDecoration(
              hintText: 'Type a message',
              hintStyle: MyTextStyle.titleStyle16b,
              border: InputBorder.none,
              focusedBorder: InputBorder.none,
              enabledBorder: InputBorder.none,
              suffixIcon: Row(
                mainAxisSize: MainAxisSize.min,
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  GestureDetector(
                      onTap: () {
                        if (controller.messageController.text.isNotEmpty) {
                          controller.sendMessage();
                        } else {
                          CommonWidgets.showMyToastMessage(
                              'Enter message first ...');
                        }
                      },
                      child:
                          Icon(Icons.send, size: 25.px, color: primaryColor)),
                  SizedBox(
                    width: 8.px,
                  )
                  // Padding(
                  //   padding:  EdgeInsets.symmetric(horizontal: 8.px),
                  //   child: CommonWidgets.appIcons(assetName: IconConstants.icMic,
                  //   height: 26.px,width: 12.px),
                  // )
                ],
              ),
              contentPadding: EdgeInsets.symmetric(vertical: 10.px),
            ),
          ),
        ),
        body: Obx(() {
          controller.count.value; // Forces rebuild
          return Column(
            mainAxisAlignment: MainAxisAlignment.start,
            children: [
              Expanded(
                // Replaces fixed height container
                child: Container(
                  width: double.infinity,
                  margin: EdgeInsets.only(top: 10.px),
                  padding:
                      EdgeInsets.symmetric(horizontal: 15.px, vertical: 25.px),
                  decoration: BoxDecoration(
                    color: primary3Color,
                    borderRadius: BorderRadius.only(
                      topRight: Radius.circular(40.px),
                      topLeft: Radius.circular(40.px),
                    ),
                  ),
                  clipBehavior: Clip.hardEdge,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          CommonWidgets.appIcons(
                              assetName: ImageConstants.imgBoy,
                              height: 40.px,
                              width: 40.px),
                          SizedBox(width: 10.px),
                          Text(
                            'Riadh slama',
                            style: MyTextStyle.titleStyle18bb,
                          ),
                        ],
                      ),
                      SizedBox(height: 10.px),
                      Divider(
                          color: Colors.black.withOpacity(0.2),
                          thickness: 1.px),
                      Expanded(
                        child: showConversationList(),
                      ),
                      SizedBox(height: 80.px),
                    ],
                  ),
                ),
              ),
            ],
          );
        }),
      ),
    );
  }

  Widget showConversationList() {
    // Show loader while loading
    if (controller.isLoading.value) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const CircularProgressIndicator(
              color: primaryColor,
            ),
            SizedBox(height: 16.px),
            Text(
              'Loading messages...',
              style: MyTextStyle.titleStyle14b,
            ),
          ],
        ),
      );
    }

    // Show empty state if no messages
    if (controller.messageList.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.chat_bubble_outline,
              size: 60.px,
              color: Colors.grey.withOpacity(0.5),
            ),
            SizedBox(height: 16.px),
            Text(
              'No messages yet',
              style: MyTextStyle.titleStyle16b,
            ),
            SizedBox(height: 8.px),
            Text(
              'Start a conversation with support',
              style: MyTextStyle.titleStyle14b.copyWith(color: Colors.grey),
            ),
          ],
        ),
      );
    }

    // Show messages list
    return ListView.builder(
      itemCount: controller.messageList.length,
      controller: controller.scrollController,
      shrinkWrap: true,
      padding: EdgeInsets.zero,
      itemBuilder: (context, index) {
        return Container(
          width: MediaQuery.of(context).size.width,
          padding: EdgeInsets.all(20.px),
          margin: EdgeInsets.only(
            top: 5.px,
            bottom: 5.px,
            left: controller.messageList[index].msgByUserId == controller.userId
                ? 100.px
                : 0,
            right:
                controller.messageList[index].msgByUserId == controller.userId
                    ? 0.px
                    : 100.px,
          ),
          decoration: BoxDecoration(
            color:
                controller.messageList[index].msgByUserId == controller.userId
                    ? primaryColor
                    : primary3Color,
            border: Border.all(
                color: backgroundColor.withOpacity(0.5), width: 1.px),
            borderRadius: BorderRadius.only(
              topLeft: Radius.circular(16.px),
              topRight: Radius.circular(16.px),
              bottomRight: Radius.circular(
                  controller.messageList[index].msgByUserId == controller.userId
                      ? 0.px
                      : 16.px),
              bottomLeft: Radius.circular(
                  controller.messageList[index].msgByUserId == controller.userId
                      ? 16.px
                      : 0.px),
            ),
          ),
          child: Text(
            controller.messageList[index].text ?? '',
            style:
                controller.messageList[index].msgByUserId == controller.userId
                    ? MyTextStyle.titleStyle16w
                    : MyTextStyle.titleStyle16b,
          ),
        );
      },
    );
  }
}
