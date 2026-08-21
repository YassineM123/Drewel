import 'dart:async';
import 'dart:io';

import 'package:audioplayers/audioplayers.dart';
import 'package:get/get.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../common/api_interceptor_client.dart';
import '../apis/api_constants/api_key_constants.dart';
import '../apis/api_constants/api_url_constants.dart';

enum VoicePlaybackStatus {
  idle,
  loading,
  playing,
  paused,
}

class VoicePlaybackState {
  const VoicePlaybackState({
    this.activeMessageId = '',
    this.status = VoicePlaybackStatus.idle,
    this.position = Duration.zero,
    this.duration = Duration.zero,
    this.speed = 1.0,
    this.error = false,
  });

  final String activeMessageId;
  final VoicePlaybackStatus status;
  final Duration position;
  final Duration duration;
  final double speed;
  final bool error;

  bool isActive(String messageId) =>
      activeMessageId.isNotEmpty && activeMessageId == messageId;

  VoicePlaybackState copyWith({
    String? activeMessageId,
    VoicePlaybackStatus? status,
    Duration? position,
    Duration? duration,
    double? speed,
    bool? error,
  }) =>
      VoicePlaybackState(
        activeMessageId: activeMessageId ?? this.activeMessageId,
        status: status ?? this.status,
        position: position ?? this.position,
        duration: duration ?? this.duration,
        speed: speed ?? this.speed,
        error: error ?? this.error,
      );
}

/// App-wide single-voice-note playback.
///
/// Only one voice message can ever play at a time: starting another one (or
/// leaving the chat) stops the previous instance. Audio is fetched lazily on
/// first play through the authenticated API client and cached in the temporary
/// directory keyed by message id, so opening a long conversation never
/// preloads anything and replays work offline.
class VoicePlayerManager {
  VoicePlayerManager({AudioPlayer? player, http.Client? client})
      : _player = player ?? AudioPlayer(),
        _client = client ?? ApiInterceptorClient();

  static const List<double> supportedSpeeds = <double>[1.0, 1.5, 2.0];

  final AudioPlayer _player;
  final http.Client _client;
  final Rx<VoicePlaybackState> state = const VoicePlaybackState().obs;

  StreamSubscription<Duration>? _positionSubscription;
  StreamSubscription<Duration?>? _durationSubscription;
  StreamSubscription<PlayerState>? _stateSubscription;
  StreamSubscription<void>? _completionSubscription;
  final Set<String> _cachedIds = <String>{};
  bool _disposed = false;

