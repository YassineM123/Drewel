import 'dart:async';
import 'dart:convert';
import 'package:drewel/app/data/apis/api_models/get_add_driver_details_model.dart';
import 'package:drewel/app/data/apis/api_models/get_simple_response_model.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:geocoding/geocoding.dart';
import 'package:geolocator/geolocator.dart';
import 'package:get/get.dart';
import 'dart:ui' as ui;
import 'dart:io';
import 'package:flutter/services.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:responsive_sizer/responsive_sizer.dart';
import 'package:google_places_flutter/model/prediction.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:http/http.dart' as http;
import '../../../../common/colors.dart';
import '../../../../common/common_widgets.dart';
import '../../../../common/driver_online_service.dart';
import '../../../../common/gps_fix.dart';
import '../../../../common/google_maps_web_auth.dart';
import '../../../../common/socket_services.dart';
import '../../../../common/text_styles.dart';
import '../../../data/apis/api_constants/api_key_constants.dart';
import '../../../data/apis/api_methods/api_methods.dart';
import '../../../data/constants/icons_constant.dart';
import '../../../data/constants/string_constants.dart';
import '../../../data/apis/api_constants/api_url_constants.dart';
import '../../../data/config/app_config.dart';
import '../../../routes/app_pages.dart';
import '../../communication/controllers/call_state_controller.dart';

String driverOnlineFailureMessage(SimpleResponseModel? response) {
  final String serverMessage = (response?.message ?? '').trim();
  if (serverMessage.isNotEmpty &&
      serverMessage.toLowerCase() != 'unable to update online status.') {
    return serverMessage;
  }

  return switch ((response?.code ?? '').trim().toUpperCase()) {
    'OUTSIDE_SERVICE_AREA' =>
      'Your current GPS location is outside the available service area.',
    'LOCATION_PENDING' ||
    'LOCATION_REQUIRED' ||
    'INVALID_COORDINATES' =>
      'A fresh precise GPS location is required before going online.',
    'LOCATION_INACCURATE' =>
      'Your GPS accuracy is too low. Enable precise location and try again.',
    'PROFILE_NOT_APPROVED' ||
    'DRIVER_NOT_APPROVED' =>
      'Your driver profile must be approved before going online.',
    _ => 'Unable to update online status. Please try again.',
  };
}

class DriverHomeController extends GetxController with WidgetsBindingObserver {
  final GlobalKey<ScaffoldState> scaffoldKey = GlobalKey<ScaffoldState>();
  StreamSubscription<void>? _mapsAuthenticationFailureSubscription;
  final RxBool mapConfigurationFailed = false.obs;
  TextEditingController locationController = TextEditingController();
  FocusNode locationFocusNode = FocusNode();
  final lat = 23.4241.obs;
  final lon = 53.8478.obs;
  LatLng mapPosition = const LatLng(23.4241, 53.8478);
  GoogleMapController? xController;

  final count = 0.obs;
  BitmapDescriptor customMarker = BitmapDescriptor.defaultMarker;

  /// Google Places autocomplete suggestions
  final RxList<Prediction> placeSuggestions = <Prediction>[].obs;
  Timer? _placesDebounce;
  StreamSubscription<Position>? _positionStreamSubscription;

  // Socket service for real-time location updates
  final SocketService socketService = SocketService();
  Timer? _locationUpdateTimer;
  Timer? _presenceHeartbeatTimer;
  int _presenceHeartbeatIntervalMs = 20000;
  bool _presenceHeartbeatInFlight = false;
  bool _appIsForeground = true;
  String? _driverId;
  String? _driverName;
  String? _vehicleType;
  String? _city;
  static const int _locationUpdateIntervalSeconds =
      10; // Update every 10 seconds
  DateTime? _lastDriverLocationApiUpdateAt;
  bool _isUpdatingDriverLocation = false;
  bool _hasDriverLocation = false;
  DateTime? _driverPositionRecordedAt;
  double? _driverPositionAccuracyM;
  double? _driverPositionHeadingDegrees;
  double? _driverPositionSpeedMps;
  bool _isRefreshingLocationHeartbeat = false;

