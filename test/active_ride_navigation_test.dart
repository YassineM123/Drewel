import 'package:drewel/app/modules/active_ride/controllers/active_ride_controller.dart';
import 'package:drewel/app/data/apis/api_models/active_ride_model.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

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

  test('navigation camera looks ahead along the active route', () {
    const location = RideCoordinateModel(latitude: 36.4, longitude: 10.6);
    const route = <LatLng>[
      LatLng(36.4, 10.6),
      LatLng(36.405, 10.6),
      LatLng(36.410, 10.6),
    ];

    final target = ActiveRideController.navigationCameraTargetForTest(
      location,
      route,
    );
    final bearing = ActiveRideController.navigationBearingForTest(
      location,
      route,
    );

    expect(target.latitude, greaterThan(location.latitude));
    expect(target.longitude, closeTo(location.longitude, 0.0001));
    expect(bearing, closeTo(0, 1));
  });
}
