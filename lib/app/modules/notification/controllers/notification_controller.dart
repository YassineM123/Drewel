import 'package:get/get.dart';

import '../../../data/apis/api_models/app_notification_model.dart';
import '../../../data/repositories/notification_repository.dart';
import '../../communication/controllers/call_state_controller.dart';

/// Controller for the in-app Notifications screen.
///
/// Binds seamlessly to [CallStateController] for realtime notifications,
/// reactive unread counts, filtering, pagination, and mark-read capabilities.
class NotificationController extends GetxController {
  CallStateController get _callState => Get.find<CallStateController>();

  RxList<AppNotificationModel> get notifications => _callState.notifications;
  RxInt get unreadCount => _callState.notificationUnread;
  RxBool get isLoading => _callState.notificationsLoading;
  RxBool get hasMore => _callState.notificationsHasMore;
  Rxn<NotificationFilter> get filter => _callState.notificationFilter;

  @override
  void onInit() {
    super.onInit();
    refreshNotifications();
  }

  Future<void> refreshNotifications() => _callState.refreshNotifications();

  Future<void> loadMoreNotifications() => _callState.loadMoreNotifications();

  Future<void> setFilter(NotificationFilter selectedFilter) =>
      _callState.setNotificationFilter(selectedFilter);

  Future<void> markAsRead(String id) => _callState.markNotificationRead(id);

  Future<void> markAllAsRead() => _callState.markAllNotificationsRead();

  Future<void> openNotification(AppNotificationModel notification) =>
      _callState.openNotification(notification);
}
