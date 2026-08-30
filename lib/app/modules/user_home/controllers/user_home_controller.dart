import 'package:drewel/app/data/apis/api_models/get_all_driver_model.dart';
import 'package:drewel/app/data/apis/api_models/get_login_model.dart';
import 'package:drewel/common/local_data.dart';
import 'package:drewel/common/gps_fix.dart';
import 'package:drewel/common/socket_services.dart';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;
import 'package:http/http.dart' as http;
import 'package:geolocator/geolocator.dart';
import 'package:get/get.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:google_places_flutter/model/prediction.dart';
import 'package:responsive_sizer/responsive_sizer.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:ui' as ui;
import 'dart:io';
import '../../../../common/colors.dart';
import '../../../../common/auth_session_manager.dart';
import '../../../../common/common_widgets.dart';
import '../../../../common/vehicle_assets.dart';
import '../../../../common/text_styles.dart';
import '../../../data/apis/api_constants/api_key_constants.dart';
import '../../../data/apis/api_methods/api_methods.dart';
import '../../../data/constants/icons_constant.dart';
import '../../../data/constants/string_constants.dart';
import '../../../data/apis/api_constants/api_url_constants.dart';
import '../../../data/config/app_config.dart';
import '../../communication/controllers/call_state_controller.dart';
import '../utils/marketplace_driver_sort.dart';

enum DriverDiscoveryOutcome {
  success,
  locationRequired,
  outsideServiceArea,
  failed,
}

