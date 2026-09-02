import 'dart:async';
import 'dart:math';
import 'dart:ui' as ui;

import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:geolocator/geolocator.dart';
import 'package:get/get.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../../common/socket_services.dart';
import '../../../../common/notification_sound_service.dart';
import '../../../../common/vehicle_assets.dart';
import '../../../data/apis/api_constants/api_key_constants.dart';
import '../../../data/apis/api_constants/api_url_constants.dart';
import '../../../data/apis/api_models/active_ride_model.dart';
import '../../../data/apis/communication_api_client.dart';
import '../../../data/repositories/active_ride_repository.dart';
import '../../communication/controllers/call_state_controller.dart';
import '../../../routes/app_pages.dart';

class ActiveRideController extends GetxService with WidgetsBindingObserver {
  ActiveRideController({
    required ActiveRideRepository repository,
    SocketService? socketService,
  })  : _repository = repository,
        _socket = socketService ?? SocketService();

  final ActiveRideRepository _repository;
  final SocketService _socket;

  final Rxn<ActiveRideModel> ride = Rxn<ActiveRideModel>();
  final Rxn<ActiveRideModel> lastCompletedRide = Rxn<ActiveRideModel>();
  final Rxn<RideRouteModel> route = Rxn<RideRouteModel>();
  final RxBool isLoading = false.obs;
  final RxBool isActionLoading = false.obs;
  final RxBool isRouteLoading = false.obs;
  final RxBool isOffline = false.obs;
  final RxBool isSocketReady = false.obs;
  final RxBool isFollowingDriver = true.obs;
  final RxString errorMessage = ''.obs;
  final RxString routeError = ''.obs;
  final RxString role = 'user'.obs;
  final Rxn<RideCoordinateModel> currentPosition = Rxn<RideCoordinateModel>();
  final RxInt driverVehicleMarkerVersion = 0.obs;
  final Map<String, BitmapDescriptor> _driverVehicleMarkerCache =
      <String, BitmapDescriptor>{};

  GoogleMapController? mapController;
  StreamSubscription<Position>? _positionSubscription;
  Timer? _locationHeartbeat;
  Timer? _routeRefreshTimer;
  DateTime? _lastLocationSentAt;
  DateTime? _lastDeviationRefreshAt;
  DateTime? _lastLiveRouteRefreshAt;
  RideCoordinateModel? _lastLocationSent;
  String _token = '';
  String? _joinedRideId;
  int _latestEventVersion = -1;
  int _cameraAnimationGeneration = 0;
  bool _isProgrammaticCameraMove = false;
  final Set<String> _actionKeys = <String>{};

  NotificationSoundService? get _soundsService =>
      Get.isRegistered<NotificationSoundService>()
          ? Get.find<NotificationSoundService>()
          : null;

  ActiveRideModel? get activeRide => ride.value;
  RideStatus get status => ride.value?.rideStatus ?? RideStatus.unknown;
  bool get isDriver => role.value == ApiKeyConstants.driver;
  bool get hasRide => ride.value?.isRecoverable == true;
  String get homeRoute => isDriver ? Routes.DRIVER_HOME : Routes.USER_HOME;
  bool get shouldTrackDriver =>
      isDriver &&
      const <RideStatus>{
        RideStatus.driverOnTheWay,
        RideStatus.driverArrived,
        RideStatus.pickupConfirmed,
        RideStatus.inProgress,
      }.contains(status);
  String get routePhase =>
      status == RideStatus.inProgress ? 'destination' : 'pickup';

  @override
  Future<void> onInit() async {
    super.onInit();
    WidgetsBinding.instance.addObserver(this);
    await recover(showLoader: false);
  }

