import 'dart:async';

import 'package:audioplayers/audioplayers.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:vibration/vibration.dart';

/// The single Drewel-branded audio identity.
///
/// Every notification event in the app routes through this service so that:
///
///  * exactly ONE sound plays per logical event (socket + REST + push sources
///    all collapse onto the same [eventKey]),
///  * a single `AudioPlayer` instance is reused (no duplicated/multiplexed
///    players, no memory leaks),
///  * the incoming-call ringtone loops while ringing and is guaranteed to stop
///    the moment the call disappears,
///  * vibration patterns stay paired with each sound,
///  * Android/iOS respect silent mode, DND and notification permissions
///    because we only request the same audio focus policed by the OS.
class NotificationSoundService {
  NotificationSoundService({AudioPlayer? player})
      : _player = player ?? AudioPlayer();

  final AudioPlayer _player;

  static const String _enabledKey = 'drewel.notification.soundsEnabled';
  static const String _vibrationKey = 'drewel.notification.vibrationEnabled';

  bool _init = false;
  bool _soundsEnabled = true;
  bool _vibrationEnabled = true;
  bool _hasVibrator = false;

  String? _activeCallId;
  Timer? _ringTimer;
  Timer? _pendingPlay;

  final Map<String, DateTime> _recentKeyFirstSeen = <String, DateTime>{};
  final Map<String, Duration> _recentKeyWindow = <String, Duration>{};

  String get _notificationAsset => 'sounds/drewel_notification.wav';
  String get _messageAsset => 'sounds/drewel_message.wav';
  String get _rideRequestAsset => 'sounds/drewel_ride_request.wav';
  String get _driverArrivedAsset => 'sounds/drewel_driver_arrived.wav';
  String get _callAsset => 'sounds/drewel_call.wav';
  String get _successAsset => 'sounds/drewel_success.wav';
  String get _warningAsset => 'sounds/drewel_warning.wav';

  /// Whether the user enabled app sounds (persisted).
  bool get soundsEnabled => _soundsEnabled;

  /// Whether the user enabled app vibration (persisted).
  bool get vibrationEnabled => _vibrationEnabled;

  bool get isCallRinging => _activeCallId != null;

  /// Initialises the shared player and pre-caches the short sounds.
  ///
  /// Safe to call multiple times and non-blocking: sounds are only prefixed by
  /// the OS audio focus rules, so failures here never break the app.
  Future<void> init() async {
    if (_init) return;
    _init = true;
    await _loadPreferences();
    try {
      _hasVibrator = await Vibration.hasVibrator() ?? false;
    } catch (_) {
      _hasVibrator = false;
    }
    try {
      await _player.setAudioContext(_lowLatencyContext(isCall: false));
      await _player.setPlayerMode(PlayerMode.lowLatency);
      // Pre-cache so the first notification never waits on a file read.
      for (final String asset in <String>[
        _notificationAsset,
        _messageAsset,
        _rideRequestAsset,
        _driverArrivedAsset,
        _successAsset,
        _warningAsset,
        _callAsset,
      ]) {
        try {
          await AudioCache.instance.load(asset);
        } catch (_) {
          // Desktop/web/tests may not expose the native asset cache.
        }
      }
    } catch (_) {
      // Audio platform unavailable (web without audio, tests, etc.).
    }
  }

  Future<void> _loadPreferences() async {
    try {
      final SharedPreferences prefs = await SharedPreferences.getInstance();
      _soundsEnabled = prefs.getBool(_enabledKey) ?? true;
      _vibrationEnabled = prefs.getBool(_vibrationKey) ?? true;
    } catch (_) {
      // Defaults apply when preferences are unavailable.
    }
  }

  Future<void> setSoundsEnabled(bool value) async {
    _soundsEnabled = value;
    if (!value) {
      // Removing the audio identity must silence everything immediately.
      await stopAllSounds();
    }
    try {
      final SharedPreferences prefs = await SharedPreferences.getInstance();
      await prefs.setBool(_enabledKey, value);
    } catch (_) {}
  }

