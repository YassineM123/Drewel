import 'package:drewel/app/modules/user_register/controllers/user_register_controller.dart';
import 'package:drewel/app/modules/user_register/views/user_register_view.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get/get.dart';
import 'package:responsive_sizer/responsive_sizer.dart';

void main() {
  tearDown(Get.reset);

  testWidgets('registration content stays reachable on short phones',
      (WidgetTester tester) async {
    await tester.binding.setSurfaceSize(const Size(320, 568));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    Get.put<UserRegisterController>(_TestUserRegisterController());

    await tester.pumpWidget(
      ResponsiveSizer(
        builder: (context, orientation, screenType) => const GetMaterialApp(
          home: UserRegisterView(),
        ),
      ),
    );
    await tester.pump();

    expect(tester.takeException(), isNull);
    expect(find.text('Confirm your information'), findsOneWidget);

    await tester.scrollUntilVisible(
      find.text('Find Now'),
      120,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.pump(const Duration(milliseconds: 300));

    expect(tester.takeException(), isNull);
    expect(find.text('Find Now'), findsOneWidget);
    expect(tester.getBottomRight(find.text('Find Now')).dy, lessThan(568));
  });

  testWidgets('registration page does not overflow with large text',
      (WidgetTester tester) async {
    await tester.binding.setSurfaceSize(const Size(360, 640));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    Get.put<UserRegisterController>(_TestUserRegisterController());

    await tester.pumpWidget(
      ResponsiveSizer(
        builder: (context, orientation, screenType) => GetMaterialApp(
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(context).copyWith(
              textScaler: const TextScaler.linear(2),
            ),
            child: child!,
          ),
          home: const UserRegisterView(),
        ),
      ),
    );
    await tester.pump();

    expect(tester.takeException(), isNull);
    await tester.scrollUntilVisible(
      find.text('Find Now'),
      120,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.pump(const Duration(milliseconds: 300));
    expect(tester.takeException(), isNull);
  });
}

class _TestUserRegisterController extends UserRegisterController {
  @override
  Future<void> callingGetBannerListApi() async {
    // Keep widget tests deterministic and independent of the banner API.
  }
}
