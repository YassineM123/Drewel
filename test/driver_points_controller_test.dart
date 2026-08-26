import 'dart:async';
import 'dart:io';

import 'package:drewel/app/data/apis/api_models/driver_points_models.dart';
import 'package:drewel/app/modules/points/controllers/driver_points_controller.dart';
import 'package:drewel/app/modules/points/points_translations.dart';
import 'package:drewel/app/modules/points/widgets/trip_offer_points.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get/get.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'points_test_fakes.dart';

const TripOfferDraft _draft = TripOfferDraft(
  contactRideId: 'ride-contact-1',
  offeredPrice: 45,
  currency: 'AED',
  pickup: <String, dynamic>{
    'address': 'Pickup',
    'lat': 25.1,
    'long': 55.1,
  },
  destination: <String, dynamic>{
    'address': 'Destination',
    'lat': 25.2,
    'long': 55.2,
  },
);

void main() {
  setUp(() => Get.testMode = true);
  tearDown(Get.reset);

  test('double tap prevention sends exactly one backend offer', () async {
    final completer = Completer<TripOffer>();
    final repository = FakePointsRepository()
      ..offerHandler = () => completer.future;
    final controller = DriverPointsController(
      repository: repository,
      realtime: FakePointsRealtime(),
    )..applyWallet(testWallet());

    final first = controller.sendOffer(_draft);
    final second = controller.sendOffer(_draft);
    expect(await second, SendOfferResult.failed);
    expect(repository.offerCalls, 1);

    completer.complete(const TripOffer(
      id: 'offer-1',
      contactRideId: 'ride-contact-1',
      status: 'pending',
      reservationState: 'reserved',
      pointsCost: 20,
      stateVersion: 0,
    ));
    expect(await first, SendOfferResult.sent);
    expect(repository.offerCalls, 1);
  });

  test('zero/low wallet never sends an offer', () async {
    final repository = FakePointsRepository();
    final controller = DriverPointsController(
      repository: repository,
      realtime: FakePointsRealtime(),
    )..applyWallet(testWallet(
        available: 0,
        rides: 0,
        after: null,
        canSend: false,
        balanceState: 'zero',
      ));

    expect(
        await controller.sendOffer(_draft), SendOfferResult.insufficientPoints);
    expect(repository.offerCalls, 0);
  });

  test('purchase request is persisted but never changes wallet locally',
      () async {
    final repository = FakePointsRepository();
    final controller = DriverPointsController(
      repository: repository,
      realtime: FakePointsRealtime(),
    )..applyWallet(testWallet(available: 80, version: 4));
    const pack = PointPack(
      id: 'pack-200',
      name: 'Pro',
      points: 200,
      price: 50,
      currency: 'AED',
    );

    final request = await controller.requestPack(pack);

    expect(request?.status, 'pending');
    expect(repository.purchaseCalls, 1);
    expect(controller.wallet.value?.availablePoints, 80);
    expect(controller.purchaseRequests.single.reference, isNotEmpty);
  });

  test('custom point amount request is persisted and never changes wallet',
      () async {
    final repository = FakePointsRepository();
    final controller = DriverPointsController(
      repository: repository,
      realtime: FakePointsRealtime(),
    )..applyWallet(testWallet(available: 80, version: 4));

    final request = await controller.requestCustomPoints(350);

    expect(request?.status, 'pending');
    expect(repository.purchaseCalls, 1);
    expect(repository.lastPurchasePackId, isNull);
    expect(repository.lastPurchasePoints, 350);
    expect(controller.wallet.value?.availablePoints, 80);
    expect(controller.purchaseRequests.single.reference, isNotEmpty);
  });

  test('new socket version refreshes once and duplicate event is ignored',
      () async {
    final repository = FakePointsRepository(
      wallet: testWallet(available: 80, reserved: 20, version: 2),
    );
    final messages = <String>[];
    final controller = DriverPointsController(
      repository: repository,
      realtime: FakePointsRealtime(),
      statusNotifier: messages.add,
    )..applyWallet(testWallet(version: 1));

    const event = <String, dynamic>{
      'walletVersion': 2,
      'offerId': 'offer-1',
      'points': 20,
    };
    controller.handleRealtimeEvent('points:reserved', event);
    controller.handleRealtimeEvent('points:reserved', event);
    await Future<void>.delayed(const Duration(milliseconds: 30));

    expect(repository.walletCalls, 1);
    expect(controller.wallet.value?.version, 2);
    expect(controller.wallet.value?.reservedPoints, 20);
    expect(messages, hasLength(1));
  });

  testWidgets('API refresh fallback retries after a failed socket invalidation',
      (tester) async {
    var attempt = 0;
    final repository = FakePointsRepository()
      ..walletHandler = () async {
        attempt++;
        if (attempt == 1) throw const SocketException('offline');
        return testWallet(available: 80, version: 3);
      };
    final controller = DriverPointsController(
      repository: repository,
      realtime: FakePointsRealtime(),
    )..applyWallet(testWallet(version: 1));

    controller.handleRealtimeEvent('points:charged', <String, dynamic>{
      'walletVersion': 3,
      'offerId': 'offer-1',
      'status': 'accepted',
      'points': 20,
    });
    await tester.pump();
    await tester.pump(const Duration(seconds: 3, milliseconds: 100));
    await tester.pump();

    expect(repository.walletCalls, 2);
    expect(controller.wallet.value?.version, 3);
  });

  testWidgets(
      'Socket disconnection refreshes wallet through API until reconnect',
      (tester) async {
    SharedPreferences.setMockInitialValues(<String, Object>{
      'token': 'driver-jwt',
    });
    final realtime = FakePointsRealtime();
    final repository = FakePointsRepository(
      wallet: testWallet(available: 80, version: 2),
    );
    final controller = DriverPointsController(
      repository: repository,
      realtime: realtime,
    )..applyWallet(testWallet(version: 1));

    await controller.configureRealtime();
    realtime.emit('disconnect', const <String, dynamic>{});
    await tester.pump();

    expect(repository.walletCalls, 1);
    expect(controller.wallet.value?.availablePoints, 80);
    expect(controller.wallet.value?.version, 2);
    expect(controller.isSocketConnected.value, isFalse);

    realtime.emit('connect', const <String, dynamic>{});
    await tester.pump();
    final callsAfterReconnect = repository.walletCalls;
    await tester.pump(const Duration(seconds: 16));
    expect(repository.walletCalls, callsAfterReconnect);
    controller.onClose();
  });

  testWidgets('offer states show release, expiration and ride charge messages',
      (tester) async {
    await tester.pumpWidget(GetMaterialApp(
      translations: PointsTranslations(),
      locale: const Locale('en'),
      home: const Scaffold(
        body: Column(
          children: <Widget>[
            TripOfferStatusCard(
              offer: TripOffer(
                id: 'accepted',
                contactRideId: 'ride-1',
                status: 'accepted',
                reservationState: 'captured',
                pointsCost: 20,
                stateVersion: 1,
              ),
            ),
            TripOfferStatusCard(
              offer: TripOffer(
                id: 'declined',
                contactRideId: 'ride-2',
                status: 'declined',
                reservationState: 'released',
                pointsCost: 20,
                stateVersion: 1,
              ),
            ),
            TripOfferStatusCard(
              offer: TripOffer(
                id: 'expired',
                contactRideId: 'ride-3',
                status: 'expired',
                reservationState: 'released',
                pointsCost: 20,
                stateVersion: 1,
              ),
            ),
            TripOfferStatusCard(
              offer: TripOffer(
                id: 'failed',
                contactRideId: 'ride-4',
                status: 'delivery_failed',
                reservationState: 'released',
                pointsCost: 20,
                stateVersion: 1,
              ),
            ),
          ],
        ),
      ),
    ));
    // Flush flutter_animate entrance timers so no timer stays pending.
    await tester.pump(const Duration(milliseconds: 400));

    expect(find.text('Trip Offer'), findsOneWidget);
    expect(find.text('ACCEPTED'), findsOneWidget);
    expect(find.text('Proposed Fare'), findsOneWidget);
    expect(find.text('Price confirmed'), findsOneWidget);
    expect(find.text('Offer declined: 20 points released'), findsOneWidget);
    expect(find.text('Offer expired: 20 points released'), findsOneWidget);
    expect(find.text('Technical failure: points restored'), findsOneWidget);
  });
}
