import 'package:drewel/app/data/apis/api_models/get_all_driver_model.dart';
import 'package:drewel/app/modules/user_home/widgets/marketplace_driver_card.dart';
import 'package:drewel/common/gps_fix.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  Drivers driver({String status = 'Online', bool available = true}) =>
      Drivers.fromJson(<String, dynamic>{
        '_id': 'driver-1',
        'firstName': 'Amina',
        'profileImageUrl': '',
        'city': 'Tunis',
        'isOnline': status != 'Offline',
        'isAvailable': available,
        'availabilityStatus': status,
        'vehicleType': 'Sedan',
        'vehicleModel': 'Toyota Corolla',
        'rating': 4.8,
        'distanceKm': 2.4,
        'priceEstimate': 18,
        'currency': 'TND',
        'registrationNumber': '123 TUN 456',
        'registrationVisible': true,
      });

  Widget app(Drivers value, {VoidCallback? onChat, VoidCallback? onCall}) =>
      MaterialApp(
        home: Scaffold(
          body: MarketplaceDriverCard(
            driver: value,
            onTap: () {},
            onChat: onChat,
            onCall: onCall,
          ),
        ),
      );

  testWidgets('shows marketplace details and icon-only contact actions',
      (WidgetTester tester) async {
    await tester.pumpWidget(
      app(driver(), onChat: () {}, onCall: () {}),
    );

    expect(find.text('Amina'), findsOneWidget);
    expect(find.text('Sedan · Toyota Corolla'), findsOneWidget);
    expect(find.text('123 TUN 456'), findsOneWidget);
    expect(find.byIcon(Icons.message_rounded), findsOneWidget);
    expect(find.byIcon(Icons.call_rounded), findsOneWidget);
    expect(find.text('Chat'), findsNothing);
    expect(find.text('Call'), findsNothing);
    expect(find.text('Safety'), findsNothing);
    expect(find.byType(Tooltip), findsNWidgets(2));

    final Iterable<Size> actionSizes = tester
        .widgetList<SizedBox>(find.byType(SizedBox))
        .where((SizedBox box) => box.width == 44 && box.height == 44)
        .map((SizedBox box) => Size(box.width!, box.height!));
    expect(actionSizes.length, 2);
  });

  testWidgets('busy disables call while preserving configurable chat',
      (WidgetTester tester) async {
    int chats = 0;
    int calls = 0;
    await tester.pumpWidget(
      app(
        driver(status: 'Busy', available: true),
        onChat: () => chats++,
        onCall: () => calls++,
      ),
    );

    await tester.tap(find.byIcon(Icons.message_rounded));
    await tester.tap(find.byIcon(Icons.call_rounded));
    expect(chats, 1);
    expect(calls, 0);
    expect(find.text('Busy'), findsOneWidget);
  });

  test('normalizes online, busy and offline discovery states', () {
    expect(driver().isOnlineAndAvailable, isTrue);
    expect(
      driver(status: 'Busy', available: false).isOnlineAndAvailable,
      isFalse,
    );
    expect(
      driver(status: 'Offline', available: false).isOnlineAndAvailable,
      isFalse,
    );
  });

  test('parses current service area and validates GPS freshness', () {
    final DateTime now = DateTime.utc(2026, 8, 3, 12);
    final Drivers value = Drivers.fromJson(<String, dynamic>{
      '_id': 'driver-dubai',
      'availabilityStatus': 'Online',
      'isAvailable': true,
      'lat': 25.2048,
      'long': 55.2708,
      'currentServiceArea': 'Dubai',
      'locationUpdatedAt':
          now.subtract(const Duration(seconds: 30)).toIso8601String(),
    });

    expect(value.currentServiceArea, 'Dubai');
    expect(
      value.hasFreshLocation(
        now: now,
        maxAge: const Duration(seconds: 45),
      ),
      isTrue,
    );
    expect(
      value.hasFreshLocation(
        now: now.add(const Duration(seconds: 46)),
        maxAge: const Duration(seconds: 45),
      ),
      isFalse,
    );
  });

  test('allows bounded GPS clock skew and rejects larger future timestamps',
      () {
    final DateTime now = DateTime.utc(2026, 8, 3, 12);
    final Drivers missing = Drivers.fromJson(<String, dynamic>{
      'availabilityStatus': 'Online',
      'isAvailable': true,
    });
    final Drivers boundedFuture = Drivers.fromJson(<String, dynamic>{
      'availabilityStatus': 'Online',
      'isAvailable': true,
      'locationUpdatedAt':
          now.add(const Duration(seconds: 30)).toIso8601String(),
    });
    final Drivers invalidFuture = Drivers.fromJson(<String, dynamic>{
      'availabilityStatus': 'Online',
      'isAvailable': true,
      'locationUpdatedAt':
          now.add(const Duration(seconds: 31)).toIso8601String(),
    });

    expect(missing.hasFreshLocation(now: now), isFalse);
    expect(boundedFuture.hasFreshLocation(now: now), isTrue);
    expect(invalidFuture.hasFreshLocation(now: now), isFalse);
  });

  test('GPS payload preserves the fix timestamp and accuracy', () {
    final DateTime recordedAt = DateTime.utc(2026, 8, 3, 12, 30, 15);

    final Map<String, dynamic> payload = buildGpsFixPayload(
      latitude: 25.2048,
      longitude: 55.2708,
      recordedAt: recordedAt,
      accuracyM: 6.5,
    );

    expect(payload['lat'], 25.2048);
    expect(payload['long'], 55.2708);
    expect(payload['recordedAt'], recordedAt.toIso8601String());
    expect(payload['accuracyM'], 6.5);
  });
}
