import 'package:drewel/app/data/apis/api_models/driver_points_models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('wallet displays only backend-provided balance projections', () {
    final wallet = DriverPointsWallet.fromJson(<String, dynamic>{
      'availablePoints': 100,
      'reservedPoints': 20,
      'availablePurchasedPoints': 40,
      'availableBonusPoints': 60,
      'equivalentAvailableRides': 5,
      'offerPointsCost': 20,
      'availablePointsAfterOfferReservation': 80,
      'canSendOffer': true,
      'balanceState': 'normal',
      'version': 7,
      'welcomeBonusGranted': true,
    });

    expect(wallet.availablePoints, 100);
    expect(wallet.reservedPoints, 20);
    expect(wallet.equivalentAvailableRides, 5);
    expect(wallet.availablePointsAfterOfferReservation, 80);
    expect(wallet.purchasedPoints, 40);
  });

  test('transaction model exposes safe ride and reason fields', () {
    final transaction = PointTransaction.fromJson(<String, dynamic>{
      '_id': 'tx-1',
      'type': 'RIDE_CHARGE',
      'status': 'COMPLETED',
      'points': 20,
      'rideId': 'DRW-1024',
      'offerId': 'offer-1',
      'reason': 'Confirmed ride charge',
      'createdAt': '2026-07-29T12:00:00.000Z',
      'paymentReference': 'must-not-be-modeled',
      'adminId': 'must-not-be-modeled',
    });

    expect(transaction.isDebit, isTrue);
    expect(transaction.rideId, 'DRW-1024');
    expect(transaction.points, 20);
  });

  test('purchase request maps immutable pack snapshot and status', () {
    final request = PointPurchaseRequest.fromJson(<String, dynamic>{
      '_id': 'request-1',
      'clientRequestId': 'purchase-client-1',
      'status': 'payment_pending',
      'packSnapshot': <String, dynamic>{
        'name': 'Pro',
        'points': 200,
        'price': 50,
        'currency': 'AED',
      },
    });

    expect(request.reference, 'purchase-client-1');
    expect(request.points, 200);
    expect(request.status, 'payment_pending');
    expect(request.currency, 'AED');
  });
}
