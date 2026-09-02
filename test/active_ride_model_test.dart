import 'package:drewel/app/data/apis/api_models/active_ride_model.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('active ride lifecycle model', () {
    test('normalizes legacy statuses without changing the server wire state',
        () {
      expect(RideStatus.fromValue('accepted'), RideStatus.confirmed);
      expect(
        RideStatus.fromValue('driver_arriving'),
        RideStatus.driverOnTheWay,
      );
      expect(RideStatus.pickupConfirmed.wireValue, 'pickup_confirmed');
      expect(RideStatus.inProgress.canNormallyCancel, isFalse);
      expect(RideStatus.cancelledByDriver.isTerminal, isTrue);
    });

    test('allows sending trip offers only before the ride is accepted', () {
      expect(RideStatus.contacting.acceptsTripOfferFromRequest, isTrue);
      expect(RideStatus.offerPending.acceptsTripOfferFromRequest, isFalse);
      expect(RideStatus.confirmed.acceptsTripOfferFromRequest, isFalse);
      expect(RideStatus.fromValue('accepted').acceptsTripOfferFromRequest,
          isFalse);
    });

    test('parses recovery, route, participant and private pickup PIN data', () {
      final ActiveRideModel ride = ActiveRideModel.fromJson(
        <String, dynamic>{
          'id': 'ride-1',
          'reference': 'DRW-101',
          'status': 'driver_arrived',
          'stateVersion': 7,
          'contactAllowed': true,
          'pickupPin': '4217',
          'reviews': <String, dynamic>{
            'passenger': <String, dynamic>{
              'rating': 4,
              'comment': 'Good trip',
              'submittedAt': '2026-08-14T10:00:00.000Z',
            },
          },
          'pickup': <String, dynamic>{
            'lat': 36.8,
            'long': 10.18,
            'address': 'Pickup',
          },
          'destination': <String, dynamic>{
            'lat': 36.9,
            'long': 10.2,
            'address': 'Destination',
          },
          'route': <String, dynamic>{
            'phase': 'pickup',
            'encodedPolyline': '_p~iF~ps|U_ulLnnqC',
            'distanceMeters': 2400,
            'duration': '600s',
            'steps': <Map<String, dynamic>>[
              <String, dynamic>{
                'navigationInstruction': <String, dynamic>{
                  'instructions': 'Turn right',
                  'maneuver': 'TURN_RIGHT',
                },
                'distanceMeters': 120,
              },
            ],
          },
        },
      );

      expect(ride.rideStatus, RideStatus.driverArrived);
      expect(ride.isRecoverable, isTrue);
      expect(ride.pickup?.isValid, isTrue);
      expect(ride.pickupPin, '4217');
      expect(ride.route?.durationSeconds, 600);
      expect(ride.route?.steps.single.instruction, 'Turn right');
      expect(ride.stateVersion, 7);
      expect(ride.passengerReview?.rating, 4);
      expect(ride.passengerReview?.comment, 'Good trip');
    });

    test(
        'lets the driver keep messaging a completed ride while the '
        'passenger loses access once the grace period ends', () {
      final ActiveRideModel ride = ActiveRideModel.fromJson(
        <String, dynamic>{
          'id': 'ride-2',
          'status': 'completed',
          'contactAllowed': true,
          'contactExpiresAt': '2000-01-01T00:00:00.000Z',
        },
      );

      expect(ride.canCommunicateAs('driver'), isTrue);
      expect(ride.canCommunicateAs('user'), isFalse);
      expect(ride.canCommunicate, isFalse);
    });

    test('rejects malformed coordinates locally', () {
      final RideCoordinateModel location = RideCoordinateModel.fromJson(
        <String, dynamic>{'lat': 120, 'long': 10},
      );
      expect(location.isValid, isFalse);
    });
  });
}
