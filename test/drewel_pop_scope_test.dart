import 'package:drewel/common/drewel_pop_scope.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('delegates root back once to the page lifecycle handler',
      (WidgetTester tester) async {
    int backCalls = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: DrewelPopScope(
          onBack: () async => backCalls++,
          child: const Scaffold(body: Text('Root page')),
        ),
      ),
    );

    await tester.binding.handlePopRoute();
    await tester.binding.handlePopRoute();
    await tester.pump();

    expect(backCalls, 1);
    expect(tester.takeException(), isNull);
  });

  testWidgets('protects unsaved changes from the system back action',
      (WidgetTester tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (BuildContext context) => Scaffold(
            body: TextButton(
              onPressed: () => Navigator.of(context).push<void>(
                MaterialPageRoute<void>(
                  builder: (_) => const DrewelPopScope(
                    hasUnsavedChanges: true,
                    child: Scaffold(body: Text('Edited form')),
                  ),
                ),
              ),
              child: const Text('Open form'),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Open form'));
    await tester.pumpAndSettle();
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();

    expect(find.text('Discard changes?'), findsOneWidget);
    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
    expect(find.text('Edited form'), findsOneWidget);

    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    await tester.tap(find.text('Discard'));
    await tester.pumpAndSettle();
    expect(find.text('Open form'), findsOneWidget);
  });
}
