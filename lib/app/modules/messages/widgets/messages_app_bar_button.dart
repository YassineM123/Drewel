import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../../common/colors.dart';
import '../../../routes/app_pages.dart';
import '../../communication/controllers/call_state_controller.dart';

class MessagesAppBarButton extends GetView<CallStateController> {
  const MessagesAppBarButton({super.key, this.onOpened});

  final VoidCallback? onOpened;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      tooltip: 'Messages',
      onPressed: () {
        onOpened?.call();
        Get.toNamed(Routes.MESSAGES);
      },
      icon: Obx(() {
        final int unread = controller.conversationUnread.value;
        return Badge(
          isLabelVisible: unread > 0,
          backgroundColor: amberColor,
          textColor: textColor,
          label: Text(
            unread > 99 ? '99+' : '$unread',
            style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800),
          ),
          child: const Icon(Icons.message_rounded),
        );
      }),
    );
  }
}