  Future<void> setVibrationEnabled(bool value) async {
    _vibrationEnabled = value;
    if (!value) {
      await Vibration.cancel();
    }
    try {
      final SharedPreferences prefs = await SharedPreferences.getInstance();
      await prefs.setBool(_vibrationKey, value);
    } catch (_) {}
  }

  // ---------------------------------------------------------------------
  // Deduplication
  // ---------------------------------------------------------------------

  /// Returns true when [key] has not been reported within [window].
  ///
  /// A single logical event — e.g. one message arrived while a socket event,
  /// a REST poll and a foreground listener all observed it — must trigger the
  /// sound only once. Keys are the notificationId / messageId / rideId /
  /// callId where available.
  bool shouldPlay(String key, {Duration? window}) {
    if (key.isEmpty) return true;
    final Duration effective = window ?? const Duration(seconds: 6);
    _evictRecentKeys(DateTime.now());
    final DateTime? firstSeen = _recentKeyFirstSeen[key];
    final DateTime now = DateTime.now();
    if (firstSeen != null && now.difference(firstSeen) < effective) {
      return false;
    }
    _recentKeyFirstSeen[key] = now;
    _recentKeyWindow[key] = effective;
    if (_recentKeyFirstSeen.length > 256) {
      _recentKeyFirstSeen.clear();
      _recentKeyWindow.clear();
    }
    return true;
  }

  /// Returns true if [key] was played within [window]; helps external sources
  /// (e.g. a future push handler) decide whether the OS already sounded it.
  bool hadRecentEvent(String key,
      {Duration window = const Duration(seconds: 8)}) {
    _evictRecentKeys(DateTime.now());
    final DateTime? firstSeen = _recentKeyFirstSeen[key];
    if (firstSeen == null) return false;
    return DateTime.now().difference(firstSeen) <
        (_recentKeyWindow[key] ?? window);
  }

  void _evictRecentKeys(DateTime now) {
    if (_recentKeyFirstSeen.isEmpty) return;
    final Map<String, DateTime> stale = <String, DateTime>{};
    for (final MapEntry<String, DateTime> entry
        in _recentKeyFirstSeen.entries) {
      final Duration window =
          _recentKeyWindow[entry.key] ?? const Duration(seconds: 6);
      if (now.difference(entry.value) >= window) stale[entry.key] = entry.value;
    }
    for (final String key in stale.keys) {
      _recentKeyFirstSeen.remove(key);
      _recentKeyWindow.remove(key);
    }
  }

  // ---------------------------------------------------------------------
  // One-shot notification sounds
  // ---------------------------------------------------------------------

  /// Normal / general Drewel notification.
  Future<bool> playNotification({String eventKey = ''}) => _playOneShot(
        _notificationAsset,
        key: 'notification:$eventKey',
        window: const Duration(seconds: 6),
        vibrate: _vibrateSubtle,
      );

  /// Quiet chat message sound.
  Future<bool> playMessage({String eventKey = ''}) => _playOneShot(
        _messageAsset,
        key: 'message:$eventKey',
        window: const Duration(seconds: 4),
        vibrate: _vibrateSubtle,
      );

  /// New ride request alert for the driver.
  Future<bool> playRideRequest({String eventKey = ''}) => _playOneShot(
        _rideRequestAsset,
        key: 'ride_request:$eventKey',
        window: const Duration(seconds: 45),
        vibrate: _vibrateRideRequest,
      );

  /// Driver arrived alert for the passenger.
  Future<bool> playDriverArrived({String eventKey = ''}) => _playOneShot(
        _driverArrivedAsset,
        key: 'driver_arrived:$eventKey',
        window: const Duration(seconds: 25),
        vibrate: _vibrateDriverArrived,
      );

  /// Important successful action (points purchased, account approved…).
  Future<bool> playSuccess({String eventKey = ''}) => _playOneShot(
        _successAsset,
        key: 'success:$eventKey',
        window: const Duration(seconds: 6),
        vibrate: _vibrateSuccess,
      );

