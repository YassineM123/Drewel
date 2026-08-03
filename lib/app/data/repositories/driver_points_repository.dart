import '../apis/api_constants/api_url_constants.dart';
import '../apis/api_models/driver_points_models.dart';
import '../apis/communication_api_client.dart';

abstract class DriverPointsRepository {
  Future<DriverPointsWallet> getWallet();
  Future<List<PointTransaction>> getTransactions();
  Future<List<PointPack>> getPacks();
  Future<List<PointPurchaseRequest>> getPurchaseRequests();
  Future<PointPurchaseRequest> createPurchaseRequest({
    String? packId,
    int? points,
    required String clientRequestId,
  });
  Future<TripOffer> sendOffer({
    required TripOfferDraft draft,
    required String clientOfferId,
    required String idempotencyKey,
  });
  Future<List<TripOffer>> getMyOffers();
  Future<List<TripOffer>> getIncomingOffers() => getMyOffers();
  Future<TripOffer> acceptOffer(
    String offerId, {
    required String idempotencyKey,
  }) =>
      throw UnimplementedError();
  Future<TripOffer> declineOffer(
    String offerId, {
    required String idempotencyKey,
  }) =>
      throw UnimplementedError();
}

class ApiDriverPointsRepository implements DriverPointsRepository {
  ApiDriverPointsRepository(this._api);

  final CommunicationApiClient _api;

  @override
  Future<DriverPointsWallet> getWallet() async {
    final response =
        await _api.get('${ApiUrlConstants.baseUrl}driver/points/wallet');
    return DriverPointsWallet.fromJson(
      Map<String, dynamic>.from(response['wallet'] as Map),
    );
  }

  @override
  Future<List<PointTransaction>> getTransactions() async {
    final response = await _api
        .get('${ApiUrlConstants.baseUrl}driver/points/transactions?limit=50');
    final dynamic raw = response['transactions'];
    if (raw is! List) return const <PointTransaction>[];
    return raw
        .whereType<Map>()
        .map((item) => PointTransaction.fromJson(
              Map<String, dynamic>.from(item),
            ))
        .toList(growable: false);
  }

  @override
  Future<List<PointPack>> getPacks() async {
    final response =
        await _api.get('${ApiUrlConstants.baseUrl}driver/points/packs');
    final dynamic raw = response['packs'];
    if (raw is! List) return const <PointPack>[];
    return raw
        .whereType<Map>()
        .map((item) => PointPack.fromJson(Map<String, dynamic>.from(item)))
        .toList(growable: false);
  }

  @override
  Future<List<PointPurchaseRequest>> getPurchaseRequests() async {
    final response = await _api
        .get('${ApiUrlConstants.baseUrl}driver/points/purchase-requests');
    final dynamic raw = response['requests'];
    if (raw is! List) return const <PointPurchaseRequest>[];
    return raw
        .whereType<Map>()
        .map((item) => PointPurchaseRequest.fromJson(
              Map<String, dynamic>.from(item),
            ))
        .toList(growable: false);
  }

  @override
  Future<PointPurchaseRequest> createPurchaseRequest({
    String? packId,
    int? points,
    required String clientRequestId,
  }) async {
    assert(
      (packId != null) != (points != null),
      'Exactly one of packId or points must be provided',
    );
    final response = await _api.post(
      '${ApiUrlConstants.baseUrl}driver/points/purchase-requests',
      <String, dynamic>{
        if (packId != null) 'requestedPackId': packId,
        if (points != null) 'requestedPoints': points,
        'clientRequestId': clientRequestId,
      },
    );
    return PointPurchaseRequest.fromJson(
      Map<String, dynamic>.from(response['request'] as Map),
    );
  }

  @override
  Future<TripOffer> sendOffer({
    required TripOfferDraft draft,
    required String clientOfferId,
    required String idempotencyKey,
  }) async {
    final response = await _api.post(
      '${ApiUrlConstants.baseUrl}trip-offers',
      <String, dynamic>{
        'contactRideId': draft.contactRideId,
        'clientOfferId': clientOfferId,
        'offeredPrice': draft.offeredPrice,
        'currency': draft.currency,
        'pickup': draft.pickup,
        'destination': draft.destination,
        if (draft.vehicleType.trim().isNotEmpty)
          'vehicleType': draft.vehicleType.trim(),
        if (draft.note.trim().isNotEmpty) 'note': draft.note.trim(),
      },
      <String, String>{'Idempotency-Key': idempotencyKey},
    );
    return TripOffer.fromJson(
      Map<String, dynamic>.from(response['offer'] as Map),
    );
  }

  @override
  Future<List<TripOffer>> getMyOffers() async {
    final response =
        await _api.get('${ApiUrlConstants.baseUrl}trip-offers/mine?limit=20');
    final dynamic raw = response['offers'];
    if (raw is! List) return const <TripOffer>[];
    return raw
        .whereType<Map>()
        .map((item) => TripOffer.fromJson(Map<String, dynamic>.from(item)))
        .toList(growable: false);
  }

  @override
  Future<List<TripOffer>> getIncomingOffers() async {
    final response = await _api
        .get('${ApiUrlConstants.baseUrl}trip-offers/incoming?limit=20');
    final dynamic raw = response['offers'];
    if (raw is! List) return const <TripOffer>[];
    return raw
        .whereType<Map>()
        .map((item) => TripOffer.fromJson(Map<String, dynamic>.from(item)))
        .toList(growable: false);
  }

  @override
  Future<TripOffer> acceptOffer(
    String offerId, {
    required String idempotencyKey,
  }) =>
      _offerAction(offerId, 'accept', idempotencyKey);

  @override
  Future<TripOffer> declineOffer(
    String offerId, {
    required String idempotencyKey,
  }) =>
      _offerAction(offerId, 'decline', idempotencyKey);

  Future<TripOffer> _offerAction(
    String offerId,
    String action,
    String idempotencyKey,
  ) async {
    final response = await _api.post(
      '${ApiUrlConstants.baseUrl}trip-offers/$offerId/$action',
      const <String, dynamic>{},
      <String, String>{'Idempotency-Key': idempotencyKey},
    );
    return TripOffer.fromJson(
      Map<String, dynamic>.from(response['offer'] as Map),
    );
  }
}
