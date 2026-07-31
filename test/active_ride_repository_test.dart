import 'dart:convert';

import 'package:drewel/app/data/apis/api_models/active_ride_model.dart';
import 'package:drewel/app/data/apis/communication_api_client.dart';
import 'package:drewel/app/data/repositories/active_ride_repository.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues(<String, Object>{
      'token': 'test-token',
    });
  });

  test('transition sends location and idempotency key', () async {
    late http.Request captured;
    final ActiveRideRepository repository = ActiveRideRepository(
      CommunicationApiClient(
        client: MockClient((http.Request request) async {
          captured = request;
          return http.Response(
            jsonEncode(<String, dynamic>{
              'ride': <String, dynamic>{
                'id': 'ride-1',
                'status': 'driver_on_the_way',
                'contactAllowed': true,
              },
            }),
            200,
            headers: <String, String>{'content-type': 'application/json'},
          );
        }),
      ),
    );

    await repository.transitionRide(
      'ride-1',
      'driver_on_the_way',
      idempotencyKey: 'ride-1:start:key',
      location: const RideCoordinateModel(
        latitude: 36.8,
        longitude: 10.18,
      ),
    );

    expect(captured.headers['idempotency-key'], 'ride-1:start:key');
    final Map<String, dynamic> body =
        Map<String, dynamic>.from(jsonDecode(captured.body) as Map);
    expect(body['status'], 'driver_on_the_way');
    expect((body['location'] as Map)['lat'], 36.8);
  });
}