  /// Genuinely important / critical event.
  Future<bool> playWarning({String eventKey = ''}) => _playOneShot(
        _warningAsset,
        key: 'warning:$eventKey',
        window: const Duration(seconds: 25),
        vibrate: _vibrateWarning,
      );

  Future<bool> _playOneShot(
    String asset, {
    required String key,
    required Duration window,
    required Future<void> Function() vibrate,
  }) async {
    await init();
    if (!_soundsEnabled) return false;
    // Never overlap a ringing incoming call with a notification beep.
    if (isCallRinging) return false;
    if (!shouldPlay(key, window: window)) return false;
    try {
      await _stopCurrentPlayback();
      await _player.setAudioContext(_notificationContext);
      await _player.setReleaseMode(ReleaseMode.release);
      await _player.setSourceAsset(asset);
      await _player.resume();
    } catch (_) {
      // Playback is non-critical; never throw into the event pipeline.
    }
    if (_vibrationEnabled) {
      try {
        await vibrate();
      } catch (_) {}
    }
    return true;
  }

  // ---------------------------------------------------------------------
  // Incoming call ringtone
  // ---------------------------------------------------------------------

  /// Starts the looping Drewel ringtone for [callId].
  ///
  /// The ringtone belongs to exactly one live call. Re-invoking with the same
  /// [callId] is a no-op; invoking with a different call id stops the previous
  /// ringtone first.
  Future<void> playIncomingCall({required String callId}) async {
    if (callId.isEmpty) return;
    if (!_soundsEnabled) return;
    await init();
    if (_activeCallId == callId) return;
    if (_activeCallId != null) await _stopCallImpl();
    _activeCallId = callId;
    try {
      await _stopCurrentPlayback();
      await _player.setAudioContext(_callContext);
      await _player.setReleaseMode(ReleaseMode.loop);
      await _player.setSourceAsset(_callAsset);
      await _player.resume();
    } catch (_) {
      _activeCallId = null;
    }
    if (_vibrationEnabled && _hasVibrator) {
      _startCallVibration();
    }
  }

  /// Stops the ringtone once the call is answered, declined, cancelled,
  /// expired or otherwise gone. Ignoring [callId] (null) stops whatever is
  /// ringing; passing the current id guarantees the caller only silences its
  /// own call.
  Future<void> stopCallSound({String? callId}) async {
    if (_activeCallId == null) return;
    if (callId != null && callId != _activeCallId) return;
    await _stopCallImpl();
    try {
      await _player.setAudioContext(_notificationContext);
    } catch (_) {}
  }

  Future<void> _stopCallImpl() async {
    _activeCallId = null;
    _ringTimer?.cancel();
    _ringTimer = null;
    if (_vibrationEnabled) {
      try {
        await Vibration.cancel();
      } catch (_) {}
    }
  }

  void _startCallVibration() {
    _ringTimer?.cancel();
    _ringTimer = Timer.periodic(const Duration(milliseconds: 1600), (_) async {
      if (_activeCallId == null) return;
      try {
        await Vibration.vibrate(duration: 500, amplitude: 180);
      } catch (_) {}
    });
    // Immediate first pulse.
    try {
      Vibration.vibrate(duration: 500, amplitude: 180);
    } catch (_) {}
  }

  // ---------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------

  /// Stops the active ride-request alert (also used to clear stale alerts
  /// when a request is accepted, declined, expires or is invalidated).
  Future<void> stopRideRequestSound({String? rideId}) async {
    if (_activeCallId != null) return;
    await _stopCurrentPlayback();
    if (_vibrationEnabled) {
      try {
        await Vibration.cancel();
      } catch (_) {}
    }
    if (rideId != null && rideId.isNotEmpty) {
      // Suppress a replay of the same ride request for a while.
      _recentKeyFirstSeen['ride_request:$rideId'] = DateTime.now();
      _recentKeyWindow['ride_request:$rideId'] = const Duration(seconds: 45);
    }
  }

