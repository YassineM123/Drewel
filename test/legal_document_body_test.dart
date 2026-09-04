import 'package:drewel/app/data/apis/api_models/passenger_account_models.dart';
import 'package:drewel/common/legal_document_body.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('renders all user terms as numbered cards with a neutral header',
      (WidgetTester tester) async {
    await tester.binding.setSurfaceSize(const Size(900, 3000));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final LegalContentModel terms = LegalContentModel.fallback('terms');
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: LegalDocumentBody(legal: terms)),
      ),
    );

    expect(find.text('Drewel – User Terms & Conditions'), findsOneWidget);
    expect(
      find.text(
        'Please review this document carefully before using Drewel services.',
      ),
      findsOneWidget,
    );
    expect(
      find.text(
        'Please review these terms carefully before using Drewel driver services.',
      ),
      findsNothing,
    );
    expect(find.text('10 sections'), findsOneWidget);

    for (final String heading in <String>[
      'Use of the Application',
      'User Account',
      'Services & Pricing',
      'Payment',
      'User Responsibilities',
      'Cancellation',
      'Safety & Conduct',
      'Privacy',
      'Account Suspension',
      'Governing Law & Acceptance',
    ]) {
      expect(find.text(heading), findsOneWidget);
    }

    expect(
      find.text(
        'Users may cancel their request at any time without any cancellation fee.',
      ),
      findsOneWidget,
    );
    expect(
      find.text(
        'These Terms & Conditions are governed by the laws of the United Arab Emirates. By using Drewel or clicking "I Agree to the Terms & Conditions", the user confirms that they have read, understood, and accepted these Terms & Conditions.',
      ),
      findsOneWidget,
    );
  });
}
