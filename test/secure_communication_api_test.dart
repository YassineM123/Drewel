import 'dart:convert';

import 'package:drewel/app/data/apis/communication_api_client.dart';
import 'package:drewel/app/data/repositories/active_ride_repository.dart';
import 'package:drewel/app/data/repositories/call_repository.dart';
import 'package:drewel/app/data/repositories/ride_message_repository.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues(<String, Object>{
      'token': 'jwt-token',
    });
  });

  test('call initiation sends JWT and an idempotency key', () async {
    late http.Request captured;
    final CallRepository repository = CallRepository(
      CommunicationApiClient(
        client: MockClient((http.Request request) async {
          captured = request;
          return http.Response(
            jsonEncode(<String, dynamic>{
              'call': <String, dynamic>{
                'id': 'call-1',
                'rideId': 'ride-1',
                'status': 'ringing',
              },
            }),
            201,
            headers: <String, String>{'content-type': 'application/json'},
          );
        }),
      ),
    );

    await repository.initiate('ride-1');

    expect(captured.headers['authorization'], 'Bearer jwt-token');
    expect(captured.headers['idempotency-key'], isNotEmpty);
    expect(jsonDecode(captured.body), <String, dynamic>{'rideId': 'ride-1'});
  });

  test('ride messages include a unique client message id', () async {
    late Map<String, dynamic> body;
    final RideMessageRepository repository = RideMessageRepository(
      CommunicationApiClient(
        client: MockClient((http.Request request) async {
          body = Map<String, dynamic>.from(jsonDecode(request.body) as Map);
          return http.Response(
            jsonEncode(<String, dynamic>{
              'message': <String, dynamic>{
                '_id': 'message-1',
                'rideId': 'ride-1',
                'senderId': 'user-1',
                'text': body['text'],
                'status': 'sent',
              },
            }),
            201,
            headers: <String, String>{'content-type': 'application/json'},
          );
        }),
      ),
    );

    await repository.send('ride-1', 'I have arrived');

    expect(body['text'], 'I have arrived');
    expect(body['clientMessageId'], isA<String>());
    expect((body['clientMessageId'] as String).length, greaterThan(8));
  });

  test('driver ride transition uses the backend PATCH contract', () async {
    late http.Request captured;
    final ActiveRideRepository repository = ActiveRideRepository(
      CommunicationApiClient(
        client: MockClient((http.Request request) async {
          captured = request;
          return http.Response(
            jsonEncode(<String, dynamic>{
              'ride': <String, dynamic>{
                'id': 'ride-1',
                'status': 'accepted',
                'contactAllowed': true,
              },
            }),
            200,
            headers: <String, String>{'content-type': 'application/json'},
          );
        }),
      ),
    );

    await repository.transitionRide('ride-1', 'accepted');

    expect(captured.method, 'PATCH');
    expect(captured.url.path, endsWith('/api/rides/ride-1/status'));
    expect(jsonDecode(captured.body), <String, dynamic>{'status': 'accepted'});
  });
}
