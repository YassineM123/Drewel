import 'dart:async';

import 'package:drewel/app/data/apis/api_models/driver_points_models.dart';
import 'package:drewel/app/modules/points/controllers/driver_points_controller.dart';
import 'package:drewel/app/modules/points/points_translations.dart';
import 'package:drewel/app/modules/points/views/buy_points_view.dart';
import 'package:drewel/app/modules/points/views/my_points_view.dart';
import 'package:drewel/app/modules/points/widgets/driver_points_indicator.dart';
import 'package:drewel/app/modules/points/widgets/trip_offer_points.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get/get.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'points_test_fakes.dart';

Widget _app(Widget home, {Locale locale = const Locale('en')}) =>
    GetMaterialApp(
      locale: locale,
      fallbackLocale: const Locale('en'),
      translations: PointsTranslations(),
      supportedLocales: const <Locale>[Locale('en'), Locale('ar')],
      localizationsDelegates: const <LocalizationsDelegate<dynamic>>[
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      home: home,
    );

void main() {
  setUp(() {
    Get.testMode = true;
    SharedPreferences.setMockInitialValues(<String, Object>{});
  });

  tearDown(Get.reset);

  testWidgets('shows 100 welcome balance and transaction history',
      (tester) async {
    final repository = FakePointsRepository();
    repository.transactionItems = <PointTransaction>[
      PointTransaction(
        id: 'tx-welcome',
        type: 'WELCOME_BONUS',
        status: 'COMPLETED',
        points: 100,
        createdAt: DateTime(2026, 7, 29),
      ),
      PointTransaction(
        id: 'tx-ride',
        type: 'RIDE_CHARGE',
        status: 'COMPLETED',
        points: 20,
        createdAt: DateTime(2026, 7, 30),
        rideId: 'DRW-1024',
      ),
    ];
    Get.put(
      DriverPointsController(
        repository: repository,
        realtime: FakePointsRealtime(),
      ),
    );

    await tester.pumpWidget(_app(const MyPointsView()));
    await tester.pumpAndSettle();

    expect(find.text('100'), findsOneWidget);
    expect(find.text('Welcome bonus received'), findsOneWidget);
    expect(find.text('Welcome bonus'), findsWidgets);
    await tester.drag(
      find.byKey(const Key('my-points-list')),
      const Offset(0, -350),
    );
    await tester.pumpAndSettle();
    expect(find.text('Ride DRW-1024'), findsOneWidget);
    expect(find.text('−20'), findsOneWidget);
  });

  testWidgets('wallet renders a loading skeleton', (tester) async {
    final completer = Completer<DriverPointsWallet>();
    final repository = FakePointsRepository()
      ..walletHandler = () => completer.future;
    Get.put(
      DriverPointsController(
        repository: repository,
        realtime: FakePointsRealtime(),
      ),
    );

    await tester.pumpWidget(_app(const MyPointsView()));
    await tester.pump();

    expect(find.bySemanticsLabel('Loading balance'), findsOneWidget);
    completer.complete(testWallet());
    await tester.pumpAndSettle();
  });

  testWidgets('home indicator renders low, zero, error and offline states',
      (tester) async {
    final controller = DriverPointsController(
      repository: FakePointsRepository(),
      realtime: FakePointsRealtime(),
    );
    Get.put(controller);
    await tester.pumpWidget(_app(const Scaffold(
      body: Center(child: DriverPointsIndicator()),
    )));
    await tester.pumpAndSettle();

    controller
      ..applyWallet(testWallet(
        available: 10,
        rides: 0,
        after: null,
        canSend: false,
        balanceState: 'low',
        version: 2,
      ))
      ..state.value = PointsLoadState.ready;
    await tester.pump();
    expect(find.textContaining('Low balance'), findsOneWidget);

    controller.applyWallet(testWallet(
      available: 0,
      rides: 0,
      after: null,
      canSend: false,
      balanceState: 'zero',
      version: 3,
    ));
    await tester.pump();
    expect(find.textContaining('No balance available'), findsOneWidget);

    controller
      ..wallet.value = null
      ..state.value = PointsLoadState.error;
    await tester.pump();
    expect(find.text('Unable to load your balance.'), findsOneWidget);

    controller.state.value = PointsLoadState.offline;
    await tester.pump();
    expect(find.text('Balance unavailable while offline.'), findsOneWidget);

    final semantics =
        tester.getSemantics(find.byKey(const Key('driver-points-indicator')));
    expect(semantics.label, contains('Open My Balance'));
    expect(
        tester.getSize(find.byKey(const Key('driver-points-indicator'))).height,
        greaterThanOrEqualTo(48));
  });

  testWidgets('offer confirmation uses server-provided 100, 20 and 80',
      (tester) async {
    final controller = DriverPointsController(
      repository: FakePointsRepository(),
      realtime: FakePointsRealtime(),
    );
    Get.put(controller);
    await tester.pumpWidget(_app(Builder(
      builder: (context) => Scaffold(
        body: FilledButton(
          onPressed: () => showOfferReservationConfirmation(
            context,
            controller,
          ),
          child: const Text('Open'),
        ),
      ),
    )));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('offer-reservation-dialog')), findsOneWidget);
    expect(find.text('100 balance'), findsOneWidget);
    expect(find.text('20 balance'), findsOneWidget);
    expect(find.text('80 balance'), findsOneWidget);
    expect(find.text('Send Offer — 20 balance'), findsOneWidget);
  });

  testWidgets('insufficient balance dialog offers Add Balance', (tester) async {
    final repository = FakePointsRepository(
      wallet: testWallet(
        available: 10,
        rides: 0,
        after: null,
        canSend: false,
        balanceState: 'low',
      ),
    );
    final controller = DriverPointsController(
      repository: repository,
      realtime: FakePointsRealtime(),
    );
    Get.put(controller);
    await tester.pumpWidget(_app(Builder(
      builder: (context) => Scaffold(
        body: FilledButton(
          onPressed: () => showOfferReservationConfirmation(
            context,
            controller,
          ),
          child: const Text('Open'),
        ),
      ),
    )));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('insufficient-points-dialog')), findsOneWidget);
    expect(
      find.text("You don't have enough balance to send this offer."),
      findsOneWidget,
    );
    expect(find.text('Add Balance'), findsOneWidget);
  });

  testWidgets('Add Balance creates a request and shows its reference',
      (tester) async {
    final repository = FakePointsRepository()
      ..packItems = const <PointPack>[
        PointPack(
          id: 'pack-200',
          name: 'Pro',
          points: 200,
          price: 50,
          currency: 'AED',
        ),
      ];
    final controller = DriverPointsController(
      repository: repository,
      realtime: FakePointsRealtime(),
    );
    Get.put(controller);
    await tester.pumpWidget(_app(const BuyPointsView()));
    await tester.pumpAndSettle();

    expect(find.text('200 Available balance'), findsOneWidget);
    expect(
      find.text('Arranged directly with the owner'),
      findsOneWidget,
    );
    await tester.tap(find.byKey(const Key('request-pack-pack-200')));
    await tester.pumpAndSettle();

    expect(repository.purchaseCalls, 1);
    expect(find.textContaining('Request reference:'), findsOneWidget);
    expect(controller.wallet.value?.availablePoints, 100);
  });

  testWidgets('new balance UI supports Arabic RTL and accessibility',
      (tester) async {
    final controller = DriverPointsController(
      repository: FakePointsRepository(),
      realtime: FakePointsRealtime(),
    );
    Get.put(controller);
    await tester.pumpWidget(
      _app(const MyPointsView(), locale: const Locale('ar')),
    );
    await tester.pumpAndSettle();

    expect(find.text('رصيدي'), findsOneWidget);
    expect(find.text('الرصيد المتاح'), findsOneWidget);
    final directionality =
        tester.widget<Directionality>(find.byType(Directionality).first);
    expect(directionality.textDirection, TextDirection.rtl);
    final buttonSize =
        tester.getSize(find.byKey(const Key('buy-points-button')));
    expect(buttonSize.height, greaterThanOrEqualTo(48));
  });
}
