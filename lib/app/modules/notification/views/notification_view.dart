import 'package:flutter/material.dart';

import 'package:get/get.dart';
import 'package:intl/intl.dart';
import 'package:responsive_sizer/responsive_sizer.dart';

import '../../../../common/colors.dart';
import '../../../../common/drewel_app_bar.dart';
import '../../../../common/drewel_pop_scope.dart';
import '../../../../common/text_styles.dart';
import '../../../data/apis/api_models/app_notification_model.dart';
import '../../../data/constants/string_constants.dart';
import '../../communication/controllers/call_state_controller.dart';

class NotificationView extends GetView<CallStateController> {
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
          final List<AppNotificationModel> items = controller.notifications;
          return Column(
            mainAxisAlignment: MainAxisAlignment.end,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(
                child: Container(
                  width: MediaQuery.of(context).size.width,
                  margin: EdgeInsets.only(top: 10.px),
                  padding: EdgeInsets.symmetric(
                    horizontal: 15.px,
                    vertical: 20.px,
                  ),
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
                      Text(
                        StringConstants.notifications,
                        style: MyTextStyle.titleStyle18bb,
                      ),
                      const SizedBox(height: 6),
                      Expanded(child: _notificationList(items)),
                    ],
                  ),
                ),
              )
            ],
          );
        }),
      ),
    );
  }

  Widget _notificationList(List<AppNotificationModel> items) {
    if (items.isEmpty) {
      return const _EmptyNotifications();
    }
    return RefreshIndicator(
      onRefresh: controller.refreshNotifications,
      child: ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.only(top: 8),
        itemCount: items.length,
        separatorBuilder: (_, __) => Divider(
          height: 1.px,
          color: Colors.black.withValues(alpha: 0.08),
        ),
        itemBuilder: (BuildContext context, int index) =>
            _NotificationTile(
          notification: items[index],
          onTap: () => _openNotification(items[index]),
        ),
      ),
    );
  }

  Future<void> _openNotification(AppNotificationModel notification) async {
    if (!notification.read) {
      await controller.markNotificationRead(notification.id);
    }
    final String rideId = notification.rideId ?? '';
    if (rideId.isNotEmpty) {
      controller.openConversation(rideId);
    }
  }
}

class _NotificationTile extends StatelessWidget {
  const _NotificationTile({required this.notification, required this.onTap});

  final AppNotificationModel notification;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final bool unread = !notification.read;
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: EdgeInsets.symmetric(vertical: 12.px),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: primaryColor.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: Icon(
                _iconFor(notification.type),
                color: primaryColor,
              ),
            ),
            SizedBox(width: 12.px),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Row(
                    children: <Widget>[
                      Expanded(
                        child: Text(
                          _titleFor(notification.type),
                          style: TextStyle(
                            fontSize: 14.px,
                            fontWeight:
                                unread ? FontWeight.w800 : FontWeight.w600,
                          ),
                        ),
                      ),
                      if (notification.createdAt != null)
                        Text(
                          _timeLabel(notification.createdAt!),
                          style: TextStyle(
                            fontSize: 11.px,
                            color: unread ? primaryColor : text2Color,
                            fontWeight:
                                unread ? FontWeight.w700 : FontWeight.w500,
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    notification.message,
                    style: TextStyle(
                      fontSize: 13.px,
                      color: unread ? textColor : text2Color,
                      fontWeight: unread ? FontWeight.w600 : FontWeight.w400,
                    ),
                  ),
                ],
              ),
            ),
            if (unread)
              Container(
                margin: EdgeInsets.only(left: 8.px, top: 6.px),
                width: 10,
                height: 10,
                decoration: const BoxDecoration(
                  color: primaryColor,
                  shape: BoxShape.circle,
                ),
              ),
          ],
        ),
      ),
    );
  }

  IconData _iconFor(String? type) => switch (type) {
        'RIDE_MESSAGE' => Icons.chat_bubble_rounded,
        'RIDE_STATUS' => Icons.navigation_rounded,
        'OFFER' => Icons.local_offer_rounded,
        'CALL' => Icons.call_rounded,
        _ => Icons.notifications_rounded,
      };

  String _titleFor(String? type) => switch (type) {
        'RIDE_MESSAGE' => 'New message',
        'RIDE_STATUS' => 'Ride update',
        'OFFER' => 'Trip offer',
        'CALL' => 'Call',
        _ => 'Notification',
      };

  String _timeLabel(DateTime at) {
    final DateTime local = at.toLocal();
    final DateTime now = DateTime.now();
    if (now.year == local.year &&
        now.month == local.month &&
        now.day == local.day) {
      return DateFormat.Hm().format(local);
    }
    if (now.year == local.year) return DateFormat.MMMd().format(local);
    return DateFormat.yMMMd().format(local);
  }
}

class _EmptyNotifications extends StatelessWidget {
  const _EmptyNotifications();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Padding(
        padding: EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Icon(
              Icons.notifications_none_rounded,
              size: 56,
              color: Color(0xFFC9C9C9),
            ),
            SizedBox(height: 16),
            Text(
              'No notifications',
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: textColor,
              ),
            ),
            SizedBox(height: 6),
            Text(
              'Updates about your rides and messages appear here.',
              textAlign: TextAlign.center,
              style: TextStyle(color: text2Color),
            ),
          ],
        ),
      ),
    );
  }
}
