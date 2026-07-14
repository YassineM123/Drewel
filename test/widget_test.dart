import 'package:drewel/common/progress_bar.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('ProgressBar shows its child without a loading overlay',
      (WidgetTester tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: ProgressBar(
          inAsyncCall: false,
          child: Text('Ready'),
        ),
      ),
    );

    expect(find.text('Ready'), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsNothing);
    expect(find.byType(BackdropFilter), findsNothing);
  });

  testWidgets('ProgressBar shows a loading overlay while work is in progress',
      (WidgetTester tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: ProgressBar(
          inAsyncCall: true,
          child: Text('Loading content'),
        ),
      ),
    );

    expect(find.text('Loading content'), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    expect(find.byType(BackdropFilter), findsOneWidget);
  });
}
