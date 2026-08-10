import 'package:drewel/app/modules/user_home/controllers/user_home_controller.dart';
import 'package:drewel/app/modules/user_home/widgets/location_search_bar.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  Widget wrap({
    required Widget child,
    double screenWidth = 360,
  }) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      home: Scaffold(
        backgroundColor: Colors.white,
        body: Align(
          alignment: Alignment.topCenter,
          child: ConstrainedBox(
            // Same wrapper used by the user home view: 16px margins on each
            // side and a sensible max-width on large screens.
            key: const Key('search-row'),
            constraints: const BoxConstraints(maxWidth: 720),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Expanded(child: child),
                const SizedBox(width: 10),
                const Padding(
                  padding: EdgeInsets.only(top: 4),
                  child: SizedBox(
                    width: 46,
                    height: 46,
                    child: Icon(Icons.my_location),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  testWidgets('mobile viewport: bar stays within margins without overflow',
      (WidgetTester tester) async {
    final UserHomeController controller = UserHomeController();
    await tester.binding.setSurfaceSize(const Size(360, 640));
    addTearDown(() => controller.locationController.dispose());

    await tester.pumpWidget(
      wrap(
        child: LocationSearchBar(
          key: const Key('location-search-bar'),
          controller: controller,
        ),
      ),
    );

    final Rect bar = tester.getRect(find.byKey(const Key('location-search-bar')));
    expect(bar.left, greaterThanOrEqualTo(0));
    expect(bar.right, lessThanOrEqualTo(360));
    expect(bar.height, closeTo(54, 1));
    expect(bar.top, lessThanOrEqualTo(20));
    expect(find.text('Where do you want to go?'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('desktop viewport: bar is capped and centred, no edge-to-edge',
      (WidgetTester tester) async {
    final UserHomeController controller = UserHomeController();
    await tester.binding.setSurfaceSize(const Size(1280, 720));
    addTearDown(() => controller.locationController.dispose());

    await tester.pumpWidget(
      wrap(
        child: LocationSearchBar(
          key: const Key('location-search-bar'),
          controller: controller,
        ),
      ),
    );

    final Rect row = tester.getRect(find.byKey(const Key('search-row')));
    final Rect bar = tester.getRect(find.byKey(const Key('location-search-bar')));
    expect(row.width, lessThanOrEqualTo(720));
    expect(row.left, greaterThan(0));
    expect(row.right, lessThan(1280));
    expect(bar.width, lessThan(720));
    expect(tester.takeException(), isNull);
  });

  testWidgets('typing shows a loading state and an inline clear button',
      (WidgetTester tester) async {
    final UserHomeController controller = UserHomeController();
    addTearDown(() => controller.locationController.dispose());

    await tester.pumpWidget(
      MaterialApp(
        home: Material(
          child: Center(
            child: SizedBox(
              width: 328,
              child: LocationSearchBar(controller: controller),
            ),
          ),
        ),
      ),
    );

    expect(find.byIcon(Icons.close_rounded), findsNothing);

    await tester.enterText(find.byType(TextField), 'Dubai');
    await tester.pump();
    // Debounce kick-off immediately sets the loading state.
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    expect(find.byIcon(Icons.close_rounded), findsOneWidget);
    expect(tester.takeException(), isNull);

    // Tear down the debounce timer so the test finishes without pending timers.
    controller.clearLocationSearch();
    await tester.pump();
    expect(find.byType(CircularProgressIndicator), findsNothing);
    expect(find.byIcon(Icons.close_rounded), findsNothing);
  });
}