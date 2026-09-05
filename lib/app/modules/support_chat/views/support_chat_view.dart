import 'package:flutter/material.dart';

import 'package:get/get.dart';
import 'package:responsive_sizer/responsive_sizer.dart';

import '../../../../common/colors.dart';
import '../../../../common/common_widgets.dart';
import '../../../../common/drewel_app_bar.dart';
import '../../../../common/drewel_pop_scope.dart';
import '../../../../common/text_styles.dart';
import '../../../data/apis/api_models/get_chat_model.dart';
import '../controllers/support_chat_controller.dart';

class SupportChatView extends GetView<SupportChatController> {
  const SupportChatView({super.key});
  @override
  Widget build(BuildContext context) {
    return DrewelPopScope(
      child: Scaffold(
        appBar: const DrewelAppBar(
          title: 'Support',
          showBackButton: true,
        ),
        backgroundColor: primaryColor,
        resizeToAvoidBottomInset: true,
        bottomNavigationBar: _buildComposer(),
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
                      topRight: Radius.circular(24.px),
                      topLeft: Radius.circular(24.px),
                    ),
                  ),
                  clipBehavior: Clip.hardEdge,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _buildHeader(),
                      SizedBox(height: 10.px),
                      Divider(
                        color: primaryColor.withValues(alpha: 0.14),
                        thickness: 1.px,
                      ),
                      Expanded(
                        child: showConversationList(),
                      ),
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

  Widget _buildHeader() {
    return Row(
      children: [
        Obx(
          () => CircleAvatar(
            radius: 20.px,
            backgroundColor: primaryColor.withValues(alpha: 0.12),
            child: Text(
              _initials(controller.supportName.value),
              style: MyTextStyle.titleStyle14bb.copyWith(color: primaryColor),
            ),
          ),
        ),
        SizedBox(width: 10.px),
        Expanded(
          child: Obx(
            () => Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  controller.supportName.value,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: MyTextStyle.titleStyle18bb,
                ),
                Text(
                  controller.supportOnline.value ? 'Online' : 'Support',
                  style: MyTextStyle.titleStyle12b.copyWith(
                    color: controller.supportOnline.value
                        ? Colors.green.shade700
                        : Colors.grey.shade600,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildComposer() {
    return SafeArea(
      top: false,
      child: Container(
        color: primary3Color,
        padding: EdgeInsets.fromLTRB(15.px, 8.px, 15.px, 12.px),
        child: TextFormField(
          controller: controller.messageController,
          minLines: 1,
          maxLines: 4,
          textInputAction: TextInputAction.send,
          onFieldSubmitted: (_) => _submitMessage(),
          decoration: InputDecoration(
            hintText: 'type_a_message'.tr,
            hintStyle: MyTextStyle.titleStyle16b.copyWith(
              color: Colors.grey.shade600,
            ),
            filled: true,
            fillColor: const Color(0xFFF8F8F8),
            contentPadding: EdgeInsets.symmetric(
              horizontal: 16.px,
              vertical: 12.px,
            ),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(28.px),
              borderSide: BorderSide(
                color: backgroundColor.withValues(alpha: 0.18),
              ),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(28.px),
              borderSide: BorderSide(
                color: backgroundColor.withValues(alpha: 0.18),
              ),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(28.px),
              borderSide: const BorderSide(color: primaryColor),
            ),
            suffixIcon: IconButton(
              tooltip: 'Send message',
              onPressed: _submitMessage,
              icon: Icon(Icons.send_rounded, size: 25.px, color: primaryColor),
            ),
          ),
        ),
      ),
    );
  }

  void _submitMessage() {
    if (controller.messageController.text.trim().isEmpty) {
      CommonWidgets.showMyToastMessage('Enter message first ...');
      return;
    }
    controller.sendMessage();
  }

  String _initials(String name) {
    final List<String> parts = name
        .trim()
        .split(RegExp(r'\s+'))
        .where((part) => part.isNotEmpty)
        .toList();
    if (parts.isEmpty) return 'DS';
    return parts.take(2).map((part) => part[0].toUpperCase()).join();
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
              'loading_messages'.tr,
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
              color: primaryColor.withValues(alpha: 0.28),
            ),
            SizedBox(height: 16.px),
            Text(
              'no_messages_yet'.tr,
              style: MyTextStyle.titleStyle16b,
            ),
            SizedBox(height: 8.px),
            Text(
              'start_conversation_with_support'.tr,
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
      padding: EdgeInsets.symmetric(vertical: 8.px),
      itemBuilder: (context, index) {
        final ChatMessageModel message = controller.messageList[index];
        final bool isMine = controller.isMyMessage(message);
        return LayoutBuilder(
          builder: (context, constraints) {
            return Align(
              alignment: isMine ? Alignment.centerRight : Alignment.centerLeft,
              child: ConstrainedBox(
                constraints:
                    BoxConstraints(maxWidth: constraints.maxWidth * .78),
                child: Container(
                  padding: EdgeInsets.symmetric(
                    horizontal: 14.px,
                    vertical: 10.px,
                  ),
                  margin: EdgeInsets.symmetric(vertical: 4.px),
                  decoration: BoxDecoration(
                    color: isMine ? primaryColor : const Color(0xFFF1F1F1),
                    border:
                        isMine ? null : Border.all(color: Colors.grey.shade300),
                    borderRadius: BorderRadius.only(
                      topLeft: Radius.circular(16.px),
                      topRight: Radius.circular(16.px),
                      bottomRight: Radius.circular(isMine ? 4.px : 16.px),
                      bottomLeft: Radius.circular(isMine ? 16.px : 4.px),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        message.text ?? '',
                        style: isMine
                            ? MyTextStyle.titleStyle16w
                            : MyTextStyle.titleStyle16b,
                      ),
                      if (controller.formatMessageTime(message).isNotEmpty) ...[
                        SizedBox(height: 3.px),
                        Text(
                          controller.formatMessageTime(message),
                          style: MyTextStyle.titleStyle12b.copyWith(
                            color: isMine
                                ? Colors.white.withValues(alpha: .75)
                                : Colors.grey.shade600,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }
}
