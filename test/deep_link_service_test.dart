import 'package:drewel/common/deep_link_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('Drewel deep-link parsing', () {
    test('combines the custom-scheme host and path', () {
      expect(
        normalizedDrewelDeepLinkPath(
          Uri.parse('drewel://chat/ride?rideId=ride-1'),
        ),
        '/chat/ride',
      );
      expect(
        normalizedDrewelDeepLinkPath(Uri.parse('drewel://chat?conversationId=c1')),
        '/chat',
      );
      expect(
        normalizedDrewelDeepLinkPath(Uri.parse('drewel://driver/ride-request')),
        '/driver/ride-request',
      );
      expect(
        normalizedDrewelDeepLinkPath(Uri.parse('drewel://passenger/active-ride')),
        '/passenger/active-ride',
      );
      expect(
        normalizedDrewelDeepLinkPath(Uri.parse('drewel://driver/points')),
        '/driver/points',
      );
      expect(
        normalizedDrewelDeepLinkPath(Uri.parse('drewel://documents')),
        '/documents',
      );
      expect(
        normalizedDrewelDeepLinkPath(Uri.parse('drewel://driver/status')),
        '/driver/status',
      );
      expect(
        normalizedDrewelDeepLinkPath(Uri.parse('drewel://notifications')),
        '/notifications',
      );
    });

    test('keeps triple-slash links compatible', () {
      expect(
        normalizedDrewelDeepLinkPath(Uri.parse('drewel:///chat/ride')),
        '/chat/ride',
      );
      expect(
        normalizedDrewelDeepLinkPath(Uri.parse('drewel:///driver/points')),
        '/driver/points',
      );
    });
  });
}
