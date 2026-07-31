import 'package:drewel/app/data/apis/api_models/driver_points_models.dart';
import 'package:drewel/app/data/repositories/driver_points_repository.dart';
import 'package:drewel/app/modules/points/controllers/driver_points_controller.dart';

DriverPointsWallet testWallet({
  int available = 100,
  int reserved = 0,
  int purchased = 0,
  int rides = 5,
  int cost = 20,
  int? after = 80,
  bool canSend = true,
  String balanceState = 'normal',
  int version = 1,
  bool welcome = true,
}) =>
    DriverPointsWallet(
      availablePoints: available,
      reservedPoints: reserved,
      purchasedPoints: purchased,
      bonusPoints: available - purchased,
      equivalentAvailableRides: rides,
      offerPointsCost: cost,
      availablePointsAfterOfferReservation: after,
      canSendOffer: canSend,
      balanceState: balanceState,
      version: version,
      welcomeBonusGranted: welcome,
      welcomeBonusGrantedAt: DateTime(2026, 7, 29),
    );

class FakePointsRepository implements DriverPointsRepository {
  FakePointsRepository({DriverPointsWallet? wallet})
      : currentWallet = wallet ?? testWallet();

  DriverPointsWallet currentWallet;
  Future<DriverPointsWallet> Function()? walletHandler;
  Future<TripOffer> Function()? offerHandler;
  Future<PointPurchaseRequest> Function()? purchaseHandler;
  List<PointTransaction> transactionItems = <PointTransaction>[];
  List<PointPack> packItems = <PointPack>[];
  List<PointPurchaseRequest> requestItems = <PointPurchaseRequest>[];
  List<TripOffer> offerItems = <TripOffer>[];
  int walletCalls = 0;
  int offerCalls = 0;
  int purchaseCalls = 0;

  @override
  Future<DriverPointsWallet> getWallet() async {
    walletCalls++;
    return walletHandler?.call() ?? currentWallet;
  }

  @override
  Future<List<PointTransaction>> getTransactions() async => transactionItems;

  @override
  Future<List<PointPack>> getPacks() async => packItems;

  @override
  Future<List<PointPurchaseRequest>> getPurchaseRequests() async =>
      requestItems;

  @override
  Future<List<TripOffer>> getMyOffers() async => offerItems;

  @override
  Future<TripOffer> sendOffer({
    required TripOfferDraft draft,
    required String clientOfferId,
    required String idempotencyKey,
  }) async {
    offerCalls++;
    return offerHandler?.call() ??
        const TripOffer(
          id: 'offer-1',
          contactRideId: 'ride-contact-1',
          status: 'pending',
          reservationState: 'reserved',
          pointsCost: 20,
          stateVersion: 0,
        );
  }

  @override
  Future<PointPurchaseRequest> createPurchaseRequest({
    required String packId,
    required String clientRequestId,
  }) async {
    purchaseCalls++;
    return purchaseHandler?.call() ??
        PointPurchaseRequest(
          id: 'request-1',
          reference: clientRequestId,
          status: 'pending',
          points: 200,
          createdAt: DateTime(2026, 7, 29),
        );
  }
}

class FakePointsRealtime implements PointsRealtime {
  final Map<String, void Function(dynamic)> callbacks =
      <String, void Function(dynamic)>{};

  @override
  bool isConnected = false;

  @override
  void connect(String url, String token) {
    isConnected = true;
  }

  @override
  void disconnect() {
    isConnected = false;
  }

  @override
  void off(String event) {
    callbacks.remove(event);
  }

  @override
  void on(String event, void Function(dynamic data) callback) {
    callbacks[event] = callback;
  }

  void emit(String event, Map<String, dynamic> data) =>
      callbacks[event]?.call(data);
}
