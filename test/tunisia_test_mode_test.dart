import 'package:drewel/app/data/config/app_config.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('marketplace service area gate', () {
    test('production mode remains UAE-only', () {
      expect(isMarketplaceServiceAreaAllowed('uae', tunisiaTestMode: false),
          isTrue);
      expect(isMarketplaceServiceAreaAllowed('Dubai', tunisiaTestMode: false),
          isTrue);
      expect(
        isMarketplaceServiceAreaAllowed('tunisia-test', tunisiaTestMode: false),
        isFalse,
      );
    });

    test('Tunisia QA mode accepts only the explicit test service area', () {
      expect(
        isMarketplaceServiceAreaAllowed('Tunisia-Test', tunisiaTestMode: true),
        isTrue,
      );
      expect(isMarketplaceServiceAreaAllowed('tunisia', tunisiaTestMode: true),
          isFalse);
    });
  });
}
