import 'package:drewel/app/data/config/app_config.dart';
import 'package:drewel/common/local_data.dart';
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
      expect(
        isMarketplaceServiceAreaAllowed('uae', tunisiaTestMode: true),
        isFalse,
      );
      expect(
        isMarketplaceServiceAreaAllowed('Dubai', tunisiaTestMode: true),
        isFalse,
      );
    });
  });

  group('marketplace city origin', () {
    final List<Map<String, dynamic>> cities = <Map<String, dynamic>>[
      <String, dynamic>{'city': 'Abu Dhabi'},
      <String, dynamic>{'city': 'Dubai'},
      <String, dynamic>{'city': 'Tunis'},
    ];

    test('production keeps the first UAE city as its default', () {
      expect(defaultMarketplaceCityIndex(cities, tunisiaTestMode: false), 0);
      expect(
        shouldSeedCityCenterAsDiscoveryOrigin(tunisiaTestMode: false),
        isTrue,
      );
    });

    test('Tunisia QA defaults to Tunis but requires GPS as discovery origin',
        () {
      expect(defaultMarketplaceCityIndex(cities, tunisiaTestMode: true), 2);
      expect(
        shouldSeedCityCenterAsDiscoveryOrigin(tunisiaTestMode: true),
        isFalse,
      );
    });
  });
}
