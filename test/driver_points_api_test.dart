import 'dart:convert';

import 'package:drewel/app/data/apis/api_models/driver_points_models.dart';
import 'package:drewel/app/data/apis/communication_api_client.dart';
import 'package:drewel/app/data/repositories/driver_points_repository.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues(<String, Object>{
      'token': 'driver-jwt',
    });
  });

  test('trip offer sends JWT and matching idempotency identifiers', () async {
    late http.Request captured;
    final client = MockClient((request) async {
      captured = request;
      return http.Response(
        jsonEncode(<String, dynamic>{
          'success': true,
          'offer': <String, dynamic>{
            'id': 'offer-1',
            'contactRideId': 'ride-contact-1',
            'status': 'pending',
            'reservationState': 'reserved',
            'pointsCost': 20,
            'stateVersion': 0,
          },
        }),
        201,
      );
    });
    final repository =
        ApiDriverPointsRepository(CommunicationApiClient(client: client));

    await repository.sendOffer(
      draft: const TripOfferDraft(
        contactRideId: 'ride-contact-1',
        offeredPrice: 45,
        currency: 'AED',
        pickup: <String, dynamic>{
          'address': 'Pickup',
          'lat': 25.1,
          'long': 55.1,
        },
        destination: <String, dynamic>{
          'address': 'Destination',
          'lat': 25.2,
          'long': 55.2,
        },
      ),
      clientOfferId: 'offer-client-123',
      idempotencyKey: 'offer-client-123',
    );

    expect(captured.headers['authorization'], 'Bearer driver-jwt');
    expect(captured.headers['idempotency-key'], 'offer-client-123');
    final body = jsonDecode(captured.body) as Map<String, dynamic>;
    expect(body['clientOfferId'], 'offer-client-123');
    expect(body.containsKey('pointsCost'), isFalse);
    expect(body.containsKey('balance'), isFalse);
  });

  test('backend insufficient-points code is preserved for UI branching',
      () async {
    final api = CommunicationApiClient(
      client: MockClient((_) async => http.Response(
            jsonEncode(<String, dynamic>{
              'success': false,
              'code': 'INSUFFICIENT_AVAILABLE_POINTS',
              'message':
                  'You do not have enough available points to send this offer',
            }),
            409,
          )),
    );

    await expectLater(
      api.post('https://example.test/api/trip-offers'),
      throwsA(
        isA<CommunicationApiException>()
            .having(
                (error) => error.code, 'code', 'INSUFFICIENT_AVAILABLE_POINTS')
            .having((error) => error.statusCode, 'statusCode', 409),
      ),
    );
  });

  test('text 404 is reported as an API error instead of a FormatException',
      () async {
    final api = CommunicationApiClient(
      client: MockClient((_) async => http.Response(
            '<html><body>Cannot GET /api/driver/points/wallet</body></html>',
            404,
            headers: <String, String>{'content-type': 'text/html'},
          )),
    );

    await expectLater(
      api.get('https://example.test/api/driver/points/wallet'),
      throwsA(
        isA<CommunicationApiException>()
            .having((error) => error.statusCode, 'statusCode', 404)
            .having(
              (error) => error.message,
              'message',
              contains('Cannot GET /api/driver/points/wallet'),
            ),
      ),
    );
  });

  test('purchase request sends only pack and client reference', () async {
    late Map<String, dynamic> capturedBody;
    final repository = ApiDriverPointsRepository(CommunicationApiClient(
      client: MockClient((request) async {
        capturedBody = jsonDecode(request.body) as Map<String, dynamic>;
        return http.Response(
          jsonEncode(<String, dynamic>{
            'success': true,
            'request': <String, dynamic>{
              '_id': 'request-1',
              'clientRequestId': 'purchase-client-123',
              'status': 'pending',
              'packSnapshot': <String, dynamic>{'points': 200},
            },
          }),
          201,
        );
      }),
    ));

    final request = await repository.createPurchaseRequest(
      packId: '507f1f77bcf86cd799439011',
      clientRequestId: 'purchase-client-123',
    );

    expect(request.reference, 'purchase-client-123');
    expect(
        capturedBody.keys,
        containsAll(<String>[
          'requestedPackId',
          'clientRequestId',
        ]));
    expect(capturedBody.containsKey('paymentReference'), isFalse);
    expect(capturedBody.containsKey('pointsToCredit'), isFalse);
  });

  test('purchase request sends only custom points and client reference',
      () async {
    late Map<String, dynamic> capturedBody;
    final repository = ApiDriverPointsRepository(CommunicationApiClient(
      client: MockClient((request) async {
        capturedBody = jsonDecode(request.body) as Map<String, dynamic>;
        return http.Response(
          jsonEncode(<String, dynamic>{
            'success': true,
            'request': <String, dynamic>{
              '_id': 'request-2',
              'clientRequestId': 'purchase-client-456',
              'status': 'pending',
              'requestedPoints': 350,
            },
          }),
          201,
        );
      }),
    ));

    final request = await repository.createPurchaseRequest(
      points: 350,
      clientRequestId: 'purchase-client-456',
    );

    expect(request.reference, 'purchase-client-456');
    expect(request.points, 350);
    expect(capturedBody['requestedPoints'], 350);
    expect(capturedBody.containsKey('requestedPackId'), isFalse);
  });
}