  BitmapDescriptor driverVehicleMarkerFor(String? vehicleType) {
    final String assetPath = vehicleMarkerAssetPath(vehicleType);
    final BitmapDescriptor? cached = _driverVehicleMarkerCache[assetPath];
    if (cached != null) return cached;
    unawaited(_loadDriverVehicleMarker(vehicleType));
    return BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueAzure);
  }

  Future<void> _loadDriverVehicleMarker(String? vehicleType) async {
    final String assetPath = vehicleMarkerAssetPath(vehicleType);
    if (_driverVehicleMarkerCache.containsKey(assetPath)) return;
    try {
      final ByteData data = await rootBundle.load(assetPath);
      final ui.Codec codec = await ui.instantiateImageCodec(
        data.buffer.asUint8List(),
        targetWidth: 104,
      );
      final ui.FrameInfo frame = await codec.getNextFrame();
      final ByteData? bytes =
          await frame.image.toByteData(format: ui.ImageByteFormat.png);
      if (bytes == null) return;
      _driverVehicleMarkerCache[assetPath] =
          BitmapDescriptor.bytes(bytes.buffer.asUint8List());
      driverVehicleMarkerVersion.value++;
    } catch (error) {
      debugPrint('Failed to load active ride vehicle marker: $error');
    }
  }

  Future<void> recover({bool showLoader = true}) async {
    if (isLoading.value) return;
    if (showLoader) isLoading.value = true;
    errorMessage.value = '';
    try {
      final SharedPreferences preferences =
          await SharedPreferences.getInstance();
      role.value = preferences.getString(ApiKeyConstants.type) ?? 'user';
      final String token =
          preferences.getString(ApiKeyConstants.token)?.trim() ?? '';
      if (token.isEmpty) {
        await _setRide(null);
        return;
      }
      if (token != _token || !_socket.isConnected) {
        _configureSocket(token);
      }
      final ActiveRideModel? recovered = await _repository.getActiveRide();
      isOffline.value = false;
      await _setRide(recovered);
    } on CommunicationApiException catch (error) {
      isOffline.value = error.statusCode == null || error.statusCode! >= 500;
      errorMessage.value = error.message;
      // A temporary failure must never erase a ride restored earlier.
    } catch (_) {
      isOffline.value = true;
      errorMessage.value = 'Unable to refresh the ride. Showing saved status.';
    } finally {
      isLoading.value = false;
    }
  }

  void _configureSocket(String token) {
    _socket.disconnect();
    _token = token;
    _socket.connect(ApiUrlConstants.socketUrl, token);
    for (final String event in <String>[
      'ride:created',
      'ride:status_changed',
      'ride:state',
      'ride:driver_location',
      'ride:eta_updated',
      'ride:cancelled',
      'ride:completed',
      'ride:error',
    ]) {
      _socket.off(event);
      _socket.on(event, (dynamic payload) => _handleRideEvent(event, payload));
    }
    _socket.onConnect(() {
      isSocketReady.value = false;
      final String? id = ride.value?.id;
      if (id != null && id.isNotEmpty) _joinRide(id);
    });
  }

  Future<void> _handleRideEvent(String event, dynamic raw) async {
    if (raw is! Map) return;
    final Map<String, dynamic> payload = Map<String, dynamic>.from(raw);
    final String eventRideId =
        (payload['rideId'] ?? payload['ride']?['id'] ?? '').toString();
    final String? currentId = ride.value?.id;
    if (currentId != null &&
        eventRideId.isNotEmpty &&
        eventRideId != currentId) {
      return;
    }
    final int version = (payload['stateVersion'] as num?)?.toInt() ?? -1;
    if (version >= 0 && version <= _latestEventVersion) return;
    if (version >= 0) _latestEventVersion = version;

    if (event == 'ride:error') {
      errorMessage.value =
          (payload['message'] ?? 'The live ride connection reported an error.')
              .toString();
      return;
    }
    if (event == 'ride:driver_location') {
      final dynamic rawLocation = payload['location'] ?? payload;
      if (rawLocation is Map && ride.value != null) {
        final RideCoordinateModel location = RideCoordinateModel.fromJson(
            Map<String, dynamic>.from(rawLocation));
        if (location.isValid) {
          ride.value = ride.value!.copyWith(lastDriverLocation: location);
          _refreshRouteAfterLiveLocation(location);
          if (isFollowingDriver.value) recenter();
        }
      }
      return;
    }
    if (event == 'ride:eta_updated') {
      final dynamic rawRoute = payload['route'] ?? payload;
      if (rawRoute is Map) {
        final Map<String, dynamic> routePayload =
            Map<String, dynamic>.from(rawRoute);
        if (routePayload['encodedPolyline'] == null &&
            routePayload['polyline'] == null) {
          unawaited(refreshRoute(silent: true));
        } else {
          route.value = RideRouteModel.fromJson(routePayload);
        }
      }
      return;
    }
    // Anything else is a status changing event. Compare against the last known
    // status so a sound is emitted exactly once per transition, regardless of
    // how many sockets/polls observe the new status later.
    final RideStatus previousStatus =
        ride.value?.rideStatus ?? RideStatus.unknown;
    await recover(showLoader: false);
    final RideStatus currentStatus =
        ride.value?.rideStatus ?? RideStatus.unknown;
    if (previousStatus != currentStatus) {
      await _playStatusTransitionSound(previousStatus, currentStatus);
    }
  }

  /// Plays the passenger-side "your driver arrived", the completion chime, and
  /// cleans up the ride-request alert when it stops being pending.
  Future<void> _playStatusTransitionSound(
    RideStatus previous,
    RideStatus current,
  ) async {
    final NotificationSoundService? sounds = _soundsService;
    if (sounds == null) return;
    final String rideId = ride.value?.id ?? '';

    // A ride request is no longer pending when it transitions to an offer,
    // a confirmed ride, or any terminal state.
    if (previous == RideStatus.contacting ||
        previous == RideStatus.offerPending) {
      await sounds.stopRideRequestSound(rideId: rideId);
    }

    if (current == RideStatus.driverArrived && !isDriver) {
      await sounds.playDriverArrived(eventKey: rideId);
    } else if (current == RideStatus.completed) {
      await sounds.playSuccess(eventKey: rideId);
    }
  }

  Future<void> _setRide(ActiveRideModel? value) async {
    final String? previousId = ride.value?.id;
    if (value?.rideStatus == RideStatus.completed) {
      lastCompletedRide.value = value;
    }
    final ActiveRideModel? activeValue =
        value?.rideStatus.isTerminal == true ? null : value;
    final bool removeActiveRideAfterFrame =
        activeValue == null && ride.value != null;
    if (previousId != null && previousId != activeValue?.id) {
      _socket.leaveRide(previousId);
      _joinedRideId = null;
    }
    if (Get.isRegistered<CallStateController>()) {
      Get.find<CallStateController>().activeRide.value = activeValue;
    }
    if (activeValue == null) {
      route.value = null;
      await _stopLocationTracking();
      _routeRefreshTimer?.cancel();
      if (removeActiveRideAfterFrame) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          ride.value = null;
        });
      } else {
        ride.value = null;
      }
      return;
    }
    ride.value = activeValue;
    _latestEventVersion = activeValue.stateVersion;
    unawaited(_loadDriverVehicleMarker(activeValue.vehicleType));
    _joinRide(activeValue.id);
    if (shouldTrackDriver) {
      await _startLocationTracking();
    } else {
      await _stopLocationTracking();
    }
    if (activeValue.rideStatus.isActive) {
      await refreshRoute(silent: true);
      _startRouteRefresh();
    }
  }

  void _joinRide(String rideId) {
    if (!_socket.isConnected || _joinedRideId == rideId) return;
    _socket.joinRide(rideId, (dynamic response) {
      final bool success = response is Map &&
          (response['success'] == true || response['ok'] == true);
      isSocketReady.value = success;
      if (success) {
        _joinedRideId = rideId;
      } else {
        errorMessage.value = response is Map && response['message'] != null
            ? response['message'].toString()
            : 'Live ride updates are temporarily unavailable.';
      }
    });
  }

  void _startRouteRefresh() {
    _routeRefreshTimer?.cancel();
    _routeRefreshTimer = Timer.periodic(
      const Duration(seconds: 120),
      (_) => refreshRoute(silent: true),
    );
  }

  Future<void> refreshRoute({bool silent = false}) async {
    final ActiveRideModel? current = ride.value;
    if (current == null ||
        !current.rideStatus.isActive ||
        isRouteLoading.value) {
      return;
    }
    isRouteLoading.value = true;
    if (!silent) routeError.value = '';
    try {
      route.value = await _repository.getRoute(current.id, phase: routePhase);
      routeError.value = '';
    } on CommunicationApiException catch (error) {
      routeError.value = error.message;
    } catch (_) {
      routeError.value = 'Route unavailable. The ride status remains active.';
    } finally {
      isRouteLoading.value = false;
    }
  }

  Future<bool> performPrimaryAction({String? pickupPin}) async {
    final ActiveRideModel? current = ride.value;
    if (current == null || !isDriver || isActionLoading.value) return false;
    final RideStatus? next = switch (current.rideStatus) {
      RideStatus.confirmed => RideStatus.driverOnTheWay,
      RideStatus.driverOnTheWay => RideStatus.driverArrived,
      RideStatus.driverArrived => RideStatus.pickupConfirmed,
      RideStatus.pickupConfirmed => RideStatus.inProgress,
      RideStatus.inProgress => RideStatus.completed,
      _ => null,
    };
    if (next == null) return false;
    if (next == RideStatus.pickupConfirmed &&
        (pickupPin == null || !RegExp(r'^\d{4}$').hasMatch(pickupPin))) {
      errorMessage.value = 'Enter the passenger’s four-digit pickup PIN.';
      return false;
    }
    return _transition(next, pickupPin: pickupPin);
  }

  Future<bool> _transition(
    RideStatus next, {
    String? pickupPin,
    String? reason,
  }) async {
    final ActiveRideModel? current = ride.value;
    if (current == null || isActionLoading.value) return false;
    final String key = _actionKey(current.id, next.wireValue);
    isActionLoading.value = true;
    errorMessage.value = '';
    try {
      final ActiveRideModel updated = await _repository.transitionRide(
        current.id,
        next.wireValue,
        idempotencyKey: key,
        location: currentPosition.value,
        pickupPin: pickupPin,
        reason: reason,
      );
      _actionKeys.remove(key);
      await _setRide(updated);
      return true;
    } on CommunicationApiException catch (error) {
      errorMessage.value = error.message;
      if (error.statusCode != null && error.statusCode! < 500) {
        _actionKeys.remove(key);
      }
      return false;
    } finally {
      isActionLoading.value = false;
    }
  }

  Future<bool> cancel({
    required String reason,
    required String note,
  }) async {
    final ActiveRideModel? current = ride.value;
    if (current == null || !current.rideStatus.canNormallyCancel) return false;
    final String key = _actionKey(current.id, 'cancel');
    isActionLoading.value = true;
    errorMessage.value = '';
    try {
      final ActiveRideModel updated = await _repository.cancelRide(
        current.id,
        reason: reason,
        note: note,
        idempotencyKey: key,
        location: currentPosition.value,
      );
      _actionKeys.remove(key);
      await _setRide(updated);
      return true;
    } on CommunicationApiException catch (error) {
      errorMessage.value = error.message;
      if (error.statusCode != null && error.statusCode! < 500) {
        _actionKeys.remove(key);
      }
      return false;
    } finally {
      isActionLoading.value = false;
    }
  }

  Future<bool> reportProblem(String reason) async {
    final ActiveRideModel? current = ride.value;
    if (current == null || reason.trim().isEmpty) return false;
    isActionLoading.value = true;
    try {
      await _repository.report(current.id, reason.trim());
      return true;
    } on CommunicationApiException catch (error) {
      errorMessage.value = error.message;
      return false;
    } finally {
      isActionLoading.value = false;
    }
  }

  Future<bool> submitReview({
    required ActiveRideModel completedRide,
    required int rating,
    String comment = '',
  }) async {
    if (isActionLoading.value) return false;
    isActionLoading.value = true;
    errorMessage.value = '';
    try {
      final ActiveRideModel reviewed = await _repository.submitReview(
        completedRide.id,
        rating: rating,
        comment: comment,
      );
      lastCompletedRide.value = reviewed;
      return true;
    } on CommunicationApiException catch (error) {
      errorMessage.value = error.message;
      return false;
    } finally {
      isActionLoading.value = false;
    }
  }

  String _actionKey(String rideId, String action) {
    final String prefix = '$rideId:$action:';
    final String existing = _actionKeys.firstWhere(
      (String key) => key.startsWith(prefix),
      orElse: () => '',
    );
    if (existing.isNotEmpty) return existing;
    final String key =
        '$prefix${DateTime.now().microsecondsSinceEpoch.toRadixString(36)}-'
        '${Random.secure().nextInt(1 << 32).toRadixString(36)}';
    _actionKeys.add(key);
    return key;
  }

  Future<void> _startLocationTracking() async {
    if (_positionSubscription != null) return;
    final LocationPermission permission = await Geolocator.checkPermission();
    final LocationPermission resolved = permission == LocationPermission.denied
        ? await Geolocator.requestPermission()
        : permission;
    if (resolved == LocationPermission.denied ||
        resolved == LocationPermission.deniedForever) {
      errorMessage.value =
          'Location permission is required while navigating an active ride.';
      return;
    }
    const LocationSettings settings = LocationSettings(
      accuracy: LocationAccuracy.bestForNavigation,
      distanceFilter: 10,
    );
    _positionSubscription =
        Geolocator.getPositionStream(locationSettings: settings).listen(
      _handlePosition,
      onError: (_) {
        isOffline.value = true;
        errorMessage.value = 'GPS signal is weak. Retrying automatically.';
      },
    );
    _locationHeartbeat?.cancel();
    _locationHeartbeat = Timer.periodic(
      const Duration(seconds: 15),
      (_) => _sendLocation(currentPosition.value),
    );
  }

  void _handlePosition(Position position) {
    final RideCoordinateModel location = RideCoordinateModel(
      latitude: position.latitude,
      longitude: position.longitude,
      accuracy: position.accuracy,
      heading: position.heading >= 0 ? position.heading : null,
      speed: position.speed >= 0 ? position.speed : null,
      recordedAt: position.timestamp,
    );
    if (!location.isValid || position.accuracy > 250) return;
    currentPosition.value = location;
    isOffline.value = false;
    _sendLocation(location);
    _refreshRouteAfterLiveLocation(location);
    _refreshIfOffRoute(location);
    if (isFollowingDriver.value) recenter();
  }

  void _refreshRouteAfterLiveLocation(RideCoordinateModel location) {
    final ActiveRideModel? current = ride.value;
    if (current == null ||
        !current.rideStatus.isActive ||
        !location.isValid ||
        isRouteLoading.value) {
      return;
    }
    final RideCoordinateModel? target =
        routePhase == 'destination' ? current.destination : current.pickup;
    if (target?.isValid != true) return;
    final List<LatLng> points = polylinePoints;
    final bool needsFirstRoute = points.isEmpty || routeError.value.isNotEmpty;
    final bool routeStartsBehindDriver = !needsFirstRoute &&
        Geolocator.distanceBetween(
              location.latitude,
              location.longitude,
              points.first.latitude,
              points.first.longitude,
            ) >
            60;
    if (!needsFirstRoute && !routeStartsBehindDriver) return;
    final DateTime now = DateTime.now();
    final Duration minimumRefreshGap = needsFirstRoute
        ? const Duration(seconds: 12)
        : const Duration(seconds: 30);
    if (_lastLiveRouteRefreshAt != null &&
        now.difference(_lastLiveRouteRefreshAt!) < minimumRefreshGap) {
      return;
    }
    _lastLiveRouteRefreshAt = now;
    unawaited(refreshRoute(silent: true));
  }

  void _refreshIfOffRoute(RideCoordinateModel location) {
    final List<LatLng> points = polylinePoints;
    if (points.isEmpty || isRouteLoading.value) return;
    double nearestMeters = double.infinity;
    for (final LatLng point in points) {
      nearestMeters = min(
        nearestMeters,
        Geolocator.distanceBetween(
          location.latitude,
          location.longitude,
          point.latitude,
          point.longitude,
        ),
      );
    }
    if (nearestMeters <= 100) return;
    final DateTime now = DateTime.now();
    if (_lastDeviationRefreshAt != null &&
        now.difference(_lastDeviationRefreshAt!) <
            const Duration(seconds: 60)) {
      return;
    }
    _lastDeviationRefreshAt = now;
    unawaited(refreshRoute(silent: true));
  }

  Future<void> _sendLocation(RideCoordinateModel? location) async {
    final ActiveRideModel? current = ride.value;
    if (location == null || current == null || !shouldTrackDriver) return;
    final DateTime now = DateTime.now();
    final bool elapsed = _lastLocationSentAt == null ||
        now.difference(_lastLocationSentAt!) >= const Duration(seconds: 5);
    final bool moved = _lastLocationSent == null ||
        Geolocator.distanceBetween(
              _lastLocationSent!.latitude,
              _lastLocationSent!.longitude,
              location.latitude,
              location.longitude,
            ) >=
            10;
    if (!elapsed && !moved) return;
    _lastLocationSentAt = now;
    _lastLocationSent = location;
    if (_socket.isConnected) {
      _socket.emitRideDriverLocation(
        current.id,
        location.toJson(),
        (dynamic response) {
          final bool accepted = response is Map &&
              (response['ok'] == true || response['success'] == true);
          if (!accepted &&
              response is Map &&
              response['error'] != 'LOCATION_THROTTLED') {
            isOffline.value = true;
          }
        },
      );
      return;
    }
    try {
      // REST is a reconnect fallback, not a duplicate write for every GPS fix.
      await _repository.updateDriverLocation(current.id, location);
    } catch (_) {
      // Socket reconnect recovery and the next heartbeat retry automatically.
      isOffline.value = true;
    }
  }

  Future<void> _stopLocationTracking() async {
    await _positionSubscription?.cancel();
    _positionSubscription = null;
    _locationHeartbeat?.cancel();
    _locationHeartbeat = null;
    _lastLocationSentAt = null;
    _lastLocationSent = null;
    _lastDeviationRefreshAt = null;
    _lastLiveRouteRefreshAt = null;
  }

  void attachMap(GoogleMapController controller) {
    mapController = controller;
    fitRouteOverview();
  }

  void handleMapMoveStarted() {
    if (_isProgrammaticCameraMove) return;
    isFollowingDriver.value = false;
  }

  void recenter() {
    final RideCoordinateModel? location =
        currentPosition.value ?? ride.value?.lastDriverLocation;
    if (location == null || !location.isValid) return;
    isFollowingDriver.value = true;
    final CameraPosition position = CameraPosition(
      target: _navigationCameraTarget(location, polylinePoints),
      zoom: 17,
      bearing: _navigationBearing(location, polylinePoints),
      tilt: 45,
    );
    unawaited(
      _animateRideCamera(
        CameraUpdate.newCameraPosition(position),
      ),
    );
  }

  void fitRouteOverview() {
    final ActiveRideModel? current = ride.value;
    final RideCoordinateModel? origin =
        currentPosition.value ?? current?.lastDriverLocation ?? current?.pickup;
    final RideCoordinateModel? target =
        routePhase == 'destination' ? current?.destination : current?.pickup;
    if (origin == null ||
        target == null ||
        !origin.isValid ||
        !target.isValid) {
      return;
    }
    isFollowingDriver.value = false;
    unawaited(
      _animateRideCamera(CameraUpdate.newLatLngBounds(
        LatLngBounds(
          southwest: LatLng(
            min(origin.latitude, target.latitude),
            min(origin.longitude, target.longitude),
          ),
          northeast: LatLng(
            max(origin.latitude, target.latitude),
            max(origin.longitude, target.longitude),
          ),
        ),
        64,
      )),
    );
  }

  List<LatLng> get polylinePoints =>
      decodePolyline(route.value?.encodedPolyline ?? '');

  Future<void> _animateRideCamera(CameraUpdate update) async {
    final GoogleMapController? controller = mapController;
    if (controller == null) return;
    final int generation = ++_cameraAnimationGeneration;
    _isProgrammaticCameraMove = true;
    try {
      await controller.animateCamera(update);
    } catch (error) {
      debugPrint('Skipped active ride camera update: $error');
    } finally {
      Timer(const Duration(milliseconds: 350), () {
        if (_cameraAnimationGeneration == generation) {
          _isProgrammaticCameraMove = false;
        }
      });
    }
  }

  @visibleForTesting
  static LatLng navigationCameraTargetForTest(
    RideCoordinateModel location,
    List<LatLng> routePoints,
  ) =>
      _navigationCameraTarget(location, routePoints);

  @visibleForTesting
  static double navigationBearingForTest(
    RideCoordinateModel location,
    List<LatLng> routePoints,
  ) =>
      _navigationBearing(location, routePoints);

  static LatLng _navigationCameraTarget(
    RideCoordinateModel location,
    List<LatLng> routePoints,
  ) {
    final LatLng driver = LatLng(location.latitude, location.longitude);
    final LatLng? lookAhead = _routeLookAheadPoint(driver, routePoints);
    if (lookAhead == null) return driver;
    return LatLng(
      driver.latitude + (lookAhead.latitude - driver.latitude) * 0.35,
      driver.longitude + (lookAhead.longitude - driver.longitude) * 0.35,
    );
  }

  static double _navigationBearing(
    RideCoordinateModel location,
    List<LatLng> routePoints,
  ) {
    final double? heading = location.heading;
    if (heading != null && heading.isFinite) return heading % 360;
    final LatLng driver = LatLng(location.latitude, location.longitude);
    final LatLng? lookAhead = _routeLookAheadPoint(driver, routePoints);
    if (lookAhead == null) return 0;
    return Geolocator.bearingBetween(
      driver.latitude,
      driver.longitude,
      lookAhead.latitude,
      lookAhead.longitude,
    );
  }

  static LatLng? _routeLookAheadPoint(
    LatLng driver,
    List<LatLng> routePoints,
  ) {
    if (routePoints.length < 2) return null;
    int nearestIndex = 0;
    double nearestMeters = double.infinity;
    for (int i = 0; i < routePoints.length; i++) {
      final LatLng point = routePoints[i];
      final double distance = Geolocator.distanceBetween(
        driver.latitude,
        driver.longitude,
        point.latitude,
        point.longitude,
      );
      if (distance < nearestMeters) {
        nearestMeters = distance;
        nearestIndex = i;
      }
    }
    const double lookAheadMeters = 140;
    double travelled = 0;
    LatLng previous = nearestIndex == 0 ? driver : routePoints[nearestIndex];
    for (int i = max(1, nearestIndex + 1); i < routePoints.length; i++) {
      final LatLng next = routePoints[i];
      final double segmentMeters = Geolocator.distanceBetween(
        previous.latitude,
        previous.longitude,
        next.latitude,
        next.longitude,
      );
      if (travelled + segmentMeters >= lookAheadMeters && segmentMeters > 0) {
        final double ratio = (lookAheadMeters - travelled) / segmentMeters;
        return LatLng(
          previous.latitude + (next.latitude - previous.latitude) * ratio,
          previous.longitude + (next.longitude - previous.longitude) * ratio,
        );
      }
      travelled += segmentMeters;
      previous = next;
    }
    return routePoints.last;
  }

  @visibleForTesting
  static List<LatLng> decodePolyline(String encoded) {
    final List<LatLng> points = <LatLng>[];
    int index = 0;
    int latitude = 0;
    int longitude = 0;
    while (index < encoded.length) {
      int result = 0;
      int shift = 0;
      int byte;
      do {
        if (index >= encoded.length) return const <LatLng>[];
        byte = encoded.codeUnitAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      latitude += (result & 1) != 0 ? ~(result >> 1) : result >> 1;
      result = 0;
      shift = 0;
      do {
        if (index >= encoded.length) return const <LatLng>[];
        byte = encoded.codeUnitAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      longitude += (result & 1) != 0 ? ~(result >> 1) : result >> 1;
      points.add(LatLng(latitude / 1e5, longitude / 1e5));
    }
    return points;
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      unawaited(recover(showLoader: false));
    } else if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.hidden ||
        state == AppLifecycleState.detached) {
      unawaited(_stopLocationTracking());
      _socket.disconnect();
      _joinedRideId = null;
      isSocketReady.value = false;
    }
  }

  @override
  void onClose() {
    WidgetsBinding.instance.removeObserver(this);
    _routeRefreshTimer?.cancel();
    unawaited(_stopLocationTracking());
    final String? id = ride.value?.id;
    if (id != null) _socket.leaveRide(id);
    _socket.disconnect();
    mapController?.dispose();
    super.onClose();
  }
}
