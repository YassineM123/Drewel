import 'package:drewel/app/data/apis/api_models/get_simple_response_model.dart';
import 'package:drewel/app/modules/driver_home/controllers/driver_home_controller.dart';
import 'package:drewel/app/modules/driver_home/widgets/driver_home_bottom_bar.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('online control stays responsive without unavailable panels',
      (WidgetTester tester) async {
    await tester.binding.setSurfaceSize(const Size(360, 640));
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: const SizedBox.expand(),
          bottomNavigationBar: DriverHomeBottomBar(
            isOnline: false,
            isLoading: false,
            onToggleOnline: () {},
            activeRide: const SizedBox.shrink(),
            rideRequests: const SizedBox.shrink(),
            communication: const SizedBox.shrink(),
          ),
        ),
      ),
    );

    expect(find.text('Go Online'), findsOneWidget);
    expect(find.textContaining('Message and Call'), findsNothing);
    expect(
      tester.getBottomRight(find.byKey(const Key('driver-online-button'))).dy,
      lessThanOrEqualTo(640),
    );
    expect(tester.takeException(), isNull);
  });

  test('turns backend online failures into actionable messages', () {
    expect(
      driverOnlineFailureMessage(SimpleResponseModel(
        success: false,
        code: 'OUTSIDE_SERVICE_AREA',
      )),
      contains('outside the available service area'),
    );
    expect(
      driverOnlineFailureMessage(SimpleResponseModel(
        success: false,
        code: 'LOCATION_INACCURATE',
      )),
      contains('precise location'),
    );
    expect(
      driverOnlineFailureMessage(SimpleResponseModel(
        success: false,
        message: 'Request 2 approval is required.',
      )),
      'Request 2 approval is required.',
    );
  });
}
