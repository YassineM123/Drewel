import 'package:drewel/app/modules/active_ride/controllers/active_ride_controller.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('decodes a backend Routes API encoded polyline', () {
    final points = ActiveRideController.decodePolyline(
      '_p~iF~ps|U_ulLnnqC_mqNvxq`@',
    );

    expect(points, hasLength(3));
    expect(points.first.latitude, closeTo(38.5, 0.00001));
    expect(points.first.longitude, closeTo(-120.2, 0.00001));
    expect(points.last.latitude, closeTo(43.252, 0.00001));
    expect(points.last.longitude, closeTo(-126.453, 0.00001));
  });

  test('malformed polyline fails closed', () {
    expect(ActiveRideController.decodePolyline('_'), isEmpty);
  });
}