  Future<String> _resolveLocalFile(String messageId, String audioUrl) async {
    final Directory baseDir = await getTemporaryDirectorySafe();
    final Directory cacheDir = Directory(
      '${baseDir.path}${Platform.pathSeparator}chat_audio_cache',
    );
    if (!await cacheDir.exists()) {
      await cacheDir.create(recursive: true);
    }
    final File file = File(
      '${cacheDir.path}${Platform.pathSeparator}$messageId.m4a',
    );
    if (_cachedIds.contains(messageId) && await file.exists()) {
      return file.path;
    }
    final Uri uri = resolveApiUrl(audioUrl);
    final SharedPreferences preferences =
        await SharedPreferences.getInstance();
    final String token =
        preferences.getString(ApiKeyConstants.token)?.trim() ?? '';
    final http.Response response = await _client
        .get(
          uri,
          headers: <String, String>{
            if (token.isNotEmpty) 'Authorization': 'Bearer $token',
          },
        )
        .timeout(const Duration(seconds: 30));
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception('Voice download failed (${response.statusCode})');
    }
    await file.writeAsBytes(response.bodyBytes, flush: true);
    _cachedIds.add(messageId);
    return file.path;
  }

  static Future<Directory> getTemporaryDirectorySafe() async {
    // path_provider is unavailable in some test/web environments; fall back to
    // the system temp dir so playback still works instead of crashing.
    try {
      return await getTemporaryDirectory();
    } catch (_) {
      return Directory.systemTemp;
    }
  }

  /// The backend returns audio paths like `/api/rides/{id}/messages/{id}/audio`
  /// while [ApiUrlConstants.baseUrl] already ends with `/api/`; strip the
  /// duplicate segment so the resolved URL is not `/api//api/...`.
  static Uri resolveApiUrl(String pathOrUrl) {
    if (pathOrUrl.startsWith('http')) return Uri.parse(pathOrUrl);
    String path = pathOrUrl;
    final Uri base = Uri.parse(ApiUrlConstants.baseUrl);
    final bool baseEndsWithApi =
        base.path.replaceAll(RegExp(r'/+$'), '').endsWith('/api');
    if (baseEndsWithApi && path.startsWith('/api/')) {
      path = path.substring('/api'.length);
    }
    return base.resolve(path.startsWith('/') ? path.substring(1) : path);
  }

  Future<void> toggle(String messageId, String audioUrl) async {
    if (state.value.isActive(messageId)) {
      final VoicePlaybackStatus status = state.value.status;
      if (status == VoicePlaybackStatus.playing) {
        await _pause();
      } else if (status == VoicePlaybackStatus.paused) {
        await _resume();
      } else if (status == VoicePlaybackStatus.loading) {
        await stop();
      } else {
        await _playFromStart(messageId, audioUrl);
      }
      return;
    }
    await _playFromStart(messageId, audioUrl);
  }

  Future<void> seek(String messageId, Duration position) async {
    if (!state.value.isActive(messageId)) return;
    try {
      await _player.seek(position);
    } catch (_) {}
  }

  Future<void> cycleSpeed(String messageId) async {
    final int index = supportedSpeeds.indexOf(state.value.speed);
    final double next =
        supportedSpeeds[(index + 1) % supportedSpeeds.length];
    state.value = state.value.copyWith(speed: next);
    if (state.value.isActive(messageId)) {
      try {
        await _player.setPlaybackRate(next);
      } catch (_) {}
    }
  }

  Future<void> _playFromStart(String messageId, String audioUrl) async {
    if (_disposed) return;
    state.value = VoicePlaybackState(
      activeMessageId: messageId,
      status: VoicePlaybackStatus.loading,
      speed: state.value.speed,
    );
    try {
      final String localPath =
          await _resolveLocalFile(messageId, audioUrl);
      if (_disposed || !state.value.isActive(messageId)) return;
      await _stopPlayer();
      await _player.setReleaseMode(ReleaseMode.release);
      await _player.setPlaybackRate(state.value.speed);
      await _player.play(DeviceFileSource(localPath));
      _wireListenersOnce();
      state.value = state.value.copyWith(
        status: VoicePlaybackStatus.playing,
        error: false,
      );
    } catch (_) {
      if (!state.value.isActive(messageId)) return;
      state.value = state.value.copyWith(
        status: VoicePlaybackStatus.idle,
        error: true,
      );
    }
  }

  bool _listenersWired = false;

  void _wireListenersOnce() {
    if (_listenersWired) return;
    _listenersWired = true;
    _positionSubscription = _player.onPositionChanged.listen((Duration p) {
      if (state.value.status == VoicePlaybackStatus.playing ||
          state.value.status == VoicePlaybackStatus.paused) {
        state.value = state.value.copyWith(position: p);
      }
    });
    _durationSubscription = _player.onDurationChanged.listen((Duration? d) {
      if (d != null && d > Duration.zero) {
        state.value = state.value.copyWith(duration: d);
      }
    });
    _stateSubscription = _player.onPlayerStateChanged.listen((PlayerState s) {
      if (!state.value.isActive(state.value.activeMessageId)) return;
      switch (s) {
        case PlayerState.playing:
          state.value = state.value.copyWith(status: VoicePlaybackStatus.playing);
        case PlayerState.paused:
          state.value = state.value.copyWith(status: VoicePlaybackStatus.paused);
        case PlayerState.stopped:
        case PlayerState.completed:
        case PlayerState.disposed:
          if (state.value.status == VoicePlaybackStatus.playing ||
              state.value.status == VoicePlaybackStatus.paused) {
            state.value = state.value.copyWith(
              status: VoicePlaybackStatus.idle,
              position: Duration.zero,
            );
          }
      }
    });
    _completionSubscription = _player.onPlayerComplete.listen((_) {
      state.value = state.value.copyWith(
        status: VoicePlaybackStatus.idle,
        position: Duration.zero,
      );
    });
  }

  Future<void> _pause() async {
    try {
      await _player.pause();
    } catch (_) {}
    state.value = state.value.copyWith(status: VoicePlaybackStatus.paused);
  }

  Future<void> _resume() async {
    try {
      await _player.resume();
    } catch (_) {}
    state.value = state.value.copyWith(status: VoicePlaybackStatus.playing);
  }

  Future<void> _stopPlayer() async {
    try {
      await _player.stop();
    } catch (_) {}
  }

  /// Stops playback and releases focus — called when the chat screen closes.
  Future<void> stop() async {
    await _stopPlayer();
    state.value = VoicePlaybackState(speed: state.value.speed);
  }

  Future<void> dispose() async {
    if (_disposed) return;
    _disposed = true;
    await _positionSubscription?.cancel();
    await _durationSubscription?.cancel();
    await _stateSubscription?.cancel();
    await _completionSubscription?.cancel();
    try {
      await _player.dispose();
    } catch (_) {}
  }
}
