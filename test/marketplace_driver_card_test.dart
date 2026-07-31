import 'package:drewel/app/data/apis/api_models/get_all_driver_model.dart';
import 'package:drewel/app/modules/user_home/widgets/marketplace_driver_card.dart';
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
}
