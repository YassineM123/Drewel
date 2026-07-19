import 'dart:math';

import '../apis/api_constants/api_url_constants.dart';
import '../apis/api_models/call_session_model.dart';
import '../apis/communication_api_client.dart';

class CallRepository {
  CallRepository(this._api);

  final CommunicationApiClient _api;

  CallSessionModel _read(Map<String, dynamic> response) {
    final dynamic raw = response['call'] ?? response['data'] ?? response;
    return CallSessionModel.fromJson(Map<String, dynamic>.from(raw as Map));
  }

  Future<CallSessionModel> initiate(String rideId) async => _read(
        await _api.post(
          ApiUrlConstants.calls('/initiate'),
          <String, dynamic>{'rideId': rideId},
          <String, String>{
            'Idempotency-Key':
                '${DateTime.now().microsecondsSinceEpoch.toRadixString(36)}-'
                    '${Random.secure().nextInt(1 << 32).toRadixString(36)}',
          },
        ),
      );

  Future<CallSessionModel> getCall(String callId) async =>
      _read(await _api.get(ApiUrlConstants.calls('/$callId')));

  Future<CallSessionModel> accept(String callId) =>
      _transition(callId, 'accept');
  Future<CallSessionModel> decline(String callId) =>
      _transition(callId, 'decline');
  Future<CallSessionModel> cancel(String callId) =>
      _transition(callId, 'cancel');
  Future<CallSessionModel> end(String callId) => _transition(callId, 'end');
  Future<CallSessionModel> connected(String callId) =>
      _transition(callId, 'connected');

  Future<CallSessionModel> _transition(String callId, String action) async =>
      _read(await _api.post(ApiUrlConstants.calls('/$callId/$action')));

  Future<AgoraCredentialsModel> getToken(String callId) async {
    final Map<String, dynamic> response =
        await _api.post(ApiUrlConstants.calls('/$callId/token'));
    final dynamic raw =
        response['credentials'] ?? response['agora'] ?? response;
    return AgoraCredentialsModel.fromJson(
      Map<String, dynamic>.from(raw as Map),
    );
  }
}