  bool get _isDriverOnline => !isGoOnline.value;

  Future<BitmapDescriptor> getResizedMarker(String assetPath,
      {int width = 80}) async {
    final ByteData data = await rootBundle.load(assetPath);
    final codec = await ui.instantiateImageCodec(
      data.buffer.asUint8List(),
      targetWidth: width, // adjust width for desired size
    );
    final frameInfo = await codec.getNextFrame();
    final resizedImage =
        await frameInfo.image.toByteData(format: ui.ImageByteFormat.png);
    return BitmapDescriptor.fromBytes(resizedImage!.buffer.asUint8List());
  }

  void loadCustomMarker() async {
    if (!kIsWeb && Platform.isIOS) {
      customMarker = await getResizedMarker(
        IconConstants.icLocation,
        width: 100, // smaller size for iOS
      );
    } else {
      customMarker = await BitmapDescriptor.fromAssetImage(
        const ImageConfiguration(size: Size(35, 35)),
        IconConstants.icLocation,
      );
    }
    increment(); // Trigger a rebuild
  }

  final isGoOnline = true.obs;
  final showLoading = false.obs;
  final RxMap<String, String> userData = <String, String>{}.obs;
  @override
  void onInit() {
    super.onInit();
    mapConfigurationFailed.value = googleMapsAuthenticationFailed();
    _mapsAuthenticationFailureSubscription =
        googleMapsAuthenticationFailures().listen((_) {
      mapConfigurationFailed.value = true;
    });
    Get.find<CallStateController>().refreshActiveRide();
    WidgetsBinding.instance.addObserver(this);
    DriverOnlineService.initUiCallbacks(_handlePresenceServiceEvent);
    loadCustomMarker();
    checkPermission();
    callingGetDriverDetails();
    _initSocket();
  }

  @override
  void onClose() {
    _mapsAuthenticationFailureSubscription?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    _stopLocationUpdates();
    _stopPresenceHeartbeatTimer();
    _stopRealtimeLocationTracking();
    _placesDebounce?.cancel();
    DriverOnlineService.removeUiCallback(_handlePresenceServiceEvent);
    socketService.disconnect();
    super.onClose();
  }

