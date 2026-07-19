import 'dart:math';

import '../apis/api_constants/api_url_constants.dart';
import '../apis/api_models/ride_message_model.dart';
import '../apis/communication_api_client.dart';

class RideMessageRepository {
  RideMessageRepository(this._api);

  final CommunicationApiClient _api;

  Future<List<RideMessageModel>> list(String rideId) async {
    final Map<String, dynamic> response =
        await _api.get(ApiUrlConstants.rideMessages(rideId));
    final dynamic raw = response['messages'] ?? response['data'];
    if (raw is! List) return const <RideMessageModel>[];
    return raw
        .whereType<Map>()
        .map((Map value) => RideMessageModel.fromJson(
              Map<String, dynamic>.from(value),
            ))
        .toList(growable: false);
  }

  Future<RideMessageModel> send(String rideId, String text) async {
    final String clientMessageId =
        '${DateTime.now().microsecondsSinceEpoch.toRadixString(36)}-'
        '${Random.secure().nextInt(1 << 32).toRadixString(36)}';
    final Map<String, dynamic> response = await _api.post(
      ApiUrlConstants.rideMessages(rideId),
      <String, dynamic>{
        'text': text,
        'clientMessageId': clientMessageId,
      },
    );
    final dynamic raw = response['message'] ?? response['data'];
    return RideMessageModel.fromJson(Map<String, dynamic>.from(raw as Map));
  }

  Future<RideMessageModel> markReceipt(
    String rideId,
    String messageId,
    RideMessageStatus status,
  ) async {
    final Map<String, dynamic> response = await _api.patch(
      '${ApiUrlConstants.rideMessages(rideId)}/$messageId/receipt',
      <String, dynamic>{'status': status.name},
    );
    final dynamic raw = response['message'] ?? response['data'];
    return RideMessageModel.fromJson(Map<String, dynamic>.from(raw as Map));
  }
}
