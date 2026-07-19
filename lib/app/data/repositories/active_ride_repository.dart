import '../apis/api_constants/api_url_constants.dart';
import '../apis/api_models/active_ride_model.dart';
import '../apis/communication_api_client.dart';

class ActiveRideRepository {
  ActiveRideRepository(this._api);

  final CommunicationApiClient _api;

  ActiveRideModel _readRide(Map<String, dynamic> response) {
    final dynamic raw = response['ride'] ?? response['data'];
    return ActiveRideModel.fromJson(Map<String, dynamic>.from(raw as Map));
  }

  Future<ActiveRideModel> requestRide(String driverId) async => _readRide(
        await _api.post(
          '${ApiUrlConstants.baseUrl}rides',
          <String, dynamic>{'driverId': driverId},
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
    String status,
  ) async =>
      _readRide(
        await _api.patch(
          '${ApiUrlConstants.baseUrl}rides/$rideId/status',
          <String, dynamic>{'status': status},
        ),
      );

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
