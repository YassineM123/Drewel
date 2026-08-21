import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:record/record.dart';

enum VoiceRecordingPermission {
  granted,
  denied,
  permanentlyDenied,
}

class VoiceRecordingException implements Exception {
  const VoiceRecordingException(this.message, {this.code});

  final String message;
  final String? code;

  @override
  String toString() => message;
}

class VoiceRecordingResult {
  const VoiceRecordingResult({
    required this.path,
    required this.duration,
    required this.mimeType,
  });

  final String path;
  final Duration duration;
  final String mimeType;
}

/// Records AAC/M4A voice notes for ride chat.
///
/// Owns the microphone lifecycle end to end: permission checks, a single
/// recorder instance, amplitude samples for the waveform UI, the duration
/// ticker and the hard maximum-duration cap. The caller only decides what to
/// do with the finished file (send / discard).
class VoiceRecorderService {
  VoiceRecorderService({
    AudioRecorder? recorder,
    this.onMaxDurationReached,
  }) : _recorder = recorder ?? AudioRecorder();

  static const Duration maxDuration = Duration(seconds: 120);
  static const String voiceMimeType = 'audio/mp4';

  /// Fired when the hard cap stops recording on its own; carries the finished
  /// file so the caller can send it without a second stop() (which would
  /// return null because the recorder already stopped).
  final void Function(VoiceRecordingResult result)? onMaxDurationReached;

  final AudioRecorder _recorder;

  Timer? _ticker;
  StreamSubscription<Amplitude>? _amplitudeSubscription;

  final ValueNotifier<Duration> elapsed = ValueNotifier<Duration>(Duration.zero);
  final ValueNotifier<double> level = ValueNotifier<double>(0);
  final ValueNotifier<bool> recording = ValueNotifier<bool>(false);

  DateTime? _startedAt;
  bool _stopping = false;

  /// True when the OS settings page must be used to grant access.
  Future<VoiceRecordingPermission> ensurePermission() async {
    final PermissionStatus status = await Permission.microphone.status;
    if (status.isGranted || status.isLimited) return VoiceRecordingPermission.granted;
    if (status.isPermanentlyDenied || status.isRestricted) {
      return VoiceRecordingPermission.permanentlyDenied;
    }
    final PermissionStatus requested = await Permission.microphone.request();
    if (requested.isGranted || requested.isLimited) {
      return VoiceRecordingPermission.granted;
    }
    return requested.isPermanentlyDenied
        ? VoiceRecordingPermission.permanentlyDenied
        : VoiceRecordingPermission.denied;
  }

  Future<void> start() async {
    if (recording.value) return;
    final VoiceRecordingPermission permission = await ensurePermission();
    switch (permission) {
      case VoiceRecordingPermission.granted:
        break;
      case VoiceRecordingPermission.denied:
        throw const VoiceRecordingException(
          'Microphone access is required to record a voice message.',
          code: 'MIC_PERMISSION_DENIED',
        );
      case VoiceRecordingPermission.permanentlyDenied:
        throw const VoiceRecordingException(
          'Microphone access is blocked. Enable it for Drewel in Settings.',
          code: 'MIC_PERMISSION_PERMANENTLY_DENIED',
        );
    }

    if (!await _recorder.hasPermission()) {
      throw const VoiceRecordingException(
        'Microphone access is required to record a voice message.',
        code: 'MIC_PERMISSION_DENIED',
      );
    }

    final String fileName =
        'drewel_voice_${DateTime.now().microsecondsSinceEpoch}.m4a';
    // Temporary app storage keeps recordings out of the shared media store.
    final Directory baseDir = await getTemporaryDirectory();
    final Directory voiceDir = Directory(
      '${baseDir.path}${Platform.pathSeparator}chat_audio',
    );
    if (!await voiceDir.exists()) {
      await voiceDir.create(recursive: true);
    }
    final String path =
        '${voiceDir.path}${Platform.pathSeparator}$fileName';

    // AAC-LC in an M4A container plays on Android and iOS everywhere and keeps
    // speech intelligible at ~64 kbit/s mono (~0.5 MB per minute).
    const RecordConfig config = RecordConfig(
      encoder: AudioEncoder.aacLc,
      bitRate: 64000,
      sampleRate: 44100,
      numChannels: 1,
    );

    try {
      await _recorder.start(config, path: path);
    } on PlatformException catch (error) {
      throw VoiceRecordingException(
        'Recording could not start. Please try again.',
        code: error.code,
      );
    }

    _startedAt = DateTime.now();
    _stopping = false;
    recording.value = true;
    elapsed.value = Duration.zero;
    level.value = 0;

    _ticker = Timer.periodic(const Duration(milliseconds: 200), (_) {
      final Duration current =
          DateTime.now().difference(_startedAt ?? DateTime.now());
      elapsed.value = current;
      if (current >= maxDuration) {
        // Hard cap reached: stop automatically and hand the file to the
        // caller so it can be sent like a manual stop.
        unawaited(_autoStopAtCap());
      }
    });

    _amplitudeSubscription?.cancel();
    _amplitudeSubscription = _recorder
        .onAmplitudeChanged(const Duration(milliseconds: 100))
        .listen(
      (Amplitude amplitude) {
        // current is dBFS (-60..0); normalize into 0.05..1 for the waveform.
        final double normalized =
            ((amplitude.current + 60) / 60).clamp(0.05, 1.0).toDouble();
        level.value = normalized;
      },
      onError: (Object _) {},
      cancelOnError: false,
    );
  }

  Future<void> _autoStopAtCap() async {
    try {
      final VoiceRecordingResult? result = await stop();
      if (result != null) onMaxDurationReached?.call(result);
    } catch (_) {}
  }

  /// Finishes recording and returns the captured file. Returns null when
  /// nothing was captured (never started or already cancelled).
  Future<VoiceRecordingResult?> stop() async {
    if (!recording.value || _stopping) return null;
    _stopping = true;
    _teardownTimers();
    final Duration duration = elapsed.value;
    try {
      final String? path = await _recorder.stop();
      recording.value = false;
      if (path == null) return null;
      return VoiceRecordingResult(
        path: path,
        duration: duration < const Duration(milliseconds: 500)
            ? const Duration(milliseconds: 500)
            : duration,
        mimeType: voiceMimeType,
      );
    } catch (_) {
      recording.value = false;
      throw const VoiceRecordingException(
        'Recording could not be saved. Please try again.',
        code: 'RECORD_STOP_FAILED',
      );
    } finally {
      _stopping = false;
    }
  }

  /// Cancels the recording and deletes the partial file. Nothing is uploaded.
  Future<void> cancel() async {
    if (!recording.value) return;
    _teardownTimers();
    String? partialPath;
    try {
      partialPath = await _recorder.stop();
    } catch (_) {}
    recording.value = false;
    _stopping = false;
    if (partialPath != null) {
      await _deleteFile(partialPath);
    }
  }

  void _teardownTimers() {
    _ticker?.cancel();
    _ticker = null;
    _amplitudeSubscription?.cancel();
    _amplitudeSubscription = null;
    level.value = 0;
  }

  Future<void> dispose() async {
    await cancel();
    try {
      await _recorder.dispose();
    } catch (_) {}
  }

  Future<void> _deleteFile(String path) async {
    try {
      final File file = File(path);
      if (await file.exists()) await file.delete();
    } catch (_) {}
  }
}
