import 'dart:async';

import 'package:agora_rtc_engine/agora_rtc_engine.dart';
import 'package:permission_handler/permission_handler.dart';

import '../apis/api_models/call_session_model.dart';

enum AgoraConnectionState { idle, connecting, connected, reconnecting, failed }

class MicrophonePermissionDenied implements Exception {
  const MicrophonePermissionDenied();
}

class AgoraCallService {
  RtcEngine? _engine;
  String? _appId;
  Future<void> Function()? _tokenRenewalHandler;
  final StreamController<AgoraConnectionState> _connectionController =
      StreamController<AgoraConnectionState>.broadcast();

  Stream<AgoraConnectionState> get connectionStates =>
      _connectionController.stream;
  bool get isInitialized => _engine != null;

  void setTokenRenewalHandler(Future<void> Function() handler) {
    _tokenRenewalHandler = handler;
  }

  Future<void> ensureMicrophonePermission() async {
    final PermissionStatus permission = await Permission.microphone.request();
    if (!permission.isGranted) throw const MicrophonePermissionDenied();
  }

  Future<void> join(AgoraCredentialsModel credentials) async {
    await ensureMicrophonePermission();
    await leave();
    _connectionController.add(AgoraConnectionState.connecting);

    final RtcEngine engine = createAgoraRtcEngine();
    _engine = engine;
    _appId = credentials.appId;
    await engine.initialize(
      RtcEngineContext(
        appId: credentials.appId,
        channelProfile: ChannelProfileType.channelProfileCommunication,
        audioScenario: AudioScenarioType.audioScenarioDefault,
      ),
    );
    engine.registerEventHandler(
      RtcEngineEventHandler(
        onJoinChannelSuccess: (_, __) =>
            _connectionController.add(AgoraConnectionState.connected),
        onRejoinChannelSuccess: (_, __) =>
            _connectionController.add(AgoraConnectionState.connected),
        onConnectionLost: (_) =>
            _connectionController.add(AgoraConnectionState.reconnecting),
        onError: (_, __) =>
            _connectionController.add(AgoraConnectionState.failed),
        onTokenPrivilegeWillExpire: (_, __) => _tokenRenewalHandler?.call(),
      ),
    );
    await engine.enableAudio();
    await engine.disableVideo();
    await engine.joinChannel(
      token: credentials.token,
      channelId: credentials.channelName,
      uid: credentials.uid,
      options: const ChannelMediaOptions(
        autoSubscribeAudio: true,
        publishMicrophoneTrack: true,
        clientRoleType: ClientRoleType.clientRoleBroadcaster,
      ),
    );
  }

  Future<void> setMuted(bool muted) async {
    await _engine?.muteLocalAudioStream(muted);
  }

  Future<void> setSpeakerEnabled(bool enabled) async {
    await _engine?.setEnableSpeakerphone(enabled);
  }

  Future<void> leave() async {
    final RtcEngine? engine = _engine;
    _engine = null;
    _appId = null;
    if (engine == null) return;
    await engine.leaveChannel();
    await engine.release();
    _connectionController.add(AgoraConnectionState.idle);
  }

  Future<void> renewToken(AgoraCredentialsModel credentials) async {
    if (_engine == null || _appId != credentials.appId) {
      await join(credentials);
      return;
    }
    await _engine!.renewToken(credentials.token);
  }

  Future<void> dispose() async {
    _tokenRenewalHandler = null;
    await leave();
    await _connectionController.close();
  }
}
