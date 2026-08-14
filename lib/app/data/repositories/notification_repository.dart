import '../apis/api_constants/api_url_constants.dart';
import '../apis/api_models/app_notification_model.dart';
import '../apis/communication_api_client.dart';

/// Filter groups exposed by the backend `GET /notification/get-notifications`.
enum NotificationFilter {
  all('all'),
  rides('rides'),
  messages('messages'),
  system('system');

  const NotificationFilter(this.value);
  final String value;
}

class NotificationListResult {
  const NotificationListResult({
    required this.notifications,
    required this.unreadCount,
    required this.hasMore,
  });

  final List<AppNotificationModel> notifications;
  final int unreadCount;
  final bool hasMore;
}

class NotificationRepository {
  NotificationRepository(this._api);

  final CommunicationApiClient _api;

  static const int pageSize = 40;

  Future<NotificationListResult> list({
    NotificationFilter filter = NotificationFilter.all,
    int page = 1,
    int pageSize = NotificationRepository.pageSize,
  }) async {
    final Map<String, dynamic> response = await _api.get(
      Uri.parse(ApiUrlConstants.endPointOfNotifications)
          .replace(queryParameters: <String, String>{
            'filter': filter.value,
            'page': '$page',
            'limit': '$pageSize',
          })
          .toString(),
    );
    final List<AppNotificationModel> items = _parseNotifications(response);
    final int unreadCount =
        (response['unreadCount'] as num?)?.toInt() ?? 0;
    final dynamic pagination = response['pagination'];
    final int total = pagination is Map
        ? (pagination['total'] as num?)?.toInt() ?? items.length
        : items.length;
    return NotificationListResult(
      notifications: items,
      unreadCount: unreadCount,
      hasMore: page * pageSize < total,
    );
  }

  Future<int> unreadCount() async {
    final Map<String, dynamic> response =
        await _api.get(ApiUrlConstants.endPointOfNotificationUnreadCount);
    return (response['unreadCount'] as num?)?.toInt() ?? 0;
  }

  /// Marks one notification as read and returns the updated unread total.
  Future<int> markRead(String notificationId) async {
    final Map<String, dynamic> response = await _api.post(
      ApiUrlConstants.markNotificationAsRead(notificationId),
    );
    return (response['unreadCount'] as num?)?.toInt() ?? 0;
  }

  /// Marks every notification as read and returns the updated unread total.
  Future<int> markAllAsRead() async {
    final Map<String, dynamic> response =
        await _api.post(ApiUrlConstants.endPointOfMarkAllNotificationsRead);
    return (response['unreadCount'] as num?)?.toInt() ?? 0;
  }

  List<AppNotificationModel> _parseNotifications(
    Map<String, dynamic> response,
  ) {
    final dynamic raw = response['notifications'] ?? response['data'];
    if (raw is! List) return const <AppNotificationModel>[];
    return raw
        .whereType<Map>()
        .map((Map value) => AppNotificationModel.fromJson(
              Map<String, dynamic>.from(value),
            ))
        .toList(growable: false);
  }
}
