import '../apis/api_constants/api_url_constants.dart';
import '../apis/api_models/active_ride_model.dart';
import '../apis/communication_api_client.dart';

class ActiveRideRepository {
  ActiveRideRepository(this._api);

  final CommunicationApiClient _api;

  ActiveRideModel _readRide(Map<String, dynamic> response) {
    final dynamic raw = response['ride'] ?? response['data'];
    if (raw is! Map) {
      throw const CommunicationApiException(
        'The server returned invalid ride data.',
      );
    }
    return ActiveRideModel.fromJson(Map<String, dynamic>.from(raw));
  }

  Future<ActiveRideModel> createOrGetContact(
    String driverId, {
    Map<String, dynamic>? pickup,
    Map<String, dynamic>? destination,
  }) async =>
      _readRide(
        await _api.post(
          '${ApiUrlConstants.baseUrl}rides/contact',
          <String, dynamic>{
            'driverId': driverId,
            if (pickup != null) 'pickup': pickup,
            if (destination != null) 'destination': destination,
          },
        ),
      );

  Future<ActiveRideModel> confirmMission(
    String rideId, {
    required Map<String, dynamic> pickup,
    required Map<String, dynamic> destination,
    String? vehicleType,
    double? price,
  }) async =>
      _readRide(
        await _api.post(
          '${ApiUrlConstants.baseUrl}rides/$rideId/confirm',
          <String, dynamic>{
            'pickup': pickup,
            'destination': destination,
            if (vehicleType?.trim().isNotEmpty == true)
              'vehicleType': vehicleType,
            if (price != null) 'price': price,
          },
        ),
      );

  Future<List<ActiveRideModel>> listMine({String? status}) async {
    final String query = status == null ? '' : '?status=$status';
    final Map<String, dynamic> response =
        await _api.get('${ApiUrlConstants.baseUrl}rides/mine$query');
    final dynamic raw = response['rides'] ?? response['data'];
    if (raw is! List) return const <ActiveRideModel>[];
    return raw
        .whereType<Map>()
        .map((Map item) => ActiveRideModel.fromJson(
              Map<String, dynamic>.from(item),
            ))
        .toList(growable: false);
  }

  Future<ActiveRideModel> transitionRide(
    String rideId,
    String status, {
    String? idempotencyKey,
    RideCoordinateModel? location,
    String? pickupPin,
    String? reason,
    String? note,
  }) async =>
      _readRide(
        await _api.patch(
          '${ApiUrlConstants.baseUrl}rides/$rideId/status',
          <String, dynamic>{
            'status': status,
            if (location != null) 'location': location.toJson(),
            if (pickupPin?.trim().isNotEmpty == true)
              'pickupPin': pickupPin!.trim(),
            if (reason?.trim().isNotEmpty == true) 'reason': reason!.trim(),
            if (note?.trim().isNotEmpty == true) 'note': note!.trim(),
          },
          idempotencyKey == null
              ? null
              : <String, String>{'Idempotency-Key': idempotencyKey},
        ),
      );

  Future<ActiveRideModel> getRide(String rideId) async => _readRide(
        await _api.get('${ApiUrlConstants.baseUrl}rides/$rideId'),
      );

  Future<RideRouteModel> getRoute(
    String rideId, {
    required String phase,
  }) async {
    final Map<String, dynamic> response = await _api.get(
      '${ApiUrlConstants.baseUrl}rides/$rideId/route?phase='
      '${Uri.encodeQueryComponent(phase)}',
    );
    final dynamic raw = response['route'] ?? response['data'];
    if (raw is! Map) {
      throw const CommunicationApiException(
        'The server returned invalid route data.',
      );
    }
    return RideRouteModel.fromJson(Map<String, dynamic>.from(raw));
  }

  Future<ActiveRideModel> cancelRide(
    String rideId, {
    required String reason,
    required String note,
    required String idempotencyKey,
    RideCoordinateModel? location,
  }) async =>
      _readRide(
        await _api.post(
          '${ApiUrlConstants.baseUrl}rides/$rideId/cancel',
          <String, dynamic>{
            'reason': reason.trim(),
            if (note.trim().isNotEmpty) 'note': note.trim(),
            if (location != null) 'location': location.toJson(),
          },
          <String, String>{'Idempotency-Key': idempotencyKey},
        ),
      );

  Future<ActiveRideModel> submitReview(
    String rideId, {
    required int rating,
    String comment = '',
  }) async =>
      _readRide(
        await _api.post(
          '${ApiUrlConstants.baseUrl}rides/$rideId/review',
          <String, dynamic>{
            'rating': rating,
            if (comment.trim().isNotEmpty) 'comment': comment.trim(),
          },
        ),
      );

  Future<void> updateDriverLocation(
    String rideId,
    RideCoordinateModel location,
  ) async {
    await _api.post(
      '${ApiUrlConstants.baseUrl}rides/$rideId/location',
      location.toJson(),
    );
  }

  Future<ActiveRideModel?> getActiveRide() async {
    try {
      final Map<String, dynamic> response =
          await _api.get(ApiUrlConstants.endPointOfActiveRide);
      final dynamic raw = response['ride'] ?? response['data'];
      if (raw is! Map) return null;
      final ActiveRideModel ride =
          ActiveRideModel.fromJson(Map<String, dynamic>.from(raw));
      return ride.hasBackendRideId ? ride : null;
    } on CommunicationApiException catch (error) {
      if (error.statusCode == 404) return null;
      rethrow;
    }
  }

  Future<void> report(String rideId, String reason) async {
    await _api.post(
      '${ApiUrlConstants.baseUrl}rides/$rideId/report',
      <String, dynamic>{'reason': reason},
    );
  }

  Future<void> block(String rideId, String reason) async {
    await _api.post(
      '${ApiUrlConstants.baseUrl}rides/$rideId/block',
      <String, dynamic>{'reason': reason},
    );
  }
}