class UserHomeController extends GetxController
    with GetSingleTickerProviderStateMixin, WidgetsBindingObserver {
  final RxMap<String, String> userData = <String, String>{}.obs;
  final leftPosition = 0.0.obs;

  /// Google Places autocomplete suggestions
  final RxList<Prediction> placeSuggestions = <Prediction>[].obs;
  Timer? _placesDebounce;
  int _placeSearchRequestId = 0;

  /// Location search UX state
  final isPlacesLoading = false.obs;
  final placesSearchError = ''.obs;
  final isFetchingUserLocation = false.obs;
  static const int _placeSearchDebounceMs = 400;

  // Reverse geocoding (map tap / marker drag) is user-gesture-driven and can
  // fire many times in quick succession, so it needs the same debounce +
  // stale-response guard as forward search to avoid hammering the Geocoding API.
  Timer? _reverseGeocodeDebounce;
  int _reverseGeocodeRequestId = 0;
  static const int _reverseGeocodeDebounceMs = 500;
  static const Duration _placesHttpTimeout = Duration(seconds: 10);

  // Bumped on high-frequency, map-only changes (live driver marker
  // animation) so the search bar / bottom sheet don't rebuild on every
  // animation tick; `count` still covers everything else.
  final RxInt mapRevision = 0.obs;

  // Gesture-vs-programmatic camera tracking: `onCameraMoveStarted` fires for
  // both a finger drag and a code-driven `animateCamera`, so a call made
  // through `_animateCamera` marks itself programmatic first to avoid being
  // misread as the user grabbing the map.
  bool isUserGestureActive = false;
  int _programmaticCameraMoveDepth = 0;

  Timer? _driverPollingTimer;
  StreamSubscription<Position>? _userPositionSubscription;
  Timer? _userLocationFreshnessTimer;
  DateTime? _lastUserPositionRecordedAt;
  late AnimationController animationController;
  late Animation<double> animation;
  final RxInt vehicleIndex = 0.obs;
  final List<String> vehicleIcons = [
    IconConstants.icSmallPickUp,
    IconConstants.icMoving,
    IconConstants.icRecovery,
    IconConstants.icGasTruck,
  ];
  final sheetSize = 0.3.obs;
  final double minSheetSize = 0.2;
  final double maxSheetSize = 0.6;
  final double initialSheetSize = 0.3;
  final double emptyMinSheetSize = 0.18;
  final double emptyMaxSheetSize = 0.26;
  final double emptyInitialSheetSize = 0.22;
  final GlobalKey<ScaffoldState> scaffoldKey = GlobalKey<ScaffoldState>();
  TextEditingController locationController = TextEditingController();
  FocusNode locationFocusNode = FocusNode();
  final lat = 23.4241.obs;
  final lon = 53.8478.obs;
  LatLng mapPosition = const LatLng(23.4241, 53.8478);
  GoogleMapController? xController;
  bool _isMapReady = false;

  final count = 0.obs;
  int selectIndex = -1;
  String? selectedDriverId;
  Set<Marker> markers = {};
  Set<Polyline> polylines = {}; // For drawing lines between user and driver
  BitmapDescriptor customMarker = BitmapDescriptor.defaultMarker;
  BitmapDescriptor driverMarker = BitmapDescriptor.defaultMarker;
  BitmapDescriptor selectedDriverMarker = BitmapDescriptor.defaultMarker;
  BitmapDescriptor userLocationMarker = BitmapDescriptor.defaultMarker;
  final Map<String, BitmapDescriptor> _vehicleMarkerCache =
      <String, BitmapDescriptor>{};
  final Map<String, BitmapDescriptor> _selectedVehicleMarkerCache =
      <String, BitmapDescriptor>{};
  final Map<String, Timer> _vehicleMarkerAnimationTimers =
      <String, Timer>{};

  // Socket service for real-time driver location updates
  final SocketService socketService = SocketService();
  String? _currentCity;
  bool _isRefreshingDriverList = false;
  bool _isControllerClosed = false;
  bool _areViewResourcesDisposed = false;
  bool get _canUpdateView => !_isControllerClosed && !_areViewResourcesDisposed;
  static const int _driverPollingIntervalSeconds = 5;
  static const int _maxDriverPollingIntervalSeconds = 60;
  static const Duration _maxDriverLocationAge = Duration(seconds: 45);
  static const Duration _maxUserLocationAge = Duration(seconds: 60);
  static const Duration _maxGpsFutureSkew = Duration(seconds: 30);
  int _consecutiveDriverRefreshFailures = 0;

  // Loading state for drivers
  final isDriversLoading = true.obs;
  final isDriverServiceUnavailable = false.obs;
  final driverServiceMessage = ''.obs;

  // User location state
  final isUserLocationLoaded = false.obs;
  final userLat = 0.0.obs;
  final userLng = 0.0.obs;

  // Selected/Searched location (draggable marker position)
  final selectedLocationLat = 0.0.obs;
  final selectedLocationLng = 0.0.obs;
  final isSelectedLocationSet = false.obs;
  final selectedLocationAddress = ''.obs;

  // Selected driver distance (-1 means not calculated yet)
  final selectedDriverDistance = (-1.0).obs;

  // All drivers from API (master list)
  List<Drivers> allDriversList = [];
  // Filtered drivers visible in current map bounds
  List<Drivers> visibleDriversList = [];
  // Current map visible bounds
  LatLngBounds? currentVisibleBounds;
  // Current map center for distance calculation
  LatLng currentMapCenter = const LatLng(23.4241, 53.8478);

  // Selected vehicle type for filtering
  String get selectedVehicleType =>
      parameter[ApiKeyConstants.vehicleType] ?? '';
  String get selectedVehicleTypeKey =>
      canonicalVehicleTypeKey(selectedVehicleType);
  String get selectedMarketplaceCity => AppConfig.tunisiaTestMode
      ? AppConfig.marketplaceRegionLabel
      : parameter[ApiKeyConstants.city] ?? '';
  // void loadCustomMarker() async {
  //   customMarker = await BitmapDescriptor.fromAssetImage(
  //     const ImageConfiguration(size: Size(35, 35)),
  //     IconConstants.icLocation,
  //   );
  //   increment(); // Trigger a rebuild to apply the custom marker.
  // }
  Future<BitmapDescriptor> getResizedMarker(String assetPath,
      {int width = 80, Color? tintColor}) async {
    final ByteData data = await rootBundle.load(assetPath);
    final codec = await ui.instantiateImageCodec(
      data.buffer.asUint8List(),
      targetWidth: width, // adjust width for desired size
    );
    final frameInfo = await codec.getNextFrame();
    final ui.Image resizedFrame = frameInfo.image;

    if (tintColor == null) {
      final resizedImage =
          await resizedFrame.toByteData(format: ui.ImageByteFormat.png);
      return BitmapDescriptor.fromBytes(resizedImage!.buffer.asUint8List());
    }

    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder);
    final paint = ui.Paint()
      ..colorFilter = ui.ColorFilter.mode(tintColor, ui.BlendMode.srcIn);
    final rect = Rect.fromLTWH(
      0,
      0,
      resizedFrame.width.toDouble(),
      resizedFrame.height.toDouble(),
    );

    canvas.drawImageRect(resizedFrame, rect, rect, paint);

    final tintedImage = await recorder
        .endRecording()
        .toImage(resizedFrame.width, resizedFrame.height);
    final tintedBytes =
        await tintedImage.toByteData(format: ui.ImageByteFormat.png);
    return BitmapDescriptor.fromBytes(tintedBytes!.buffer.asUint8List());
  }

  void loadCustomMarker() async {
    if (!kIsWeb && Platform.isIOS) {
      customMarker = await getResizedMarker(
        IconConstants.icLocation,
        width: 100, // smaller size for iOS
      );
      // Load driver car marker
      driverMarker = await getResizedMarker(
        IconConstants.icDeliveryTruckInactive,
        width: 100,
      );
      selectedDriverMarker = await getResizedMarker(
        IconConstants.icDeliveryTruck,
        width: 130,
      );
      // Load user location marker
      userLocationMarker = await getResizedMarker(
        IconConstants.icMyLocation,
        width: 100,
        tintColor: primaryColor,
      );
    } else {
      customMarker = await BitmapDescriptor.fromAssetImage(
        const ImageConfiguration(size: Size(35, 35)),
        IconConstants.icLocation,
      );
      // Load driver car marker
      driverMarker = await getResizedMarker(
        IconConstants.icDeliveryTruckInactive,
        width: 100,
      );
      selectedDriverMarker = await getResizedMarker(
        IconConstants.icDeliveryTruck,
        width: 130,
      );
      // Load user location marker
      userLocationMarker = await getResizedMarker(
        IconConstants.icMyLocation,
        width: 100,
        tintColor: primaryColor,
      );
    }
    if (!_canUpdateView) return;
    increment(); // Trigger a rebuild
  }

  Future<BitmapDescriptor> _loadMarkerBitmap(
    String assetPath, {
    int width = 96,
  }) async {
    final ByteData data = await rootBundle.load(assetPath);
    final ui.Codec codec = await ui.instantiateImageCodec(
      data.buffer.asUint8List(),
      targetWidth: width,
    );
    final ui.FrameInfo frame = await codec.getNextFrame();
    final ByteData? bytes =
        await frame.image.toByteData(format: ui.ImageByteFormat.png);
    if (bytes == null) return BitmapDescriptor.defaultMarker;
    return BitmapDescriptor.fromBytes(bytes.buffer.asUint8List());
  }

  Future<void> _preloadVehicleMarkerIcons() async {
    final List<String> assetPaths = <String>{
      ...allDriversList.map((Drivers driver) => vehicleMarkerAssetPath(
            driver.vehicleTypeKey ?? driver.vehicleType,
          )),
      ...visibleDriversList.map((Drivers driver) => vehicleMarkerAssetPath(
            driver.vehicleTypeKey ?? driver.vehicleType,
          )),
    }.toList(growable: false);

    for (final String assetPath in assetPaths) {
      if (_vehicleMarkerCache.containsKey(assetPath)) continue;
      try {
        _vehicleMarkerCache[assetPath] = await _loadMarkerBitmap(assetPath);
        _selectedVehicleMarkerCache[assetPath] =
            await _loadMarkerBitmap(assetPath, width: 118);
      } catch (error) {
        debugPrint('Failed to preload vehicle marker $assetPath: $error');
      }
    }
    if (_canUpdateView) {
      updateDriverMarkers();
      increment();
    }
  }

  BitmapDescriptor _vehicleMarkerIconSync(
    Drivers driver, {
    required bool selected,
  }) {
    final String assetPath =
        vehicleMarkerAssetPath(driver.vehicleTypeKey ?? driver.vehicleType);
    final BitmapDescriptor? cached = (selected
            ? _selectedVehicleMarkerCache[assetPath]
            : _vehicleMarkerCache[assetPath]);
    return cached ?? (selected ? selectedDriverMarker : driverMarker);
  }

  double _driverMarkerRotation(Drivers driver) {
    final double? heading = driver.heading;
    if (heading == null || !heading.isFinite) return 0;
    // The existing vehicle assets are drawn front-facing in the marker sheet.
    return heading % 360;
  }

  double _shortestAngleDelta(double from, double to) {
    final double normalizedFrom = from % 360;
    final double normalizedTo = to % 360;
    double delta = normalizedTo - normalizedFrom;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    return delta;
  }

  void _animateDriverMarkerTransition({
    required String driverId,
    required LatLng from,
    required LatLng to,
    double? fromHeading,
    double? toHeading,
  }) {
    _vehicleMarkerAnimationTimers[driverId]?.cancel();
    final int index = allDriversList.indexWhere((Drivers d) => d.sId == driverId);
    if (index < 0) return;

    const Duration duration = Duration(milliseconds: 900);
    const int steps = 18;
    final Duration stepDuration =
        Duration(milliseconds: duration.inMilliseconds ~/ steps);
    int step = 0;
    _vehicleMarkerAnimationTimers[driverId] =
        Timer.periodic(stepDuration, (Timer timer) {
      if (!_canUpdateView) {
        timer.cancel();
        _vehicleMarkerAnimationTimers.remove(driverId);
        return;
      }

      step += 1;
      final double t = step / steps;
      final double eased = t * t * (3 - 2 * t);
      final double latValue =
          from.latitude + (to.latitude - from.latitude) * eased;
      final double longValue =
          from.longitude + (to.longitude - from.longitude) * eased;
      final double headingValue = (fromHeading != null && toHeading != null)
          ? (fromHeading + _shortestAngleDelta(fromHeading, toHeading) * eased)
          : (toHeading ?? fromHeading ?? 0);

      allDriversList[index].lat = latValue;
      allDriversList[index].long = longValue;
      if (headingValue.isFinite) allDriversList[index].heading = headingValue;

      if (step >= steps) {
        timer.cancel();
        _vehicleMarkerAnimationTimers.remove(driverId);
        allDriversList[index].lat = to.latitude;
        allDriversList[index].long = to.longitude;
        if (toHeading != null && toHeading.isFinite) {
          allDriversList[index].heading = toHeading;
        }
        // Final settle also re-sorts/re-filters the list, so it needs the
        // full `count` rebuild (search bar / bottom sheet included).
        filterDriversByVisibleBounds();
      } else {
        // Mid-animation ticks only move a marker; bump the map-scoped
        // revision instead of `count` so the search bar and driver list
        // don't rebuild ~18 times per moving driver.
        updateDriverMarkers();
        _bumpMapRevision();
      }
    });
  }

  void _bumpMapRevision() {
    if (!_canUpdateView) return;
    mapRevision.value++;
  }

  void _clearVehicleMarkerAnimations() {
    for (final Timer timer in _vehicleMarkerAnimationTimers.values) {
      timer.cancel();
    }
    _vehicleMarkerAnimationTimers.clear();
  }

  /// Get user's current location as LatLng
  LatLng get userLocation => LatLng(userLat.value, userLng.value);

  /// Get selected/searched location as LatLng (used for driver distance calculation)
  LatLng get selectedLocation =>
      LatLng(selectedLocationLat.value, selectedLocationLng.value);

  /// Get the location to use for distance calculations (selected location if set, else user GPS)
  LatLng get referenceLocation {
    if (isSelectedLocationSet.value) {
      return selectedLocation;
    } else if (isUserLocationLoaded.value) {
      return userLocation;
    }
    return currentMapCenter;
  }

  /// Check if we have a valid reference location
  bool get hasReferenceLocation =>
      isSelectedLocationSet.value || isUserLocationLoaded.value;

  /// Go to user's current location on map
  void goToUserLocation() {
    if (isUserLocationLoaded.value) {
      mapPosition = userLocation;
      unawaited(_animateCamera(
        CameraUpdate.newCameraPosition(
          CameraPosition(
            target: userLocation,
            zoom: 14,
          ),
        ),
      ));
    }
    increment();
  }

  /// Locate the user for the crosshair button: fetch GPS when missing and
  /// centre the map on the obtained position. Permission-denied is handled by
  /// the existing permission dialog; an unavailable GPS fix gets a toast.
  Future<void> handleGoToUserLocation() async {
    if (isUserLocationLoaded.value) {
      _centerOnUserLocation();
      return;
    }
    if (isFetchingUserLocation.value) return;
    isFetchingUserLocation.value = true;
    increment();
    try {
      await getCurrentLocation(showPermissionDialog: true);
    } finally {
      isFetchingUserLocation.value = false;
      if (_canUpdateView) increment();
    }
    if (!_canUpdateView) return;
    if (isUserLocationLoaded.value) {
      _centerOnUserLocation();
      return;
    }
    final LocationPermission permission = await Geolocator.checkPermission();
    if (!_canUpdateView) return;
    if (permission == LocationPermission.whileInUse ||
        permission == LocationPermission.always) {
      CommonWidgets.snackBarView(
        title: 'Unable to get your location. Check GPS and try again.',
        success: false,
      );
    }
  }

  void _centerOnUserLocation() {
    if (!isUserLocationLoaded.value) return;
    mapPosition = userLocation;
    unawaited(_animateCamera(
      CameraUpdate.newCameraPosition(
        CameraPosition(target: userLocation, zoom: 14),
      ),
    ));
    increment();
  }

  Future<void> onMapCreated(GoogleMapController mapController) async {
    _isMapReady = false;
    xController = mapController;
    currentVisibleBounds = null;

    // On Flutter web the Dart controller can be delivered before the platform
    // view is registered in google_maps_flutter_web. Waiting for the frame that
    // built the view prevents operations against an unregistered map id.
    await WidgetsBinding.instance.endOfFrame;
    if (!_canUpdateView || xController != mapController) return;

    _isMapReady = true;
    await onCameraIdle();
  }

  Future<void> _animateCamera(CameraUpdate update) async {
    final GoogleMapController? mapController = xController;
    if (!_isMapReady || !_canUpdateView || mapController == null) return;

    // Mark this move as programmatic so the resulting onCameraMoveStarted
    // callback isn't mistaken for the user grabbing the map.
    _programmaticCameraMoveDepth++;
    try {
      await mapController.animateCamera(update);
    } catch (error) {
      // The web platform view may have been removed while an async action was
      // queued. A future onMapCreated callback will register the new map.
      debugPrint('Skipped camera update for an unavailable map: $error');
    } finally {
      _programmaticCameraMoveDepth =
          math.max(0, _programmaticCameraMoveDepth - 1);
    }
  }

  /// Called when the map reports the camera starting to move, from either a
  /// user gesture or a programmatic `animateCamera` call. Only a real user
  /// drag/zoom should suppress auto-recentering — a programmatic move must
  /// not be misread as the user taking over the map.
  void onCameraMoveStarted() {
    isUserGestureActive = _programmaticCameraMoveDepth == 0;
  }

  /// Set selected location (from search or marker drag)
  void setSelectedLocation(LatLng location) {
    selectedLocationLat.value = location.latitude;
    selectedLocationLng.value = location.longitude;
    isSelectedLocationSet.value = true;

    // Update markers to show the selected location marker
    updateDriverMarkers();

    // Re-filter and sort drivers based on new selected location
    filterDriversByVisibleBounds();
    unawaited(_refreshDiscoveryForReferenceLocation(showLoader: true));

    // Get address for the location (debounced: map taps/drags can repeat fast)
    _scheduleReverseGeocode(location);

    increment();
  }

  /// Debounce reverse geocoding so rapid map taps/drags (e.g. dragging the
  /// selected-location marker) don't fire a Geocoding request per frame.
  void _scheduleReverseGeocode(LatLng location) {
    _reverseGeocodeDebounce?.cancel();
    _reverseGeocodeRequestId++;
    final int requestId = _reverseGeocodeRequestId;
    _reverseGeocodeDebounce = Timer(
      const Duration(milliseconds: _reverseGeocodeDebounceMs),
      () {
        if (!_canUpdateView || requestId != _reverseGeocodeRequestId) return;
        getAddressFromCoordinates(location, requestId: requestId);
      },
    );
  }

  /// Clear selected location and use GPS location
  void clearSelectedLocation() {
    isSelectedLocationSet.value = false;
    selectedLocationAddress.value = '';
    updateDriverMarkers();
    filterDriversByVisibleBounds();
    unawaited(_refreshDiscoveryForReferenceLocation(showLoader: true));
    increment();
  }

  /// Get address from coordinates using Google Geocoding API (reverse geocoding)
  Future<void> getAddressFromCoordinates(
    LatLng location, {
    int? requestId,
  }) async {
    final int activeRequestId = requestId ?? _reverseGeocodeRequestId;
    final Uri uri = Uri.parse(
      'https://maps.googleapis.com/maps/api/geocode/json?'
      'latlng=${location.latitude},${location.longitude}'
      '&key=${ApiKeyConstants.googleMapKey}',
    );

    final http.Response? response = await _getWithTimeout(uri);
    if (!_canUpdateView || activeRequestId != _reverseGeocodeRequestId) return;

    if (response == null) {
      selectedLocationAddress.value = 'Location selected';
    } else if (response.statusCode == 200) {
      final data = json.decode(response.body);
      if (data['status'] == 'OK' && data['results'].isNotEmpty) {
        String address = data['results'][0]['formatted_address'];
        selectedLocationAddress.value = address;
        locationController.text = address;
      } else {
        debugPrint('Geocoding error: ${data['status']}');
        selectedLocationAddress.value = 'Location selected';
      }
    } else {
      debugPrint('Geocoding HTTP error: ${response.statusCode}');
      selectedLocationAddress.value = 'Location selected';
    }
    increment();
  }

  /// Shared GET helper for Places/Geocoding HTTP calls: applies a timeout so
  /// a slow/unreachable Google endpoint can't hang search or reverse-geocode
  /// indefinitely, and reports a user-facing message distinguishing timeout
  /// vs network vs generic failure instead of one generic error for everything.
  Future<http.Response?> _getWithTimeout(
    Uri uri, {
    void Function(String message)? onError,
  }) async {
    try {
      return await http.get(uri).timeout(_placesHttpTimeout);
    } on TimeoutException {
      debugPrint('Places/Geocoding request timed out: $uri');
      onError?.call('Search timed out. Check your connection and try again.');
    } on SocketException catch (error) {
      debugPrint('Places/Geocoding network error: $error');
      onError?.call('No internet connection. Check your network and try again.');
    } catch (error) {
      debugPrint('Places/Geocoding request failed: $error');
      onError?.call('Unable to find locations. Try again.');
    }
    return null;
  }

  /// Handle marker drag end
  void onMarkerDragEnd(LatLng newPosition) {
    setSelectedLocation(newPosition);
  }

  /// Get distance from reference location (selected or GPS) to a driver
  double getDistanceFromUser(Drivers driver) {
    if (!hasReferenceLocation) return double.infinity;
    if (driver.lat == null || driver.long == null) return double.infinity;

    LatLng refLoc = referenceLocation;
    return calculateDistance(
      refLoc.latitude,
      refLoc.longitude,
      double.tryParse(driver.lat.toString()) ?? 0,
      double.tryParse(driver.long.toString()) ?? 0,
    );
  }

  List<Drivers> driversList = [];
  Map<String, String?> parameter = Get.parameters;

  /// Calculate distance between two points in kilometers using Haversine formula
  double calculateDistance(double lat1, double lon1, double lat2, double lon2) {
    const double earthRadius = 6371; // Earth's radius in kilometers

    double dLat = _degreesToRadians(lat2 - lat1);
    double dLon = _degreesToRadians(lon2 - lon1);

    double a = math.sin(dLat / 2) * math.sin(dLat / 2) +
        math.cos(_degreesToRadians(lat1)) *
            math.cos(_degreesToRadians(lat2)) *
            math.sin(dLon / 2) *
            math.sin(dLon / 2);

    double c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
    return earthRadius * c;
  }

  double _degreesToRadians(double degrees) {
    return degrees * (math.pi / 180);
  }

  LatLng get _selectedCityCenter {
    final List<Map<String, dynamic>> cities = LocalData().cityLatLongList;
    final int requestedIndex = int.tryParse(
          parameter[ApiKeyConstants.index] ?? '0',
        ) ??
        0;
    final int safeIndex = requestedIndex.clamp(0, cities.length - 1);
    return LatLng(
      (cities[safeIndex]['lat'] as num).toDouble(),
      (cities[safeIndex]['lon'] as num).toDouble(),
    );
  }

  LatLng? _driverPosition(Drivers driver) {
    final double? latitude = double.tryParse(driver.lat?.toString() ?? '');
    final double? longitude = double.tryParse(driver.long?.toString() ?? '');
    if (latitude == null ||
        longitude == null ||
        !latitude.isFinite ||
        !longitude.isFinite ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180 ||
        (latitude == 0 && longitude == 0)) {
      return null;
    }
    return LatLng(latitude, longitude);
  }

  bool _isDriverEligibleForSelectedCity(
    Drivers driver, {
    DateTime? now,
  }) {
    return isMarketplaceServiceAreaAllowed(driver.currentServiceArea) &&
        driver.isOnlineAndAvailable &&
        driver.hasFreshLocation(
          now: now ?? DateTime.now(),
          maxAge: _maxDriverLocationAge,
        ) &&
        _driverPosition(driver) != null;
  }

  double _updateDriverDistance(Drivers driver, LatLng origin) {
    final LatLng position = _driverPosition(driver)!;
    final double distance = calculateDistance(
      origin.latitude,
      origin.longitude,
      position.latitude,
      position.longitude,
    );
    driver.distanceKm = distance;
    return distance;
  }

  void _prepareVehicleDiscoveryResults(List<Drivers> drivers) {
    final LatLng origin =
        hasReferenceLocation ? referenceLocation : _selectedCityCenter;
    final DateTime now = DateTime.now();
    final List<Drivers> validDrivers = drivers
        .where((Drivers driver) =>
            _isDriverEligibleForSelectedCity(driver, now: now))
        .toList();
    for (final Drivers driver in validDrivers) {
      _updateDriverDistance(driver, origin);
    }
    validDrivers.sort(compareMarketplaceDriversNearestFirst);

    allDriversList = validDrivers;
  }

  void _resetSelectedDriver() {
    selectIndex = -1;
    selectedDriverId = null;
    selectedDriverDistance.value = -1.0;
  }

  void _updateSelectedDriverDistance() {
    selectedDriverDistance.value = -1.0;

    if (!hasReferenceLocation ||
        selectIndex < 0 ||
        selectIndex >= driversList.length) {
      return;
    }

    Drivers driver = driversList[selectIndex];
    if (driver.lat == null || driver.long == null) {
      return;
    }

    double driverLat = double.tryParse(driver.lat.toString()) ?? 0;
    double driverLng = double.tryParse(driver.long.toString()) ?? 0;

    LatLng refLoc = referenceLocation;
    double distance = calculateDistance(
      refLoc.latitude,
      refLoc.longitude,
      driverLat,
      driverLng,
    );

    if (distance > 0 && distance != double.infinity) {
      selectedDriverDistance.value = distance;
    }
  }

  void _syncSelectedDriverSelection() {
    if (driversList.isEmpty) {
      _resetSelectedDriver();
      return;
    }

    int matchedIndex = -1;
    if (selectedDriverId != null && selectedDriverId!.isNotEmpty) {
      matchedIndex =
          driversList.indexWhere((driver) => driver.sId == selectedDriverId);
    }

    if (matchedIndex == -1) {
      matchedIndex = 0;
      selectedDriverId = driversList.first.sId;
    }

    selectIndex = matchedIndex;
    _updateSelectedDriverDistance();
  }

  void _syncDriverLoaderAnimation() {
    if (!_canUpdateView) return;
    if (driversList.isEmpty) {
      if (!animationController.isAnimating) {
        animationController.forward(from: 0.0);
      }
      return;
    }

    if (animationController.isAnimating) {
      animationController.stop();
    }
  }

  void filterDriversByVisibleBounds() {
    final DateTime now = DateTime.now();
    // Search results are city-scoped, not viewport-scoped. Panning the map must
    // not allow a foreign provider into the list or hide the nearest provider.
    visibleDriversList = allDriversList.where((driver) {
      if (!_isDriverEligibleForSelectedCity(driver, now: now)) return false;

      // Filter by vehicle type if selected
      if (selectedVehicleTypeKey.isNotEmpty) {
        final String driverVehicleType =
            canonicalVehicleTypeKey(driver.vehicleTypeKey ?? driver.vehicleType);
        if (driverVehicleType.isEmpty ||
            driverVehicleType != selectedVehicleTypeKey) {
          return false;
        }
      }

      return true;
    }).toList();

    // The explicitly selected place is the discovery origin. Device GPS is
    // used only when the user has not selected a place.
    final LatLng sortFromPoint =
        hasReferenceLocation ? referenceLocation : _selectedCityCenter;

    for (final Drivers driver in visibleDriversList) {
      _updateDriverDistance(driver, sortFromPoint);
    }

    visibleDriversList.sort(compareMarketplaceDriversNearestFirst);

    // Update the driversList that's used by the UI
    driversList = visibleDriversList;
    _syncSelectedDriverSelection();

    // Update markers on map
    updateDriverMarkers();
    _syncDriverLoaderAnimation();
    syncBottomSheetSize();

    print(
        'Visible drivers: ${visibleDriversList.length} out of ${allDriversList.length} (filter: "$selectedVehicleTypeKey")');
    increment();
  }

  /// Update markers on the map for visible drivers
  void updateDriverMarkers() {
    markers.clear();

    // Add selected location marker (draggable) if set
    if (isSelectedLocationSet.value) {
      markers.add(
        Marker(
          markerId: const MarkerId('selected_location'),
          icon: customMarker,
          position: selectedLocation,
          draggable: true,
          onDragEnd: (newPosition) {
            onMarkerDragEnd(newPosition);
          },
          infoWindow: InfoWindow(
            title: 'Your Selected Location',
            snippet: selectedLocationAddress.value.isNotEmpty
                ? '${selectedLocationAddress.value.substring(0, selectedLocationAddress.value.length > 50 ? 50 : selectedLocationAddress.value.length)}...'
                : 'Drag to move',
          ),
          zIndex: 3, // Show above everything
        ),
      );
    }
    // Add user GPS location marker if available (only if not using selected location)
    else if (isUserLocationLoaded.value) {
      markers.add(
        Marker(
          markerId: const MarkerId('user_location'),
          icon: userLocationMarker,
          position: userLocation,
          infoWindow: const InfoWindow(
            title: 'Your GPS Location',
            snippet: 'Current Position',
          ),
          zIndex: 2, // Show above driver markers
        ),
      );
    }

    // Add driver markers
    for (int i = 0; i < visibleDriversList.length; i++) {
      Drivers driver = visibleDriversList[i];
      if (driver.lat != null && driver.long != null) {
        final bool selected = selectIndex == i;
        markers.add(
          Marker(
            // Keep map identity tied to the driver rather than the current
            // sorted-list index, which changes as live GPS positions move.
            markerId: MarkerId(
              'driver_${(driver.sId ?? '').trim().isNotEmpty ? driver.sId!.trim() : (driver.fullName ?? 'unknown').trim()}',
            ),
            icon: _vehicleMarkerIconSync(driver, selected: selected),
            position: LatLng(
              double.tryParse(driver.lat.toString()) ?? 0,
              double.tryParse(driver.long.toString()) ?? 0,
            ),
            flat: true,
            rotation: _driverMarkerRotation(driver),
            onTap: () {
              clickOnDriverIndex(i);
            },
            // Add info window with driver name
            infoWindow: InfoWindow(
              title: driver.fullName ?? 'Driver',
              snippet: vehicleTypeDisplayLabel(driver.vehicleTypeKey ?? driver.vehicleType),
            ),
            zIndex: selected ? 4 : 1,
          ),
        );
      }
    }
  }

  /// Called when map camera moves (zoom/pan)
  Future<void> onCameraMove(CameraPosition position) async {
    currentMapCenter = position.target;
  }

  void onAlternativeMapMove(LatLng center) {
    currentMapCenter = center;
  }

  /// Called when camera movement is idle (stopped moving)
  Future<void> onCameraIdle() async {
    isUserGestureActive = false;
    final GoogleMapController? mapController = xController;
    if (!_isMapReady || !_canUpdateView || mapController == null) return;

    try {
      final LatLngBounds visibleBounds = await mapController.getVisibleRegion();
      if (!_isMapReady || !_canUpdateView || xController != mapController) {
        return;
      }
      currentVisibleBounds = visibleBounds;
    } catch (error) {
      debugPrint('Skipped bounds update for an unavailable map: $error');
      return;
    }

    // Filter drivers based on new visible bounds
    filterDriversByVisibleBounds();
  }

  @override
  void onInit() {
    super.onInit();
    Get.find<CallStateController>().refreshActiveRide();
    WidgetsBinding.instance.addObserver(this);
    animationController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    );
    animation = Tween<double>(begin: 0.0, end: 1.0).animate(animationController)
      ..addStatusListener((status) {
        if (status == AnimationStatus.completed) {
          vehicleIndex.value = (vehicleIndex.value + 1) % vehicleIcons.length;
          animationController.reset();
          animationController.forward();
        }
      });

    _syncDriverLoaderAnimation();
    loadCustomMarker();
    unawaited(_preloadVehicleMarkerIcons());
    callingGetUserDetails();
    // WidgetsBinding.instance.addPostFrameCallback((_) {
    //   leftPosition.value = MediaQuery.of(Get.context!).size.width - 100;
    //   increment();
    // });
    final LocalData localData = LocalData();
    final int requestedIndex = int.tryParse(
          parameter[ApiKeyConstants.index] ?? '',
        ) ??
        0;
    final int safeIndex = AppConfig.tunisiaTestMode
        ? defaultMarketplaceCityIndex(localData.cityLatLongList)
        : requestedIndex.clamp(0, localData.cityLatLongList.length - 1);
    final Map<String, dynamic> initialCity =
        localData.cityLatLongList[safeIndex];
    final LatLng initialCityCenter = LatLng(
      (initialCity['lat'] as num).toDouble(),
      (initialCity['lon'] as num).toDouble(),
    );
    mapPosition = initialCityCenter;
    currentMapCenter = initialCityCenter;
    if (shouldSeedCityCenterAsDiscoveryOrigin()) {
      setSelectedCityLocation(initialCityCenter, initialCity['city'] as String);
    } else {
      // Tunisia is an isolated, account-allowlisted QA marketplace. A stale
      // UAE route must never become its discovery origin; live GPS selects the
      // backend service area and nearest providers.
      parameter[ApiKeyConstants.index] = safeIndex.toString();
      parameter[ApiKeyConstants.city] = AppConfig.marketplaceRegionLabel;
      locationController.text = 'Current location in Tunisia';
    }

    unawaited(_initializeDiscovery());
  }

  Future<void> _initializeDiscovery() async {
    if (!hasReferenceLocation) {
      final bool hasLocation = await checkPermission();
      if (!_canUpdateView) return;
      if (!hasLocation) {
        _setLocationRequiredState();
        return;
      }
    }
    final DriverDiscoveryOutcome outcome = await callingGetAllDriverListApi();
    if (!_canUpdateView) return;
    if (outcome != DriverDiscoveryOutcome.success) return;
    _startDriverPolling();
    _startUserLocationTracking();
    await _initSocket();
  }

  @override
  void onClose() {
    _isControllerClosed = true;
    _isMapReady = false;
    xController = null;
    currentVisibleBounds = null;
    WidgetsBinding.instance.removeObserver(this);
    _placesDebounce?.cancel();
    _reverseGeocodeDebounce?.cancel();
    if (!_areViewResourcesDisposed) {
      animationController.stop();
    }
    _stopDriverPolling();
    _stopUserLocationTracking();
    _disconnectSocket();
    _clearVehicleMarkerAnimations();
    isUserLocationLoaded.value = false;
    _lastUserPositionRecordedAt = null;
    super.onClose();
  }

  /// UI-owned resources must be released when the route's widget tree is
  /// actually unmounted, not when GetX starts removing the route controller.
  void disposeViewResources() {
    if (_areViewResourcesDisposed) return;
    _areViewResourcesDisposed = true;
    locationController.dispose();
    locationFocusNode.dispose();
    animationController.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);
    if (state == AppLifecycleState.hidden ||
        state == AppLifecycleState.paused ||
        state == AppLifecycleState.detached) {
      _stopDriverPolling();
      _stopUserLocationTracking();
      // App is in background - leave city room
      if (_currentCity != null) {
        socketService.emitLeaveCityRoom(_currentCity!);
      }
      socketService.disconnect();
    } else if (state == AppLifecycleState.resumed) {
      unawaited(_resumeDiscovery());
    }
  }

  Future<void> _resumeDiscovery() async {
    final bool hasLocation =
        await getCurrentLocation(showPermissionDialog: false);
    if (!_canUpdateView) return;
    if (!hasLocation) {
      _setLocationRequiredState();
      return;
    }
    _startDriverPolling();
    _startUserLocationTracking();
    final DriverDiscoveryOutcome outcome = await callingGetAllDriverListApi(
      showLoader: false,
      showError: false,
    );
    if (!_canUpdateView) return;
    if (outcome != DriverDiscoveryOutcome.success) return;
    await _initSocket();
  }

  void _setLocationRequiredState([String? message]) {
    _stopDriverPolling();
    _stopUserLocationTracking();
    _disconnectSocket();
    _clearVehicleMarkerAnimations();
    isDriversLoading.value = false;
    isDriverServiceUnavailable.value = true;
    driverServiceMessage.value = message ??
        'Turn on precise location to find nearby drivers in ${selectedMarketplaceCity.isEmpty ? 'your city' : selectedMarketplaceCity}.';
    allDriversList = <Drivers>[];
    visibleDriversList = <Drivers>[];
    driversList = <Drivers>[];
    _resetSelectedDriver();
    updateDriverMarkers();
    _syncDriverLoaderAnimation();
    syncBottomSheetSize();
    increment();
  }

  Future<void> retryDriverDiscovery() async {
    if (isDriversLoading.value) return;
    isDriversLoading.value = true;
    isDriverServiceUnavailable.value = false;
    driverServiceMessage.value = '';
    increment();
    await _initializeDiscovery();
  }

  void _startDriverPolling() {
    if (!_canUpdateView) return;
    _stopDriverPolling();
    final int multiplier = 1 << math.min(_consecutiveDriverRefreshFailures, 4);
    final int delaySeconds = math.min(
      _driverPollingIntervalSeconds * multiplier,
      _maxDriverPollingIntervalSeconds,
    );
    _driverPollingTimer = Timer(Duration(seconds: delaySeconds), () async {
      if (!_canUpdateView) return;
      final DriverDiscoveryOutcome outcome = await callingGetAllDriverListApi(
        showLoader: false,
        showError: false,
      );
      if (!_canUpdateView) return;
      if (outcome == DriverDiscoveryOutcome.success ||
          outcome == DriverDiscoveryOutcome.failed) {
        _startDriverPolling();
      }
    });
  }

  void _stopDriverPolling() {
    _driverPollingTimer?.cancel();
    _driverPollingTimer = null;
  }

  void _joinRealtimeTrackingRoom() {
    if (_currentCity != null && _currentCity!.isNotEmpty) {
      socketService.emitJoinCityRoom(
        _currentCity!,
        vehicleType: selectedVehicleTypeKey.isNotEmpty
            ? selectedVehicleTypeKey
            : selectedVehicleType,
        latitude: hasReferenceLocation ? referenceLocation.latitude : null,
        longitude: hasReferenceLocation ? referenceLocation.longitude : null,
        onAck: _handleDiscoveryRoomAck,
      );
      print('Joined city room: $_currentCity');
    }
    emitUserLocation();
  }

  Future<void> _refreshDiscoveryForReferenceLocation({
    bool showLoader = false,
  }) async {
    if (!hasReferenceLocation || !_canUpdateView) return;

    final DriverDiscoveryOutcome outcome = await callingGetAllDriverListApi(
      showLoader: showLoader,
      showError: false,
    );
    if (!_canUpdateView || outcome != DriverDiscoveryOutcome.success) return;

    if (socketService.isConnected) {
      _joinRealtimeTrackingRoom();
    } else {
      await _initSocket();
    }
  }

  void _handleDiscoveryRoomAck(dynamic response) {
    if (!_canUpdateView) return;
    final Map<String, dynamic>? payload = _asStringMap(response);
    if (payload?['ok'] == true || payload?['success'] == true) return;

    final String code =
        (payload?['error'] ?? payload?['code'] ?? '').toString().toUpperCase();
    if (code == 'OUTSIDE_SERVICE_AREA') {
      _setLocationRequiredState(
        'Find Now is available only inside ${AppConfig.marketplaceRegionLabel}.',
      );
    } else if (code == 'INVALID_COORDINATES' || code == 'LOCATION_REQUIRED') {
      _setLocationRequiredState(
        'A fresh precise GPS location is required to find nearby drivers.',
      );
    } else {
      _setLocationRequiredState(
        'Unable to start live driver tracking. Check location and retry.',
      );
    }
  }

  /// Initialize socket connection and listen for driver updates
  Future<void> _initSocket() async {
    SharedPreferences pref = await SharedPreferences.getInstance();
    if (!_canUpdateView) return;
    String token = pref.getString(ApiKeyConstants.token) ?? '';
    _currentCity = selectedMarketplaceCity;

    if (token.isNotEmpty) {
      // Register listeners before opening the connection so an immediate
      // authenticated INITIAL payload cannot be missed.
      socketService.onDriversNearby((data) {
        if (!_canUpdateView) return;
        _handleDriversNearbyUpdate(data);
      });
      socketService.onLocationTrackingReady(() {
        if (!_canUpdateView) return;
        print('User location tracking authenticated and ready');
        _joinRealtimeTrackingRoom();
      });
      socketService.connect(ApiUrlConstants.socketUrl, token);
      socketService.off('driver:availability');
      socketService.on('driver:availability', _handleDriverAvailability);
      socketService.onConnect(() {
        if (!_canUpdateView) return;
        print('User location socket connected');
      });
    }
  }

  void _handleDriverAvailability(dynamic data) {
    final Map<String, dynamic>? payload = _asStringMap(data);
    if (payload == null || !_canUpdateView) return;
    final String? driverId = _extractDriverId(payload);
    if (driverId == null) return;
    final String status =
        (payload['status'] ?? payload['availabilityStatus'] ?? '')
            .toString()
            .trim()
            .toLowerCase();
    final bool available = payload['isAvailable'] == true && status == 'online';
    final int index =
        allDriversList.indexWhere((Drivers driver) => driver.sId == driverId);

    if (!available) {
      _vehicleMarkerAnimationTimers.remove(driverId)?.cancel();
      allDriversList.removeWhere((Drivers driver) => driver.sId == driverId);
      if (selectedDriverId == driverId) _resetSelectedDriver();
      filterDriversByVisibleBounds();
      return;
    }

    if (index < 0) {
      // The event deliberately contains no private profile data. Refresh the
      // authenticated, privacy-safe marketplace projection to add the driver.
      callingGetAllDriverListApi(showLoader: false, showError: false);
      return;
    }
    allDriversList[index].availabilityStatus = 'online';
    allDriversList[index].isAvailable = true;
    allDriversList[index].isOnline = true;
    filterDriversByVisibleBounds();
  }

  /// Disconnect socket
  void _disconnectSocket() {
    if (_currentCity != null && _currentCity!.isNotEmpty) {
      socketService.emitLeaveCityRoom(_currentCity!);
    }
    socketService.disconnect();
  }

  Map<String, dynamic>? _asStringMap(dynamic value) {
    if (value is Map<String, dynamic>) return value;
    if (value is Map) {
      try {
        return value.map(
          (dynamic key, dynamic val) => MapEntry(key.toString(), val),
        );
      } catch (_) {
        return null;
      }
    }
    return null;
  }

  String? _extractDriverId(Map<String, dynamic> payload) {
    final dynamic candidate = payload['driverId'] ??
        payload['_id'] ??
        payload['id'] ??
        payload['driver_id'];
    final String value = candidate?.toString() ?? '';
    return value.isEmpty ? null : value;
  }

  double? _extractCoordinate(Map<String, dynamic> payload, List<String> keys) {
    for (final String key in keys) {
      final dynamic value = payload[key];
      if (value == null) continue;
      final double? parsed = double.tryParse(value.toString());
      if (parsed != null) return parsed;
    }
    return null;
  }

  Iterable<Map<String, dynamic>> _extractNearbyDriverUpdates(
      dynamic data) sync* {
    if (data is List) {
      for (final dynamic item in data) {
        final Map<String, dynamic>? map = _asStringMap(item);
        if (map != null) yield map;
      }
      return;
    }

    final Map<String, dynamic>? payload = _asStringMap(data);
    if (payload == null) return;

    final String type = (payload['type'] ?? '').toString().toUpperCase();
    if (type == 'INITIAL' && payload['drivers'] is List) {
      for (final dynamic item in (payload['drivers'] as List)) {
        final Map<String, dynamic>? map = _asStringMap(item);
        if (map != null) yield map;
      }
      return;
    }

    if (type == 'UPDATE') {
      final Map<String, dynamic>? map = _asStringMap(payload['driver']);
      if (map != null) {
        yield map;
        return;
      }
    }

    if (payload['drivers'] is List) {
      for (final dynamic item in (payload['drivers'] as List)) {
        final Map<String, dynamic>? map = _asStringMap(item);
        if (map != null) yield map;
      }
      return;
    }

    yield payload;
  }

  bool _applyDriverLocationUpdate(Map<String, dynamic> driverUpdate) {
    final String? driverId = _extractDriverId(driverUpdate);
    final double? newLat =
        _extractCoordinate(driverUpdate, ['lat', 'latitude']);
    final double? newLong =
        _extractCoordinate(driverUpdate, ['long', 'lng', 'longitude']);
    final double? newHeading =
        _extractCoordinate(driverUpdate, ['heading', 'bearing']);
    final double? newSpeed =
        _extractCoordinate(driverUpdate, ['speed']);

    if (driverId == null || newLat == null || newLong == null) {
      return false;
    }

    final int index =
        allDriversList.indexWhere((Drivers d) => d.sId == driverId);
    if (index == -1) {
      print('Driver update received for unknown driver: $driverId');
      return false;
    }

    final Drivers driver = allDriversList[index];
    final LatLng? previousPosition = _driverPosition(driver);
    final double? previousHeading = driver.heading;
    final LatLng nextPosition = LatLng(newLat, newLong);

    allDriversList[index].lat = newLat;
    allDriversList[index].long = newLong;
    if (newHeading != null) {
      allDriversList[index].heading = newHeading;
    }
    if (newSpeed != null) {
      allDriversList[index].speed = newSpeed;
    }
    final String? serviceArea = (driverUpdate['currentServiceArea'] ??
            driverUpdate['serviceArea'] ??
            driverUpdate['locationCity'])
        ?.toString();
    if (serviceArea != null) {
      allDriversList[index].currentServiceArea = serviceArea;
    }
    final DateTime? locationUpdatedAt = DateTime.tryParse(
      (driverUpdate['locationUpdatedAt'] ??
              driverUpdate['locationTimestamp'] ??
              '')
          .toString(),
    )?.toUtc();
    if (locationUpdatedAt != null) {
      allDriversList[index].locationUpdatedAt = locationUpdatedAt;
    }

    final String status =
        (driverUpdate['availabilityStatus'] ?? driverUpdate['status'] ?? '')
            .toString()
            .trim()
            .toLowerCase();
    if (status.isNotEmpty) {
      allDriversList[index].availabilityStatus = status;
      allDriversList[index].isOnline = status == 'online';
    }
    if (driverUpdate.containsKey('isAvailable')) {
      allDriversList[index].isAvailable = driverUpdate['isAvailable'] == true;
    }

    if (previousPosition != null &&
        (previousPosition.latitude != nextPosition.latitude ||
            previousPosition.longitude != nextPosition.longitude)) {
      _animateDriverMarkerTransition(
        driverId: driverId,
        from: previousPosition,
        to: nextPosition,
        fromHeading: previousHeading,
        toHeading: newHeading ?? previousHeading,
      );
    }
    return true;
  }

  /// Handle incoming driver location updates from socket
  void _handleDriversNearbyUpdate(dynamic data) {
    if (data == null || !_canUpdateView) return;

    try {
      final Map<String, dynamic>? payload = _asStringMap(data);
      final String type = (payload?['type'] ?? '').toString().toUpperCase();
      if (type == 'INITIAL' && payload?['drivers'] is List) {
        final List<Drivers> initialDrivers = <Drivers>[];
        for (final dynamic item in payload!['drivers'] as List) {
          final Map<String, dynamic>? driverMap = _asStringMap(item);
          if (driverMap != null) {
            initialDrivers.add(Drivers.fromJson(driverMap));
          }
        }

        _prepareVehicleDiscoveryResults(initialDrivers);
        unawaited(_preloadVehicleMarkerIcons());
        _consecutiveDriverRefreshFailures = 0;
        isDriverServiceUnavailable.value = false;
        driverServiceMessage.value = '';
        isDriversLoading.value = false;
        filterDriversByVisibleBounds();
        return;
      }

      if (type == 'REMOVE') {
        final String? driverId =
            payload == null ? null : _extractDriverId(payload);
        if (driverId == null) return;

        _vehicleMarkerAnimationTimers.remove(driverId)?.cancel();
        allDriversList.removeWhere((Drivers driver) => driver.sId == driverId);
        filterDriversByVisibleBounds();
        return;
      }

      bool hasAppliedUpdate = false;
      bool shouldRefreshFromApi = false;

      for (final Map<String, dynamic> driverUpdate
          in _extractNearbyDriverUpdates(data)) {
        final bool updated = _applyDriverLocationUpdate(driverUpdate);
        hasAppliedUpdate = hasAppliedUpdate || updated;

        final String? driverId = _extractDriverId(driverUpdate);
        if (!updated && driverId != null) {
          shouldRefreshFromApi = true;
        }
      }

      if (hasAppliedUpdate) {
        // Refresh visible drivers and markers
        filterDriversByVisibleBounds();
      } else if (shouldRefreshFromApi) {
        callingGetAllDriverListApi(showLoader: false, showError: false);
      }
    } catch (e) {
      print('Error handling drivers-nearby update: $e');
    }
  }

  /// Emit user location update via socket
  Future<void> emitUserLocation() async {
    if (!isUserLocationLoaded.value) return;

    SharedPreferences pref = await SharedPreferences.getInstance();
    String userId = pref.getString(ApiKeyConstants.userId) ?? '';

    if (userId.isNotEmpty && socketService.isConnected) {
      socketService.emitUserLocationUpdate({
        'userId': userId,
        'lat': userLat.value,
        'long': userLng.value,
      });
      print('Emitted user location');
    }
  }

  void increment() {
    if (!_canUpdateView) return;
    count.value++;
  }

  /// Handle text changes in the location field with debounce
  void onLocationTextChanged(String value) {
    _placesDebounce?.cancel();
    _placeSearchRequestId++;
    final String query = value.trim();
    if (query.isEmpty) {
      placeSuggestions.clear();
      isPlacesLoading.value = false;
      placesSearchError.value = '';
      increment();
      return;
    }
    isPlacesLoading.value = true;
    placesSearchError.value = '';
    placeSuggestions.clear();
    increment();
    _placesDebounce = Timer(
      const Duration(milliseconds: _placeSearchDebounceMs),
      () {
        if (!_canUpdateView) return;
        _fetchPlaceSuggestions(query);
      },
    );
  }

  /// Fetch autocomplete suggestions from Google Places HTTP API
  Future<void> _fetchPlaceSuggestions(String input) async {
    final int requestId = _placeSearchRequestId;
    final uri = Uri.parse(
        'https://maps.googleapis.com/maps/api/place/autocomplete/json'
        '?input=$input'
        '&key=${ApiKeyConstants.googleMapKey}'
        '&language=en'
        '&components=country:${AppConfig.marketplaceCountryCode}');

    String? failureMessage;
    final http.Response? response = await _getWithTimeout(
      uri,
      onError: (String message) => failureMessage = message,
    );
    if (!_canUpdateView || requestId != _placeSearchRequestId) return;

    if (response == null) {
      placeSuggestions.clear();
      placesSearchError.value =
          failureMessage ?? 'Unable to find locations. Try again.';
    } else if (response.statusCode == 200) {
      final data = json.decode(response.body);
      final String status = data['status'] ?? '';
      if (status == 'OK') {
        final List preds = data['predictions'] ?? [];
        placeSuggestions.value =
            preds.map((e) => Prediction.fromJson(e)).toList();
      } else if (status == 'ZERO_RESULTS') {
        placeSuggestions.clear();
      } else {
        placeSuggestions.clear();
        placesSearchError.value = status == 'REQUEST_DENIED'
            ? 'Location search is temporarily unavailable.'
            : 'Unable to find locations. Try again.';
      }
    } else {
      placeSuggestions.clear();
      placesSearchError.value = 'Unable to find locations. Try again.';
    }
    isPlacesLoading.value = false;
    increment();
  }

  /// Clear suggestions explicitly (used when opening drawer, etc.)
  void clearPlaceSuggestions() {
    _placesDebounce?.cancel();
    _placeSearchRequestId++;
    placeSuggestions.clear();
    isPlacesLoading.value = false;
    placesSearchError.value = '';
    increment();
  }

  /// Clear the typed text together with any in-flight search state.
  void clearLocationSearch() {
    _placesDebounce?.cancel();
    _placeSearchRequestId++;
    placeSuggestions.clear();
    isPlacesLoading.value = false;
    placesSearchError.value = '';
    locationController.clear();
    increment();
  }

  bool get shouldUseCompactSheet =>
      driversList.isEmpty && !isDriversLoading.value;

  void syncBottomSheetSize() {
    final double targetSize =
        shouldUseCompactSheet ? emptyInitialSheetSize : initialSheetSize;

    if ((sheetSize.value - targetSize).abs() < 0.001) {
      return;
    }

    sheetSize.value = targetSize;
  }

  void onSheetDragged(double extent) {
    sheetSize.value = extent;
  }

  void setSelectedCityLocation(LatLng latLong, String city) {
    mapPosition = latLong;
    selectedLocationLat.value = latLong.latitude;
    selectedLocationLng.value = latLong.longitude;
    selectedLocationAddress.value = city;
    isSelectedLocationSet.value = true;
    // xController!.animateCamera(
    //     CameraUpdate.newCameraPosition(CameraPosition(
    //       target: mapPosition,
    //       zoom: 12,
    //     )));
    locationController.text = city;
  }

  void clickOnDriverIndex(int index) {
    if (index < 0 || index >= driversList.length) {
      return;
    }

    selectIndex = index;
    selectedDriverId = driversList[index].sId;
    _updateSelectedDriverDistance();
    updateDriverMarkers();
    final LatLng? driverPosition = _driverPosition(driversList[index]);
    if (driverPosition != null) {
      unawaited(_animateCamera(
        CameraUpdate.newCameraPosition(
          CameraPosition(target: driverPosition, zoom: 16),
        ),
      ));
    }
    increment();
  }

  /// Draw a polyline between user location and selected driver using Google Directions API
  Future<void> drawLineToDriver(Drivers driver) async {
    polylines.clear();

    if (!isUserLocationLoaded.value) return;
    if (driver.lat == null || driver.long == null) return;

    double driverLat = double.tryParse(driver.lat.toString()) ?? 0;
    double driverLng = double.tryParse(driver.long.toString()) ?? 0;

    LatLng driverLocation = LatLng(driverLat, driverLng);

    // Calculate straight-line distance (for display)
    selectedDriverDistance.value = calculateDistance(
      userLat.value,
      userLng.value,
      driverLat,
      driverLng,
    );

    increment(); // Update UI with distance immediately

    // Fetch actual route from Google Directions API
    try {
      List<LatLng> routePoints =
          await getRoutePoints(userLocation, driverLocation);

      if (routePoints.isNotEmpty) {
        // Create polyline with actual route
        polylines.add(
          Polyline(
            polylineId: const PolylineId('route_to_driver'),
            points: routePoints,
            color: primaryColor,
            width: 5,
            startCap: Cap.roundCap,
            endCap: Cap.roundCap,
            jointType: JointType.round,
          ),
        );
      } else {
        // Fallback to straight line if API fails
        polylines.add(
          Polyline(
            polylineId: const PolylineId('route_to_driver'),
            points: [userLocation, driverLocation],
            color: primaryColor,
            width: 4,
            patterns: [PatternItem.dash(20), PatternItem.gap(10)],
          ),
        );
      }
    } catch (e) {
      print('Error fetching route: $e');
      // Fallback to straight line
      polylines.add(
        Polyline(
          polylineId: const PolylineId('route_to_driver'),
          points: [userLocation, driverLocation],
          color: primaryColor,
          width: 4,
          patterns: [PatternItem.dash(20), PatternItem.gap(10)],
        ),
      );
    }

    // Fit camera to show both points
    fitCameraToShowRoute(userLocation, driverLocation);
    increment();
  }

  /// Fetch route points from Google Directions API
  Future<List<LatLng>> getRoutePoints(LatLng origin, LatLng destination) async {
    final String url = 'https://maps.googleapis.com/maps/api/directions/json?'
        'origin=${origin.latitude},${origin.longitude}'
        '&destination=${destination.latitude},${destination.longitude}'
        '&mode=driving'
        '&key=${ApiKeyConstants.googleMapKey}';

    try {
      final response = await http.get(Uri.parse(url));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);

        if (data['status'] == 'OK' && data['routes'].isNotEmpty) {
          // Get the encoded polyline from the response
          String encodedPolyline =
              data['routes'][0]['overview_polyline']['points'];

          // Update distance with actual driving distance
          if (data['routes'][0]['legs'].isNotEmpty) {
            int distanceInMeters =
                data['routes'][0]['legs'][0]['distance']['value'];
            selectedDriverDistance.value =
                distanceInMeters / 1000; // Convert to km
          }

          // Decode the polyline
          return decodePolyline(encodedPolyline);
        } else {
          print('Directions API error: ${data['status']}');
        }
      } else {
        print('HTTP error: ${response.statusCode}');
      }
    } catch (e) {
      print('Exception fetching route: $e');
    }

    return [];
  }

  /// Decode Google's encoded polyline string into list of LatLng points
  List<LatLng> decodePolyline(String encoded) {
    List<LatLng> points = [];
    int index = 0;
    int len = encoded.length;
    int lat = 0;
    int lng = 0;

    while (index < len) {
      int b;
      int shift = 0;
      int result = 0;

      do {
        b = encoded.codeUnitAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      int dlat = ((result & 1) != 0 ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;

      do {
        b = encoded.codeUnitAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      int dlng = ((result & 1) != 0 ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      points.add(LatLng(lat / 1E5, lng / 1E5));
    }

    return points;
  }

  /// Fit camera to show both user and driver locations
  void fitCameraToShowRoute(LatLng point1, LatLng point2) {
    LatLngBounds bounds = LatLngBounds(
      southwest: LatLng(
        math.min(point1.latitude, point2.latitude) - 0.01,
        math.min(point1.longitude, point2.longitude) - 0.01,
      ),
      northeast: LatLng(
        math.max(point1.latitude, point2.latitude) + 0.01,
        math.max(point1.longitude, point2.longitude) + 0.01,
      ),
    );

    unawaited(_animateCamera(
      CameraUpdate.newLatLngBounds(bounds, 80), // 80px padding
    ));
  }

  /// Clear the selection
  void clearRoute() {
    _resetSelectedDriver();
    updateDriverMarkers();
    increment();
  }

  bool _isRetryingUserDetails = false;

  void clickOnMenu() {
    if (userData.isNotEmpty) {
      scaffoldKey.currentState?.openEndDrawer();
      return;
    }
    CommonWidgets.showMyToastMessage('User data is loading please wait ....');
    if (_isRetryingUserDetails) return;
    _isRetryingUserDetails = true;
    callingGetUserDetails().then((_) {
      _isRetryingUserDetails = false;
      if (userData.isNotEmpty) {
        scaffoldKey.currentState?.openEndDrawer();
      }
    });
  }

  Future<bool> checkPermission() async {
    final bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!_canUpdateView) return false;
    if (!serviceEnabled) {
      showPermissionAlert();
      return false;
    }
    return getCurrentLocation();
  }

  Future<bool> getCurrentLocation({bool showPermissionDialog = true}) async {
    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (!_canUpdateView) return false;
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      print('Permission Denied.....');
      if (showPermissionDialog) showPermissionAlert();
      return false;
    }

    print('Permission Granted.....');
    try {
      final Position currentPosition = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 12),
        ),
      );
      if (!_canUpdateView) return false;

      return _applyUserPosition(currentPosition);
    } catch (e) {
      print('Error getting location: $e');
      return false;
    }
  }

  bool _applyUserPosition(Position position) {
    if (!_canUpdateView) return false;
    if (!isGpsTimestampFresh(
      position.timestamp,
      now: DateTime.now(),
      maxAge: _maxUserLocationAge,
      maxFutureSkew: _maxGpsFutureSkew,
    )) {
      _setLocationRequiredState(
        'Your GPS fix is stale. Refresh your precise location and retry.',
      );
      return false;
    }
    userLat.value = position.latitude;
    userLng.value = position.longitude;
    isUserLocationLoaded.value = true;
    _lastUserPositionRecordedAt = position.timestamp;
    if (AppConfig.tunisiaTestMode && !isSelectedLocationSet.value) {
      final LatLng gpsLocation = LatLng(position.latitude, position.longitude);
      mapPosition = gpsLocation;
      currentMapCenter = gpsLocation;
      locationController.text = 'Current location in Tunisia';
      unawaited(_animateCamera(
        CameraUpdate.newCameraPosition(
          CameraPosition(target: gpsLocation, zoom: 14),
        ),
      ));
    }

    isDriverServiceUnavailable.value = false;
    driverServiceMessage.value = '';
    filterDriversByVisibleBounds();
    unawaited(emitUserLocation());
    _scheduleUserLocationExpiry(position.timestamp);
    return true;
  }

  void _scheduleUserLocationExpiry(DateTime recordedAt) {
    _userLocationFreshnessTimer?.cancel();
    final DateTime expiresAt = recordedAt.toUtc().add(_maxUserLocationAge);
    final Duration remaining = expiresAt.difference(DateTime.now().toUtc());
    _userLocationFreshnessTimer = Timer(
      remaining.isNegative ? Duration.zero : remaining,
      () {
        if (!_canUpdateView) return;
        _setLocationRequiredState(
          'Live GPS updates stopped. Refresh your precise location and retry.',
        );
      },
    );
  }

  void _startUserLocationTracking() {
    _stopUserLocationTracking();
    if (!isUserLocationLoaded.value || !_canUpdateView) return;

    const LocationSettings settings = LocationSettings(
      accuracy: LocationAccuracy.high,
      distanceFilter: 0,
    );
    _userPositionSubscription =
        Geolocator.getPositionStream(locationSettings: settings).listen(
      (Position position) => _applyUserPosition(position),
      onError: (Object error) {
        debugPrint('User GPS stream failed: $error');
        _setLocationRequiredState(
          'Live GPS updates stopped. Refresh your precise location and retry.',
        );
      },
    );
    final DateTime? recordedAt = _lastUserPositionRecordedAt;
    if (recordedAt != null) _scheduleUserLocationExpiry(recordedAt);
  }

  void _stopUserLocationTracking() {
    _userLocationFreshnessTimer?.cancel();
    _userLocationFreshnessTimer = null;
    _userPositionSubscription?.cancel();
    _userPositionSubscription = null;
  }

  void showPermissionAlert() {
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
                          unawaited(retryDriverDiscovery());
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

  /* void clickOnLocation(Prediction prediction) async {
    locationController.text = prediction.description ?? "";
    locationController.selection = TextSelection.fromPosition(
        TextPosition(offset: prediction.description?.length ?? 0));
  print('Select location:--${prediction.lat.toString()}');
  print('Select location:--${prediction.toJson()}');
  if(prediction.lat!=null && prediction.lng!=null){
    mapPosition=LatLng(double.parse(prediction.lat!),double.parse(prediction.lng!));
  }
    xController!.animateCamera(
        CameraUpdate.newCameraPosition(CameraPosition(
          target: mapPosition,
          zoom: 12,
        )));
  }*/

  Future<void> clickOnLocation(Prediction prediction) async {
    locationController.text = prediction.description ?? "";
    locationController.selection = TextSelection.fromPosition(
      TextPosition(offset: prediction.description?.length ?? 0),
    );

    if (prediction.placeId != null) {
      final placeId = prediction.placeId!;
      final uri = Uri.parse(
          "https://maps.googleapis.com/maps/api/place/details/json?place_id=$placeId&key=${ApiKeyConstants.googleMapKey}");

      final http.Response? response = await _getWithTimeout(uri);
      if (!_canUpdateView) return;

      if (response == null) {
        CommonWidgets.snackBarView(
          title: 'Unable to open this location. Try again.',
          success: false,
        );
      } else if (response.statusCode == 200) {
        final data = json.decode(response.body);

        if (data["status"] == "OK") {
          final location = data["result"]["geometry"]["location"];
          final lat = location["lat"];
          final lng = location["lng"];

          mapPosition = LatLng(lat, lng);

          // Set the selected location (this will add a draggable marker)
          selectedLocationLat.value = lat;
          selectedLocationLng.value = lng;
          selectedLocationAddress.value = prediction.description ?? '';
          isSelectedLocationSet.value = true;

          // Update markers and filter drivers
          updateDriverMarkers();
          filterDriversByVisibleBounds();
          unawaited(_refreshDiscoveryForReferenceLocation(showLoader: true));

          await _animateCamera(
            CameraUpdate.newCameraPosition(
              CameraPosition(
                target: mapPosition,
                zoom: 14,
              ),
            ),
          );
          if (!_canUpdateView) return;

          increment();
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

  Future<void> callingGetUserDetails() async {
    try {
      if (!_canUpdateView) return;
      if (!await AuthSessionManager.hasStoredSession()) {
        await AuthSessionManager.clearExpiredSession();
        return;
      }
      int? responseStatus;
      LoginModel? loginModel = await ApiMethods.getCurrentUserApi(
        checkResponse: (int status) => responseStatus = status,
      );
      if (!_canUpdateView) return;
      if (loginModel != null &&
          loginModel.success != null &&
          loginModel.success! &&
          loginModel.user != null) {
        userData.value = {
          ApiKeyConstants.phone: loginModel.user?.phone ?? '',
          ApiKeyConstants.countryCode: loginModel.user?.countryCode ?? '',
          ApiKeyConstants.profileImage: loginModel.user?.profileImageUrl ?? '',
          ApiKeyConstants.fullName: loginModel.user?.fullName ?? '',
        };
        print('User details loaded successfully');
      } else if (responseStatus == 401) {
        await AuthSessionManager.clearExpiredSession();
      } else {
        CommonWidgets.snackBarView(
            title: loginModel?.message ?? 'Get user data Failed ...');
      }
    } catch (e) {
      if (!_canUpdateView) return;
      CommonWidgets.snackBarView(title: 'Somethings wrong...');
    }
    increment();
  }

  Future<DriverDiscoveryOutcome> callingGetAllDriverListApi({
    bool showLoader = true,
    bool showError = true,
  }) async {
    if (_isRefreshingDriverList) return DriverDiscoveryOutcome.failed;
    _isRefreshingDriverList = true;
    int? responseStatus;
    DriverDiscoveryOutcome outcome = DriverDiscoveryOutcome.failed;

    if (showLoader) {
      isDriversLoading.value = true;
      driversList = [];
      visibleDriversList = [];
      syncBottomSheetSize();
      _resetSelectedDriver();
      updateDriverMarkers();
      _syncDriverLoaderAnimation();
      increment();
    }

    try {
      DriverListModel? driverListModel = await ApiMethods.getAllDriverListApi(
        city: parameter[ApiKeyConstants.city] ?? '',
        vType: selectedVehicleTypeKey.isNotEmpty
            ? selectedVehicleTypeKey
            : (parameter[ApiKeyConstants.vehicleType] ?? ''),
        availability: 'online',
        latitude: hasReferenceLocation ? referenceLocation.latitude : null,
        longitude: hasReferenceLocation ? referenceLocation.longitude : null,
        checkResponse: (int status) => responseStatus = status,
      );
      if (!_canUpdateView) return DriverDiscoveryOutcome.failed;
      if (driverListModel != null && driverListModel.success == true) {
        _prepareVehicleDiscoveryResults(driverListModel.drivers ?? <Drivers>[]);
        unawaited(_preloadVehicleMarkerIcons());
        _consecutiveDriverRefreshFailures = 0;
        isDriverServiceUnavailable.value = false;
        driverServiceMessage.value = '';

        print('Total drivers from API: ${allDriversList.length}');

        filterDriversByVisibleBounds();
        outcome = DriverDiscoveryOutcome.success;
      } else {
        _consecutiveDriverRefreshFailures++;
        if (responseStatus == 400 || responseStatus == 422) {
          final String code = (driverListModel?.code ?? '').toUpperCase();
          outcome = code == 'OUTSIDE_SERVICE_AREA' || responseStatus == 422
              ? DriverDiscoveryOutcome.outsideServiceArea
              : DriverDiscoveryOutcome.locationRequired;
          _setLocationRequiredState(
            driverListModel?.message ??
                (outcome == DriverDiscoveryOutcome.outsideServiceArea
                    ? 'Find Now is available only inside ${AppConfig.marketplaceRegionLabel}.'
                    : 'A fresh precise GPS location is required.'),
          );
        } else if (responseStatus == 401) {
          await AuthSessionManager.clearExpiredSession();
        } else if (responseStatus == 404) {
          isDriverServiceUnavailable.value = true;
          driverServiceMessage.value =
              'Driver service is temporarily unavailable.';
        } else if (driverListModel == null || responseStatus == null) {
          isDriverServiceUnavailable.value = true;
          driverServiceMessage.value =
              'Driver service is temporarily unavailable.';
        } else {
          isDriverServiceUnavailable.value = false;
          driverServiceMessage.value = '';
        }
      }
    } catch (e) {
      _consecutiveDriverRefreshFailures++;
      final int? status = responseStatus;
      if (status == null || status >= 500) {
        isDriverServiceUnavailable.value = true;
        driverServiceMessage.value = 'Unable to load drivers. Please retry.';
      }
      print("Error: -----${e.toString()}");
    } finally {
      _isRefreshingDriverList = false;
      if (_canUpdateView) {
        isDriversLoading.value = false;
        syncBottomSheetSize();
        _syncDriverLoaderAnimation();
        increment();
      }
    }
    return outcome;
  }
}
