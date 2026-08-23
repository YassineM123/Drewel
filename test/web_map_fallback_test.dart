import 'package:drewel/app/data/config/app_config.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('web map defaults to OpenStreetMap without a Google key', () {
    expect(
      shouldPreferOpenStreetMap(
        isWeb: true,
        googleWebMapEnabled: false,
        googleWebApiKey: '',
      ),
      isTrue,
    );
    expect(
      shouldPreferOpenStreetMap(
        isWeb: true,
        googleWebMapEnabled: true,
        googleWebApiKey: '',
      ),
      isTrue,
    );
  });

  test('Google web map is only preferred when explicitly enabled and keyed',
      () {
    expect(
      shouldPreferOpenStreetMap(
        isWeb: true,
        googleWebMapEnabled: true,
        googleWebApiKey: 'restricted-browser-key',
      ),
      isFalse,
    );
    expect(
      shouldPreferOpenStreetMap(
        isWeb: false,
        googleWebMapEnabled: false,
        googleWebApiKey: '',
      ),
      isFalse,
    );
  });

  test(
      'native desktop platforms use OpenStreetMap because GoogleMap is unsupported',
      () {
    expect(
      googleMapsFlutterSupportsPlatform(
        isWeb: false,
        platform: TargetPlatform.windows,
      ),
      isFalse,
    );
    expect(
      shouldUseOpenStreetMap(
        isWeb: false,
        platform: TargetPlatform.windows,
        googleWebMapEnabled: true,
        googleWebApiKey: 'restricted-browser-key',
      ),
      isTrue,
    );
  });

  test('Android keeps Google Maps available', () {
    expect(
      shouldUseOpenStreetMap(
        isWeb: false,
        platform: TargetPlatform.android,
        googleWebMapEnabled: false,
        googleWebApiKey: '',
      ),
      isFalse,
    );
  });

  test('iOS uses OpenStreetMap when the native Google key is unavailable', () {
    expect(
      shouldUseOpenStreetMap(
        isWeb: false,
        platform: TargetPlatform.iOS,
        googleWebMapEnabled: false,
        googleWebApiKey: '',
      ),
      isTrue,
    );
  });
}