  void _handlePresenceServiceEvent(Object data) {
    if (!DriverOnlineService.isOfflineEvent(data)) return;
    isGoOnline.value = true;
    _stopLocationUpdates();
    _stopPresenceHeartbeatTimer();
    _stopRealtimeLocationTracking();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);
    if (state == AppLifecycleState.hidden ||
        state == AppLifecycleState.paused ||
        state == AppLifecycleState.detached) {
      _appIsForeground = false;
      // App is in background or closing - stop location updates
      _stopLocationUpdates();
      _stopRealtimeLocationTracking();
      // A hidden web tab can still renew presence (subject to browser timer
      // throttling), so do not deliberately force it to expire. Native
      // background execution is delegated to the Android foreground service.
      if (!kIsWeb || state == AppLifecycleState.detached) {
        _stopPresenceHeartbeatTimer();
      }
      // Location tracking is foreground-only, so do not let Socket.IO retry
      // DNS/network connections while Android has suspended the activity.
      socketService.disconnect();
    } else if (state == AppLifecycleState.resumed) {
      _appIsForeground = true;
      // App is in foreground - resume location updates and realtime GPS tracking
      _initSocket();
      _startRealtimeLocationTracking();
      if (_isDriverOnline) {
        _startLocationUpdates();
        unawaited(_resumeOnlinePresence());
      }
    }
  }

  Future<void> _resumeOnlinePresence() async {
    final PresenceHeartbeatResult result =
        await DriverOnlineService.heartbeatNow();
    if (result == PresenceHeartbeatResult.renewed ||
        result == PresenceHeartbeatResult.networkFailure) {
      final String? sessionId = await DriverOnlineService.currentSessionId();
      if (sessionId != null) {
        _startPresenceHeartbeatTimer();
        await _startAndroidPresenceService(
          DriverPresenceModel(sessionId: sessionId),
        );
      }
      return;
    }

    // The server no longer accepts this lease (expired/replaced), or this is a
    // legacy online record with no session. Establish a fresh, GPS-backed
    // presence session instead of pretending the old Online flag is valid.
    isGoOnline.value = true;
    await callingUpdateDriverOnlineStatus();
  }

  Future<void> _startAndroidPresenceService(
    DriverPresenceModel presence,
  ) async {
    try {
      final bool started = await DriverOnlineService.start(presence);
      if (!started && isAndroidPlatform && _appIsForeground) {
        CommonWidgets.snackBarView(
          title:
              'Background online service could not start. Keep Drewel open and check battery restrictions.',
        );
      }
    } catch (error) {
      debugPrint('Presence foreground service failed: $error');
      if (isAndroidPlatform && _appIsForeground) {
        CommonWidgets.snackBarView(
          title:
              'Background online service could not start. Keep Drewel open and check battery restrictions.',
        );
      }
    }
  }

  void _startPresenceHeartbeatTimer([int? intervalMs]) {
    _stopPresenceHeartbeatTimer();
    if (!_appIsForeground || !_isDriverOnline) return;
    if (intervalMs != null) {
      _presenceHeartbeatIntervalMs = intervalMs.clamp(5000, 60000).toInt();
    }
    _presenceHeartbeatTimer = Timer.periodic(
      Duration(milliseconds: _presenceHeartbeatIntervalMs),
      (_) => unawaited(_sendPresenceHeartbeat()),
    );
  }

  void _stopPresenceHeartbeatTimer() {
    _presenceHeartbeatTimer?.cancel();
    _presenceHeartbeatTimer = null;
  }

  Future<void> _sendPresenceHeartbeat() async {
    if (_presenceHeartbeatInFlight || !_isDriverOnline) return;
    _presenceHeartbeatInFlight = true;
    try {
      final PresenceHeartbeatResult result =
          await DriverOnlineService.heartbeatNow();
      if (result == PresenceHeartbeatResult.staleSession ||
          result == PresenceHeartbeatResult.noSession) {
        _stopPresenceHeartbeatTimer();
        if (_appIsForeground) {
          isGoOnline.value = true;
          await callingUpdateDriverOnlineStatus();
        }
      }
    } finally {
      _presenceHeartbeatInFlight = false;
    }
  }

  /// Initialize socket connection
  Future<void> _initSocket() async {
    SharedPreferences pref = await SharedPreferences.getInstance();
    String token = pref.getString(ApiKeyConstants.token) ?? '';
    _driverId = pref.getString(ApiKeyConstants.userId) ?? '';

    if (token.isNotEmpty) {
      socketService.onLocationTrackingReady(() {
        print('Driver location tracking authenticated and ready');
      });
      socketService.connect(ApiUrlConstants.socketUrl, token);
      socketService.onConnect(() {
        print('Driver location socket connected');
      });
      print('Socket connected for driver location updates');
    }
  }

  /// Start periodic location updates via socket
  void _startLocationUpdates() {
    _stopLocationUpdates(); // Stop any existing timer

    // Obtain a fresh measurement immediately. Replaying the last movement fix
    // would let a stationary driver's discovery timestamp expire.
    unawaited(_refreshLocationHeartbeat());

    // Then obtain and emit a fresh GPS fix every 10 seconds.
    _locationUpdateTimer = Timer.periodic(
      const Duration(seconds: _locationUpdateIntervalSeconds),
      (_) => unawaited(_refreshLocationHeartbeat()),
    );

    print(
        'Started location updates - emitting every $_locationUpdateIntervalSeconds seconds');
  }

  Future<void> _refreshLocationHeartbeat() async {
    if (!_isDriverOnline || _isRefreshingLocationHeartbeat) return;
    _isRefreshingLocationHeartbeat = true;
    try {
      if (!await Geolocator.isLocationServiceEnabled()) return;

      final LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        return;
      }

      final Position position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.bestForNavigation,
          timeLimit: Duration(seconds: 8),
        ),
      );
      if (!_isDriverOnline) return;

      await _applyDriverPosition(
        position,
        emitRealtimeOnMovement: false,
      );
      // Emit even when the coordinates did not change: the new measurement
      // timestamp keeps a stationary online driver discoverable on the map.
      _emitCurrentLocation();
    } catch (error) {
      debugPrint('Driver location heartbeat failed: $error');
    } finally {
      _isRefreshingLocationHeartbeat = false;
    }
  }

  /// Stop periodic location updates
  void _stopLocationUpdates() {
    _locationUpdateTimer?.cancel();
    _locationUpdateTimer = null;
    print('Stopped location updates');
  }

  /// Emit current location to socket
  void _emitCurrentLocation() {
    if (!_hasDriverLocation) return;
    if (_driverId == null || _driverId!.isEmpty) return;
    final DateTime? recordedAt = _driverPositionRecordedAt;
    final double? accuracyM = _driverPositionAccuracyM;
    if (recordedAt == null || accuracyM == null) return;
    // SocketService retains the latest fix while disconnected/authenticating
    // and flushes it as soon as location tracking is ready.
    socketService.emitDriverLocationUpdate({
      'driverId': _driverId,
      ...buildGpsFixPayload(
        latitude: lat.value,
        longitude: lon.value,
        recordedAt: recordedAt,
        accuracyM: accuracyM,
        heading: _driverPositionHeadingDegrees,
        speed: _driverPositionSpeedMps,
      ),
      'fullName': _driverName ?? '',
      'vehicleType': _vehicleType ?? '',
      'city': _city ?? '',
    });
  }

  void _startRealtimeLocationTracking() {
    if (_positionStreamSubscription != null) return;

    final LocationSettings locationSettings =
        defaultTargetPlatform == TargetPlatform.android
            ? AndroidSettings(
                accuracy: LocationAccuracy.bestForNavigation,
                distanceFilter: 0,
                intervalDuration: Duration(
                  seconds: _locationUpdateIntervalSeconds,
                ),
              )
            : const LocationSettings(
                accuracy: LocationAccuracy.bestForNavigation,
                distanceFilter: 10,
              );

    _positionStreamSubscription = Geolocator.getPositionStream(
      locationSettings: locationSettings,
    ).listen(
      (Position position) async {
        await _applyDriverPosition(
          position,
          syncToServer: _isDriverOnline,
          emitRealtimeOnMovement: false,
        );
        // AndroidSettings requests a new measured fix every ten seconds even
        // while stationary. Emit every measurement so marketplace freshness
        // and the admin marker never depend on the driver moving 10 metres.
        if (_isDriverOnline) _emitCurrentLocation();
      },
      onError: (Object error) {
        print('Driver position stream error: $error');
      },
    );
  }

  void _stopRealtimeLocationTracking() {
    _positionStreamSubscription?.cancel();
    _positionStreamSubscription = null;
  }

  Future<void> _applyDriverPosition(
    Position position, {
    bool animateCamera = false,
    bool syncToServer = false,
    bool forceServerSync = false,
    bool updateAddress = false,
    bool emitRealtimeOnMovement = true,
  }) async {
    final bool hasPositionChanged =
        lat.value != position.latitude || lon.value != position.longitude;

    lat.value = position.latitude;
    lon.value = position.longitude;
    mapPosition = LatLng(position.latitude, position.longitude);
    _hasDriverLocation = true;
    _driverPositionRecordedAt = position.timestamp;
    _driverPositionAccuracyM = normalizeGpsAccuracy(position.accuracy);
    _driverPositionHeadingDegrees =
        position.heading >= 0 ? position.heading : null;
    _driverPositionSpeedMps = position.speed >= 0 ? position.speed : null;

    if (animateCamera && xController != null) {
      xController!.animateCamera(
        CameraUpdate.newCameraPosition(
          CameraPosition(target: mapPosition, zoom: 14),
        ),
      );
    }

    if (updateAddress) {
      await _updateLocationText(position);
    }

    if (syncToServer || forceServerSync) {
      await _syncDriverLocationToServer(force: forceServerSync);
    }

    if (hasPositionChanged) {
      // Push an accepted GPS movement immediately. The periodic timer remains
      // as a heartbeat, while SocketService queues the newest fix until the
      // authenticated realtime channel is ready.
      if (_isDriverOnline && emitRealtimeOnMovement) {
        _emitCurrentLocation();
      }
      increment();
    }
  }

  Future<void> _updateLocationText(Position position) async {
    try {
      List<Placemark> placemarks = await placemarkFromCoordinates(
        position.latitude,
        position.longitude,
      );
      if (placemarks.isEmpty || locationFocusNode.hasFocus) return;

      Placemark place = placemarks[0];
      String fullAddress =
          '${place.street}, ${place.subLocality}, ${place.locality}, '
          '${place.postalCode}, ${place.country}';
      locationController.text = fullAddress;
    } catch (e) {
      print('Failed to resolve current address: $e');
    }
  }

  Future<void> _syncDriverLocationToServer({bool force = false}) async {
    if (!_hasDriverLocation) return;
    if (_isUpdatingDriverLocation) return;
    if (!force && !_isDriverOnline) return;

    final DateTime now = DateTime.now();
    if (!force &&
        _lastDriverLocationApiUpdateAt != null &&
        now.difference(_lastDriverLocationApiUpdateAt!).inSeconds <
            _locationUpdateIntervalSeconds) {
      return;
    }

    _isUpdatingDriverLocation = true;
    try {
      final bool updated = await callingUpdateDriverLocation(showError: false);
      if (updated) {
        _lastDriverLocationApiUpdateAt = now;
      }
    } finally {
      _isUpdatingDriverLocation = false;
    }
  }

  void increment() => count.value++;

  /// Handle text changes in the location field with debounce
  void onLocationTextChanged(String value) {
    _placesDebounce?.cancel();
    if (value.trim().isEmpty) {
      placeSuggestions.clear();
      increment();
      return;
    }
    _placesDebounce = Timer(const Duration(milliseconds: 400), () {
      _fetchPlaceSuggestions(value.trim());
    });
  }

  /// Fetch autocomplete suggestions from Google Places HTTP API
  Future<void> _fetchPlaceSuggestions(String input) async {
    try {
      final uri = Uri.parse(
          'https://maps.googleapis.com/maps/api/place/autocomplete/json'
          '?input=$input'
          '&key=${ApiKeyConstants.googleMapKey}'
          '&language=en'
          '&components=country:${AppConfig.marketplaceCountryCode}');

      final response = await http.get(uri);
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['status'] == 'OK') {
          final List preds = data['predictions'] ?? [];
          placeSuggestions.value =
              preds.map((e) => Prediction.fromJson(e)).toList();
        } else {
          placeSuggestions.clear();
        }
      } else {
        placeSuggestions.clear();
      }
    } catch (_) {
      placeSuggestions.clear();
    }
    increment();
  }

  /// Clear suggestions explicitly (used when opening drawer, etc.)
  void clearPlaceSuggestions() {
    _placesDebounce?.cancel();
    placeSuggestions.clear();
    increment();
  }

  void clickOnMenu() {
    if (userData.isNotEmpty) {
      scaffoldKey.currentState?.openEndDrawer();
    } else {
      CommonWidgets.showMyToastMessage(
          'Driver data is loading please wait ....');
    }
  }

  Future<void> checkPermission() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      if (!kIsWeb) showPermissionAlert();
    } else {
      await getCurrentLocation(showError: false);
    }
  }

  Future<void> getCurrentLocation({bool showError = true}) async {
    LocationPermission permission = await Geolocator.requestPermission();
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      debugPrint('Location permission denied');
      if (showError) {
        if (kIsWeb) {
          CommonWidgets.snackBarView(
            title:
                'Allow precise location for this site in your browser, then try again.',
          );
        } else {
          showPermissionAlert();
        }
      }
      return;
    }

    final Position currentPosition = await Geolocator.getCurrentPosition();
    await _applyDriverPosition(
      currentPosition,
      animateCamera: true,
      forceServerSync: true,
      updateAddress: true,
    );
    _startRealtimeLocationTracking();
  }

  void showPermissionAlert() {
    // Browser permission is managed by the address-bar site controls. A
    // Flutter modal only dims the map without giving web users a way to fix it.
    if (kIsWeb) {
      CommonWidgets.snackBarView(
        title:
            'Allow precise location for this site in your browser, then try again.',
      );
      return;
    }
    showDialog(
        context: Get.context!,
        builder: (BuildContext context) {
          return Dialog(
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(30.px)), //this right here
            child: Container(
              height: 450.px,
              padding: const EdgeInsets.all(12.0),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Icon(
                    Icons.location_on,
                    size: 100.px,
                    color: primaryColor,
                  ),
                  SizedBox(
                    height: 20.px,
                  ),
                  Text(
                    StringConstants.enableLocation,
                    style: MyTextStyle.titleStyle20bb,
                  ),
                  SizedBox(
                    height: 10.px,
                  ),
                  Text(
                    StringConstants.toUseThisServicesWeNeedPermissionToAccess,
                    style: MyTextStyle.titleStyle12b,
                    textAlign: TextAlign.center,
                  ),
                  CommonWidgets.commonElevatedButton(
                      context: context,
                      onPressed: () async {
                        Get.back();
                        LocationPermission permission =
                            await Geolocator.requestPermission();
                        if (permission == LocationPermission.denied) {
                          print('Permission Denied.....');
                          showPermissionAlert();
                        } else {
                          print('Permission Granted.....');
                          getCurrentLocation();
                        }
                      },
                      child: Text(
                        StringConstants.enableLocation,
                        style: MyTextStyle.titleStyle16bw,
                      ),
                      buttonMargin: EdgeInsets.only(bottom: 10.px, top: 20)),
                  GestureDetector(
                    onTap: () {
                      Get.back();
                      CommonWidgets.snackBarView(
                          title:
                              'Without location permission you can not use app...',
                          success: false);
                      showPermissionAlert();
                    },
                    child: Container(
                      height: 50.px,
                      alignment: Alignment.center,
                      margin: EdgeInsets.only(top: 10.px, bottom: 20.px),
                      decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(15.px),
                          color: primaryColor.withOpacity(0.8)),
                      child: Text(
                        StringConstants.cancel,
                        style: MyTextStyle.titleStyle16bw,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          );
        });
  }

  Future<void> clickOnLocation(Prediction prediction) async {
    locationController.text = prediction.description ?? "";
    locationController.selection = TextSelection.fromPosition(
      TextPosition(offset: prediction.description?.length ?? 0),
    );

    if (prediction.placeId != null) {
      final placeId = prediction.placeId!;
      final url =
          "https://maps.googleapis.com/maps/api/place/details/json?place_id=$placeId&key=${ApiKeyConstants.googleMapKey}";

      final response = await http.get(Uri.parse(url));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);

        if (data["status"] == "OK") {
          final location = data["result"]["geometry"]["location"];
          final latValue = location["lat"];
          final lngValue = location["lng"];
          final selectedMapLocation = LatLng(latValue, lngValue);

          // Animate camera to selected location
          if (xController != null) {
            xController!.animateCamera(
              CameraUpdate.newCameraPosition(
                CameraPosition(
                  target: selectedMapLocation,
                  zoom: 14,
                ),
              ),
            );
          }
        } else {
          print("Place Details Error: ${data["status"]}");
          // Error silently - don't show snackbar
        }
      } else {
        print("HTTP Error: ${response.statusCode}");
        // Error silently - don't show snackbar
      }
    }
  }

  Future<bool> callingUpdateDriverLocation({bool showError = true}) async {
    try {
      final DateTime? recordedAt = _driverPositionRecordedAt;
      final double? accuracyM = _driverPositionAccuracyM;
      if (!_hasDriverLocation || recordedAt == null || accuracyM == null) {
        return false;
      }
      final Map<String, dynamic> bodyParams = buildGpsFixPayload(
        latitude: lat.value,
        longitude: lon.value,
        recordedAt: recordedAt,
        accuracyM: accuracyM,
        heading: _driverPositionHeadingDegrees,
        speed: _driverPositionSpeedMps,
      );
      SimpleResponseModel? simpleResponseModel =
          await ApiMethods.driverUpdateLocationApi(bodyParams: bodyParams);
      if (simpleResponseModel != null &&
          simpleResponseModel.success != null &&
          simpleResponseModel.success!) {
        print('update location successfully completed....');
        return true;
      } else {
        if (showError) {
          CommonWidgets.snackBarView(
              title: simpleResponseModel?.message ??
                  'Current location Failed ...');
        }
      }
    } catch (e) {
      if (showError) {
        CommonWidgets.snackBarView(title: 'Somethings wrong...');
      }
    }
    return false;
  }

  Future<void> callingUpdateDriverOnlineStatus() async {
    if (showLoading.value) return;
    try {
      final bool goingOnline = isGoOnline.value;
      Map<String, dynamic> bodyParams = {
        ApiKeyConstants.isOnline: goingOnline,
      };
      showLoading.value = true;

      if (!goingOnline) {
        final String? sessionId = await DriverOnlineService.currentSessionId();
        if (sessionId != null) bodyParams['sessionId'] = sessionId;
      }

      if (goingOnline) {
        if (!await Geolocator.isLocationServiceEnabled()) {
          CommonWidgets.snackBarView(
              title: 'Turn on precise location before going online.');
          return;
        }

        LocationPermission permission = await Geolocator.checkPermission();
        if (permission == LocationPermission.denied) {
          permission = await Geolocator.requestPermission();
        }
        if (permission == LocationPermission.denied ||
            permission == LocationPermission.deniedForever) {
          CommonWidgets.snackBarView(
              title: 'Location permission is required to go online.');
          return;
        }

        try {
          final Position position = await Geolocator.getCurrentPosition(
            locationSettings: const LocationSettings(
              // Desktop browsers can wait indefinitely for a navigation-grade
              // fix. Their normal high-accuracy fix is sufficient in the
              // allowlisted Tunisia QA area.
              accuracy: kIsWeb
                  ? LocationAccuracy.high
                  : LocationAccuracy.bestForNavigation,
              timeLimit: Duration(seconds: 12),
            ),
          ).timeout(const Duration(seconds: 15));
          await _applyDriverPosition(
            position,
            emitRealtimeOnMovement: false,
          );
          bodyParams.addAll(buildGpsFixPayload(
            latitude: position.latitude,
            longitude: position.longitude,
            recordedAt: position.timestamp,
            accuracyM: normalizeGpsAccuracy(position.accuracy),
            heading: position.heading >= 0 ? position.heading : null,
            speed: position.speed >= 0 ? position.speed : null,
          ));
        } on TimeoutException {
          final DateTime? recordedAt = _driverPositionRecordedAt;
          final double? accuracyM = _driverPositionAccuracyM;
          final bool hasFreshPageFix = _hasDriverLocation &&
              recordedAt != null &&
              accuracyM != null &&
              DateTime.now().difference(recordedAt).inSeconds <= 45;
          if (!kIsWeb || !hasFreshPageFix) rethrow;
          bodyParams.addAll(buildGpsFixPayload(
            latitude: lat.value,
            longitude: lon.value,
            recordedAt: recordedAt,
            accuracyM: normalizeGpsAccuracy(accuracyM),
            heading: _driverPositionHeadingDegrees,
            speed: _driverPositionSpeedMps,
          ));
        }
      }

      SimpleResponseModel? simpleResponseModel =
          await ApiMethods.driverUpdateOnlineStatusApi(bodyParams: bodyParams);
      if (simpleResponseModel != null &&
          simpleResponseModel.success != null &&
          simpleResponseModel.success!) {
        print('update online status successfully completed....');
        isGoOnline.value = !isGoOnline.value;

        // Start/Stop socket location updates based on online status
        if (_isDriverOnline) {
          // Driver is now online - start emitting location
          _startLocationUpdates();
          _syncDriverLocationToServer(force: true);
          final presence = simpleResponseModel.presence;
          if (presence == null || presence.sessionId?.isNotEmpty != true) {
            isGoOnline.value = true;
            CommonWidgets.snackBarView(
              title: 'The server did not start an online presence session.',
            );
            return;
          }
          _startPresenceHeartbeatTimer(presence.heartbeatIntervalMs);
          await _startAndroidPresenceService(presence);
        } else {
          // Driver is now offline - stop emitting location
          _stopLocationUpdates();
          _stopPresenceHeartbeatTimer();
          await DriverOnlineService.stop();
        }
      } else {
        CommonWidgets.snackBarView(
          title: driverOnlineFailureMessage(simpleResponseModel),
        );
      }
    } catch (error) {
      debugPrint('Go Online failed: $error');
      CommonWidgets.snackBarView(
        title: kIsWeb
            ? 'Drewel could not read your browser location. Allow precise location for this site, then try again.'
            : 'Unable to get a fresh GPS location. Please try again.',
      );
    } finally {
      showLoading.value = false;
    }
  }

  Future<void> callingGetDriverDetails() async {
    print('start driver details.......');
    try {
      SharedPreferences pref = await SharedPreferences.getInstance();
      String driverId = pref.getString(ApiKeyConstants.userId) ?? '';
      AddDriverDetailModel? loginModel =
          await ApiMethods.getDriverDetailsApi(driverId: driverId);
      if (loginModel != null &&
          loginModel.success != null &&
          loginModel.success! &&
          loginModel.driver != null) {
        print('get driver details successfully completed....');
        userData.value = {
          ApiKeyConstants.phone: loginModel.driver!.phone ?? '',
          ApiKeyConstants.countryCode: loginModel.driver!.countryCode ?? '',
          ApiKeyConstants.profileImage:
              loginModel.driver!.profileImageUrl ?? '',
          ApiKeyConstants.fullName: loginModel.driver!.fullName ?? '',
          ApiKeyConstants.type: ApiKeyConstants.driver,
        };

        // Store driver info for socket location updates
        _driverId = driverId;
        _driverName = loginModel.driver!.fullName ?? '';
        _vehicleType = loginModel.driver!.vehicleType ?? '';
        _city = loginModel.driver!.city ?? '';

        if (loginModel.driver!.isOnline ?? false) {
          isGoOnline.value = false;
          // Driver is online - start location updates
          _startLocationUpdates();
          _syncDriverLocationToServer(force: true);
          unawaited(_resumeOnlinePresence());
        } else {
          isGoOnline.value = true;
          unawaited(DriverOnlineService.stop());
        }
        if (!(loginModel.driver!.isApproved ?? false)) {
          pref.clear();
          Get.offNamedUntil(Routes.SPLASH, (routes) => false);
        }
      } else {
        CommonWidgets.snackBarView(
            title: loginModel?.message ?? 'Get driver data Failed ...');
      }
    } catch (e) {
      CommonWidgets.snackBarView(title: 'Somethings wrong...');
    }
  }
}
