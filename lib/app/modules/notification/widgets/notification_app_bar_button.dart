import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../../common/colors.dart';
import '../../../routes/app_pages.dart';
import '../../communication/controllers/call_state_controller.dart';

class NotificationAppBarButton extends GetView<CallStateController> {
  const NotificationAppBarButton({super.key});

  @override
  Widget build(BuildContext context) {
    return IconButton(
      tooltip: 'Notifications',
      onPressed: () {
        Get.toNamed(Routes.NOTIFICATIONS);
      },
      icon: Obx(() {
        final int unread = controller.notificationUnread.value;
        return Badge(
          isLabelVisible: unread > 0,
          backgroundColor: amberColor,
          textColor: textColor,
          label: Text(
            unread > 99 ? '99+' : '$unread',
            style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800),
          ),
          child: const Icon(Icons.notifications_none_rounded),
        );
      }),
    );
  }
}
