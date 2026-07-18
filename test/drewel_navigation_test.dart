import 'package:drewel/common/drewel_navigation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get/get.dart';

void main() {
  setUp(() {
    Get.testMode = true;
  });

  tearDown(Get.reset);

  testWidgets('resetTo replaces login history with user register',
      (WidgetTester tester) async {
    await tester.pumpWidget(
      GetMaterialApp(
        initialRoute: '/user-type',
        getPages: <GetPage<dynamic>>[
          GetPage<dynamic>(
            name: '/user-type',
            page: () => Scaffold(
              body: TextButton(
                onPressed: () => Get.toNamed<void>('/login'),
                child: const Text('Open login'),
              ),
            ),
          ),
          GetPage<dynamic>(
            name: '/login',
            page: () => Scaffold(
              body: TextButton(
                onPressed: () => DrewelNavigation.resetTo('/user-register'),
                child: const Text('Return to user register'),
              ),
            ),
          ),
          GetPage<dynamic>(
            name: '/user-register',
            page: () => const Scaffold(body: Text('Find Now')),
          ),
        ],
      ),
    );

    await tester.tap(find.text('Open login'));
    await tester.pumpAndSettle();
    expect(Get.currentRoute, '/login');

    await tester.tap(find.text('Return to user register'));
    await tester.pumpAndSettle();

    expect(Get.currentRoute, '/user-register');
    expect(find.text('Find Now'), findsOneWidget);
    expect(Get.key.currentState!.canPop(), isFalse);
    expect(tester.takeException(), isNull);
  });
}
