import 'package:drewel/app/data/apis/api_models/get_simple_response_model.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('online response parses the server presence lease contract', () {
    final SimpleResponseModel response = SimpleResponseModel.fromJson(
      <String, dynamic>{
        'success': true,
        'presence': <String, dynamic>{
          'status': 'Online',
          'sessionId': 'opaque-session',
          'leaseExpiresAt': '2026-08-10T12:02:00.000Z',
          'lastHeartbeatAt': '2026-08-10T12:00:00.000Z',
          'version': 7,
          'heartbeatIntervalMs': 20000,
          'timeoutMs': 120000,
        },
      },
    );

    expect(response.presence?.sessionId, 'opaque-session');
    expect(response.presence?.version, 7);
    expect(response.presence?.heartbeatIntervalMs, 20000);
    expect(response.presence?.timeoutMs, 120000);
    expect(response.presence?.leaseExpiresAt?.isUtc, isTrue);
  });
}
