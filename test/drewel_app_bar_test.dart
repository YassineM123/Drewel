import 'package:drewel/common/drewel_app_bar.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('shows the standard accessible back control',
      (WidgetTester tester) async {
    bool wasPressed = false;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          appBar: DrewelAppBar(
            title: 'Details',
            showBackButton: true,
            onBack: () => wasPressed = true,
          ),
        ),
      ),
    );

    expect(find.byIcon(Icons.arrow_back_ios_new_rounded), findsOneWidget);
    expect(find.byTooltip('Back'), findsOneWidget);
    expect(find.byIcon(Icons.menu_rounded), findsNothing);
    final Size targetSize = tester.getSize(find.byTooltip('Back'));
    expect(targetSize.width, greaterThanOrEqualTo(48));
    expect(targetSize.height, greaterThanOrEqualTo(48));

    await tester.tap(find.byTooltip('Back'));
    expect(wasPressed, isTrue);
  });

  testWidgets('places back on the left and menu on the right when combined',
      (WidgetTester tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          appBar: DrewelAppBar(
            title: 'Workflow',
            showBackButton: true,
            showMenuButton: true,
            onBack: _noop,
          ),
        ),
      ),
    );

    expect(find.byTooltip('Back'), findsOneWidget);
    expect(find.byTooltip('Menu'), findsOneWidget);
  });

  testWidgets('menu opens the existing end drawer',
      (WidgetTester tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          appBar: DrewelAppBar(
            title: 'Home',
            showMenuButton: true,
          ),
          endDrawer: Drawer(child: Text('Main menu')),
        ),
      ),
    );

    expect(find.byIcon(Icons.menu_rounded), findsOneWidget);
    expect(find.byTooltip('Menu'), findsOneWidget);
    expect(
      tester.getCenter(find.byTooltip('Menu')).dx,
      greaterThan(tester.getSize(find.byType(Scaffold)).width / 2),
    );
    await tester.tap(find.byTooltip('Menu'));
    await tester.pumpAndSettle();
    expect(find.text('Main menu'), findsOneWidget);
  });

  testWidgets('keeps back, logo and menu on the same vertical level',
      (WidgetTester tester) async {
    const Key logoKey = Key('app-bar-logo');
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          appBar: DrewelAppBar(
            title: '',
            titleWidget: SizedBox(key: logoKey, width: 120, height: 40),
            showBackButton: true,
            showMenuButton: true,
            onBack: _noop,
          ),
        ),
      ),
    );

    final double backY =
        tester.getCenter(find.byIcon(Icons.arrow_back_ios_new_rounded)).dy;
    final double logoY = tester.getCenter(find.byKey(logoKey)).dy;
    final double menuY = tester.getCenter(find.byIcon(Icons.menu_rounded)).dy;
    expect(backY, closeTo(logoY, 0.1));
    expect(menuY, closeTo(logoY, 0.1));
  });

  testWidgets('supports branded back and menu assets without losing tooltips',
      (WidgetTester tester) async {
    const Key brandedBackKey = Key('branded-back');
    const Key brandedMenuKey = Key('branded-menu');

    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          appBar: DrewelAppBar(
            title: '',
            showBackButton: true,
            showMenuButton: true,
            backIcon: SizedBox(key: brandedBackKey, width: 40, height: 40),
            menuIcon: SizedBox(key: brandedMenuKey, width: 32, height: 32),
            onBack: _noop,
          ),
        ),
      ),
    );

    expect(find.byKey(brandedBackKey), findsOneWidget);
    expect(find.byKey(brandedMenuKey), findsOneWidget);
    expect(find.byTooltip('Back'), findsOneWidget);
    expect(find.byTooltip('Menu'), findsOneWidget);
  });

  testWidgets('keeps the branded header usable on a narrow phone',
      (WidgetTester tester) async {
    await tester.binding.setSurfaceSize(const Size(320, 640));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          appBar: DrewelAppBar(
            title: '',
            titleWidget: SizedBox(width: 150, height: 52),
            showBackButton: true,
            showMenuButton: true,
            backIcon: SizedBox(width: 40, height: 40),
            menuIcon: SizedBox(width: 32, height: 32),
            onBack: _noop,
          ),
        ),
      ),
    );

    expect(tester.takeException(), isNull);
    expect(find.byTooltip('Back'), findsOneWidget);
    expect(find.byTooltip('Menu'), findsOneWidget);
    expect(
        tester.getSize(find.byTooltip('Back')).width, greaterThanOrEqualTo(48));
    expect(
        tester.getSize(find.byTooltip('Menu')).width, greaterThanOrEqualTo(48));
  });
}

void _noop() {}
