import '../apis/api_constants/api_url_constants.dart';
import '../apis/api_models/app_notification_model.dart';
import '../apis/communication_api_client.dart';

class NotificationRepository {
  NotificationRepository(this._api);

  final CommunicationApiClient _api;

  Future<List<AppNotificationModel>> list() async {
    final Map<String, dynamic> response =
        await _api.get(ApiUrlConstants.endPointOfNotifications);
    final dynamic raw = response['notifications'] ?? response['data'];
    if (raw is! List) return const <AppNotificationModel>[];
    return raw
        .whereType<Map>()
        .map((Map value) => AppNotificationModel.fromJson(
              Map<String, dynamic>.from(value),
            ))
        .toList(growable: false);
  }

  Future<AppNotificationModel> markRead(String notificationId) async {
    final Map<String, dynamic> response = await _api.post(
      ApiUrlConstants.markNotificationAsRead(notificationId),
    );
    final dynamic raw = response['notification'] ?? response['data'];
    return AppNotificationModel.fromJson(Map<String, dynamic>.from(raw as Map));
  }
}
