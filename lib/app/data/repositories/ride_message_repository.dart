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

  static String newClientMessageId() =>
      '${DateTime.now().microsecondsSinceEpoch.toRadixString(36)}-'
      '${Random.secure().nextInt(1 << 32).toRadixString(36)}';

  Future<RideMessageModel> send(
    String rideId,
    String text, {
    String? clientMessageId,
  }) async {
    final String idempotencyKey = clientMessageId ?? newClientMessageId();
    final Map<String, dynamic> response = await _api.post(
      ApiUrlConstants.rideMessages(rideId),
      <String, dynamic>{
        'text': text,
        'clientMessageId': idempotencyKey,
      },
    );
    final dynamic raw = response['message'] ?? response['data'];
    return RideMessageModel.fromJson(Map<String, dynamic>.from(raw as Map));
  }

  Future<RideMessageModel> sendTripRequest(
    String rideId, {
    required Map<String, dynamic> pickup,
    required Map<String, dynamic> destination,
    required double proposedPrice,
    required String currency,
    String note = '',
    String? clientMessageId,
  }) async {
    final String idempotencyKey = clientMessageId ?? newClientMessageId();
    final String priceLabel =
        '${proposedPrice.toStringAsFixed(2)} ${currency.toUpperCase()}';
    final String pickupLabel = _routePointText('Pickup', pickup);
    final String destinationLabel = _routePointText('Destination', destination);
    final Map<String, dynamic> response = await _api.post(
      ApiUrlConstants.rideMessages(rideId),
      <String, dynamic>{
        'text': <String>[
          'Trip request: $priceLabel',
          pickupLabel,
          destinationLabel,
        ].join('\n'),
        'clientMessageId': idempotencyKey,
        'messageType': 'trip_request',
        'metadata': <String, dynamic>{
          'pickup': pickup,
          'destination': destination,
          'proposedPrice': proposedPrice,
          'currency': currency.toUpperCase(),
          if (note.trim().isNotEmpty) 'note': note.trim(),
        },
      },
    );
    final dynamic raw = response['message'] ?? response['data'];
    return RideMessageModel.fromJson(Map<String, dynamic>.from(raw as Map));
  }

  static String _routePointText(String label, Map<String, dynamic> point) {
    final String address = (point['address'] ?? '').toString().trim();
    final double? lat = point['lat'] is num
        ? (point['lat'] as num).toDouble()
        : double.tryParse((point['lat'] ?? '').toString());
    final double? long = point['long'] is num
        ? (point['long'] as num).toDouble()
        : double.tryParse((point['long'] ?? '').toString());
    final String name = address.isEmpty ? 'Pinned location' : address;
    if (lat == null || long == null) return '$label: $name';
    return '$label: $name (${lat.toStringAsFixed(6)}, ${long.toStringAsFixed(6)})';
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
