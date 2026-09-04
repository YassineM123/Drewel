import 'package:flutter/material.dart';

import 'package:get/get.dart';
import 'package:intl/intl.dart';
import 'package:responsive_sizer/responsive_sizer.dart';

import '../../../../common/colors.dart';
import '../../../../common/drewel_app_bar.dart';
import '../../../../common/drewel_pop_scope.dart';
import '../../../../common/text_styles.dart';
import '../../../data/apis/api_models/app_notification_model.dart';
import '../../../data/repositories/notification_repository.dart';
import '../../communication/controllers/call_state_controller.dart';

class NotificationView extends GetView<CallStateController> {
  const NotificationView({super.key});

  final ScrollController? _scrollController = null;

  @override
  Widget build(BuildContext context) {
    return DrewelPopScope(
      child: Scaffold(
        appBar: DrewelAppBar(
          title: 'Notifications',
          showBackButton: true,
          actions: <Widget>[
            IconButton(
              tooltip: 'Mark all as read',
              onPressed: controller.notificationUnread.value > 0
                  ? controller.markAllNotificationsRead
                  : null,
              icon: const Icon(Icons.done_all_rounded),
            ),
            SizedBox(width: 4.px),
          ],
        ),
        backgroundColor: primaryColor,
        body: Obx(() {
          final List<AppNotificationModel> items = controller.notifications;
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Padding(
                padding: EdgeInsets.fromLTRB(15.px, 6.px, 15.px, 0),
                child: _FilterChips(
                  selected: controller.notificationFilter.value ??
                      NotificationFilter.all,
                  onSelected: controller.setNotificationFilter,
                ),
              ),
              Expanded(
                child: Container(
                  width: MediaQuery.of(context).size.width,
                  margin: EdgeInsets.only(top: 10.px),
                  padding: EdgeInsets.symmetric(
                    horizontal: 15.px,
                    vertical: 16.px,
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
                    children: <Widget>[
                      Row(
                        children: <Widget>[
                          Expanded(
                            child: Text(
                              'all_activity'.tr,
                              style: MyTextStyle.titleStyle18bb,
                            ),
                          ),
                          Obx(() {
                            final int unread =
                                controller.notificationUnread.value;
                            return Text(
                              unread > 0
                                  ? '$unread ${'unread'.tr}'
                                  : 'all_caught_up'.tr,
                              style: TextStyle(
                                fontSize: 12.px,
                                color: unread > 0 ? primaryColor : text2Color,
                                fontWeight: FontWeight.w600,
                              ),
                            );
                          }),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Expanded(
                        child: NotificationList(
                          controller: controller,
                          items: items,
                          scrollController: _scrollController,
                        ),
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
}

class NotificationList extends StatefulWidget {
  const NotificationList({
    super.key,
    required this.controller,
    required this.items,
    required this.scrollController,
  });

  final CallStateController controller;
  final List<AppNotificationModel> items;
  final ScrollController? scrollController;

  @override
  State<NotificationList> createState() => _NotificationListState();
}

class _NotificationListState extends State<NotificationList> {
  late final ScrollController _controller;

  @override
  void initState() {
    super.initState();
    _controller = widget.scrollController ?? ScrollController();
    _controller.addListener(_onScroll);
  }

  void _onScroll() {
    if (!_controller.hasClients) return;
    if (_controller.position.pixels >=
        _controller.position.maxScrollExtent - 240) {
      widget.controller.loadMoreNotifications();
    }
  }

  @override
  void dispose() {
    if (widget.scrollController == null) {
      _controller.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final List<AppNotificationModel> items = widget.items;
    if (items.isEmpty) {
      return const _EmptyNotifications();
    }
    return RefreshIndicator(
      onRefresh: widget.controller.refreshNotifications,
      child: ListView.separated(
        controller: _controller,
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.only(bottom: 24),
        itemCount: items.length + 1,
        separatorBuilder: (_, __) => Divider(
          height: 1.px,
          color: Colors.black.withValues(alpha: 0.08),
        ),
        itemBuilder: (BuildContext context, int index) {
          if (index == items.length) {
            return Obx(() => widget.controller.notificationsLoading.value
                ? const Padding(
                    padding: EdgeInsets.symmetric(vertical: 16),
                    child: Center(
                      child: SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(strokeWidth: 2.4),
                      ),
                    ),
                  )
                : const SizedBox.shrink());
          }
          final AppNotificationModel notification = items[index];
          return _NotificationTile(
            notification: notification,
            onTap: () => widget.controller.openNotification(notification),
          );
        },
      ),
    );
  }
}

class _FilterChips extends StatelessWidget {
  const _FilterChips({required this.selected, required this.onSelected});

  final NotificationFilter selected;
  final ValueChanged<NotificationFilter> onSelected;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: <NotificationFilter>[
        NotificationFilter.all,
        NotificationFilter.rides,
        NotificationFilter.messages,
        NotificationFilter.system,
      ].map((NotificationFilter filter) {
        final bool isActive = filter == selected;
        return Padding(
          padding: EdgeInsets.only(right: 8.px),
          child: InkWell(
            borderRadius: BorderRadius.circular(20.px),
            onTap: () => onSelected(filter),
            child: Container(
              padding: EdgeInsets.symmetric(horizontal: 14.px, vertical: 7.px),
              decoration: BoxDecoration(
                color: isActive ? primaryColor : primary3Color,
                borderRadius: BorderRadius.circular(20.px),
                border: Border.all(
                  color: isActive
                      ? primaryColor
                      : primaryColor.withValues(alpha: 0.3),
                ),
              ),
              child: Text(
                switch (filter) {
                  NotificationFilter.all => 'All',
                  NotificationFilter.rides => 'Rides',
                  NotificationFilter.messages => 'Messages',
                  NotificationFilter.system => 'System',
                },
                style: TextStyle(
                  fontSize: 13.px,
                  fontWeight: FontWeight.w600,
                  color: isActive ? primary3Color : textColor,
                ),
              ),
            ),
          ),
        );
      }).toList(growable: false),
    );
  }
}

class _NotificationTile extends StatelessWidget {
  const _NotificationTile({required this.notification, required this.onTap});

  final AppNotificationModel notification;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final bool unread = notification.isUnread;
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
                color: (unread ? primaryColor : text2Color)
                    .withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: Icon(
                _iconFor(notification.type),
                color: unread ? primaryColor : text2Color,
                size: 22,
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
                          notification.effectiveTitle,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
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
                  const SizedBox(height: 3),
                  Text(
                    notification.message,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 13.px,
                      color: unread ? textColor : text2Color,
                      fontWeight: unread ? FontWeight.w600 : FontWeight.w400,
                    ),
                  ),
                  if (notification.effectiveDeepLink
                      .startsWith('drewel://')) ...<Widget>[
                    const SizedBox(height: 4),
                    Row(
                      children: <Widget>[
                        Icon(
                          Icons.open_in_new_rounded,
                          size: 13,
                          color: primaryColor.withValues(alpha: 0.7),
                        ),
                        SizedBox(width: 4.px),
                        Text(
                          _actionLabel(notification),
                          style: TextStyle(
                            fontSize: 12.px,
                            color: primaryColor,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ],
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

  String _actionLabel(AppNotificationModel notification) {
    final String link = notification.effectiveDeepLink;
    if (link.contains('/chat/')) return 'Open chat';
    if (link.contains('/ride-request')) return 'View ride request';
    if (link.contains('/active-ride')) return 'Open ride';
    if (link.contains('/points')) return 'View points';
    if (link.contains('/documents') || link.contains('/status')) {
      return 'View status';
    }
    if (link.contains('/support')) return 'Get support';
    if (link.contains('/ride-summary') || link.contains('/rides')) {
      return 'View ride';
    }
    return 'Open';
  }

  IconData _iconFor(String? type) => switch (type) {
        'RIDE_MESSAGE' => Icons.chat_bubble_rounded,
        'RIDE_REQUEST' => Icons.local_taxi_rounded,
        'RIDE_CONFIRMED' ||
        'RIDE_ACCEPTED' ||
        'RIDE_ON_THE_WAY' ||
        'DRIVER_ARRIVED' ||
        'RIDE_STARTED' =>
          Icons.navigation_rounded,
        'RIDE_COMPLETED' => Icons.check_circle_rounded,
        'RIDE_CANCELLED' ||
        'RIDE_DRIVER_CANCELLED' ||
        'RIDE_PASSENGER_CANCELLED' =>
          Icons.cancel_rounded,
        'RIDE_DISPUTED' => Icons.flag_rounded,
        'DRIVER_APPROVED' => Icons.verified_rounded,
        'DRIVER_REJECTED' => Icons.gpp_bad_rounded,
        'TRIP_OFFER_RECEIVED' ||
        'TRIP_OFFER_ACCEPTED' ||
        'TRIP_OFFER_UPDATED' =>
          Icons.local_offer_rounded,
        String type
            when type.startsWith('POINTS') ||
                type.startsWith('OFFER_POINTS') ||
                type.startsWith('RIDE_POINTS') ||
                type.startsWith('WELCOME') ||
                type == 'POINT_PURCHASE_REQUEST_UPDATED' =>
          Icons.stars_rounded,
        _ => Icons.notifications_rounded,
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
              'no_notifications'.tr,
              style: const TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: textColor,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'updates_about_rides_appear_here'.tr,
              textAlign: TextAlign.center,
              style: const TextStyle(color: text2Color),
            ),
          ],
        ),
      ),
    );
  }
}