  /// Hard-stop: any preview, pending play or ringtone.
  Future<void> stopAllSounds() async {
    _pendingPlay?.cancel();
    _pendingPlay = null;
    await _stopCallImpl();
    await _stopCurrentPlayback();
  }

  Future<void> _stopCurrentPlayback() async {
    try {
      await _player.stop();
      await _player.setSourceAsset(_notificationAsset);
    } catch (_) {
      // Player may be disposed during tests.
    }
  }

  // ---------------------------------------------------------------------
  // Vibration patterns
  // ---------------------------------------------------------------------

  Future<void> _vibrateSubtle() async {
    if (!_hasVibrator) return;
    try {
      await Vibration.vibrate(duration: 40, amplitude: 80);
    } catch (_) {}
  }

  Future<void> _vibrateRideRequest() async {
    if (!_hasVibrator) return;
    try {
      final bool? custom = await Vibration.hasCustomVibrationsSupport();
      if (custom == true) {
        await Vibration.vibrate(
          pattern: <int>[0, 220, 90, 200, 90, 360],
          intensities: <int>[0, 255, 90, 255, 90, 255],
          repeat: -1,
        );
      } else {
        await Vibration.vibrate(duration: 700, amplitude: 200);
      }
    } catch (_) {
      await Vibration.vibrate(duration: 500);
    }
  }

  Future<void> _vibrateDriverArrived() async {
    if (!_hasVibrator) return;
    try {
      await Vibration.vibrate(
        pattern: <int>[0, 140, 70, 160],
        intensities: <int>[0, 255, 90, 200],
        repeat: -1,
      );
    } catch (_) {
      await Vibration.vibrate(duration: 320);
    }
  }

  Future<void> _vibrateSuccess() async {
    if (!_hasVibrator) return;
    try {
      await Vibration.vibrate(
        pattern: <int>[0, 70, 60, 70],
        repeat: -1,
      );
    } catch (_) {}
  }

  Future<void> _vibrateWarning() async {
    if (!_hasVibrator) return;
    try {
      await Vibration.vibrate(
        pattern: <int>[0, 240, 110, 240],
        intensities: <int>[0, 255, 120, 220],
        repeat: -1,
      );
    } catch (_) {
      await Vibration.vibrate(duration: 420, amplitude: 255);
    }
  }

  // ---------------------------------------------------------------------
  // Audio contexts
  // ---------------------------------------------------------------------

  AudioContext get _notificationContext => AudioContext(
        android: AudioContextAndroid(
          isSpeakerphoneOn: false,
          stayAwake: false,
          contentType: AndroidContentType.sonification,
          usageType: AndroidUsageType.notificationEvent,
          audioFocus: AndroidAudioFocus.gainTransient,
        ),
        iOS: AudioContextIOS(
          category: AVAudioSessionCategory.ambient,
          options: <AVAudioSessionOptions>{},
        ),
      );

  AudioContext get _callContext => AudioContext(
        android: AudioContextAndroid(
          isSpeakerphoneOn: true,
          stayAwake: false,
          contentType: AndroidContentType.sonification,
          usageType: AndroidUsageType.notificationRingtone,
          audioFocus: AndroidAudioFocus.gainTransient,
        ),
        iOS: AudioContextIOS(
          category: AVAudioSessionCategory.playback,
          options: <AVAudioSessionOptions>{},
        ),
      );

  AudioContext _lowLatencyContext({required bool isCall}) => AudioContext(
        android: AudioContextAndroid(
          isSpeakerphoneOn: isCall,
          stayAwake: false,
          contentType: AndroidContentType.sonification,
          usageType: AndroidUsageType.notificationEvent,
          audioFocus: AndroidAudioFocus.gainTransient,
        ),
        iOS: AudioContextIOS(
          category: AVAudioSessionCategory.ambient,
          options: <AVAudioSessionOptions>{},
        ),
      );

  void dispose() {
    _ringTimer?.cancel();
    _pendingPlay?.cancel();
    _player.dispose();
  }
}
