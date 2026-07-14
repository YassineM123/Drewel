import 'package:drewel/app/data/apis/api_models/get_all_driver_model.dart';
import 'package:drewel/app/data/apis/api_models/get_login_model.dart';
import 'package:drewel/common/local_data.dart';
import 'package:drewel/common/socket_services.dart';
import 'package:flutter/material.dart';
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
import 'package:url_launcher/url_launcher.dart';
import 'dart:ui' as ui;
import 'dart:io';
import '../../../../common/colors.dart';
import '../../../../common/common_widgets.dart';
import '../../../../common/text_styles.dart';
import '../../../data/apis/api_constants/api_key_constants.dart';
import '../../../data/apis/api_methods/api_methods.dart';
import '../../../data/constants/icons_constant.dart';
import '../../../data/constants/string_constants.dart';
import '../../../data/apis/api_constants/api_url_constants.dart';

class UserHomeController extends GetxController
    with GetSingleTickerProviderStateMixin, WidgetsBindingObserver {
  final RxMap<String, String> userData = <String, String>{}.obs;
  final leftPosition = 0.0.obs;

  /// Google Places autocomplete suggestions
  final RxList<Prediction> placeSuggestions = <Prediction>[].obs;
  Timer? _placesDebounce;
  Timer? _driverPollingTimer;
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

  final count = 0.obs;
  int selectIndex = -1;
  String? selectedDriverId;
  Set<Marker> markers = {};
  Set<Polyline> polylines = {}; // For drawing lines between user and driver
  BitmapDescriptor customMarker = BitmapDescriptor.defaultMarker;
  BitmapDescriptor driverMarker = BitmapDescriptor.defaultMarker;
  BitmapDescriptor selectedDriverMarker = BitmapDescriptor.defaultMarker;
  BitmapDescriptor userLocationMarker = BitmapDescriptor.defaultMarker;

  // Socket service for real-time driver location updates
  final SocketService socketService = SocketService();
  String? _currentCity;
  bool _isRefreshingDriverList = false;
  static const int _driverPollingIntervalSeconds = 5;

  // Loading state for drivers
  final isDriversLoading = true.obs;

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
    if (Platform.isIOS) {
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
    increment(); // Trigger a rebuild
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
    if (isUserLocationLoaded.value && xController != null) {
      xController!.animateCamera(
        CameraUpdate.newCameraPosition(
          CameraPosition(
            target: userLocation,
            zoom: 14,
          ),
        ),
      );
    }
    increment();
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

    // Get address for the location
    getAddressFromCoordinates(location);

    increment();
  }

  /// Clear selected location and use GPS location
  void clearSelectedLocation() {
    isSelectedLocationSet.value = false;
    selectedLocationAddress.value = '';
    updateDriverMarkers();
    filterDriversByVisibleBounds();
    increment();
  }

  /// Get address from coordinates using Google Geocoding API (reverse geocoding)
  Future<void> getAddressFromCoordinates(LatLng location) async {
    try {
      final String url = 'https://maps.googleapis.com/maps/api/geocode/json?'
          'latlng=${location.latitude},${location.longitude}'
          '&key=${ApiKeyConstants.googleMapKey}';

      print('Reverse geocoding: $url');

      final response = await http.get(Uri.parse(url));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);

        if (data['status'] == 'OK' && data['results'].isNotEmpty) {
          String address = data['results'][0]['formatted_address'];
          selectedLocationAddress.value = address;
          locationController.text = address;
          print('Address found: $address');
        } else {
          print('Geocoding error: ${data['status']}');
          selectedLocationAddress.value = 'Location selected';
        }
      }
    } catch (e) {
      print('Error getting address: $e');
      selectedLocationAddress.value = 'Location selected';
    }
    increment();
  }

  /// Handle marker drag end
  void onMarkerDragEnd(LatLng newPosition) {
    print(
        'Marker dragged to: ${newPosition.latitude}, ${newPosition.longitude}');
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

  /// Filter and sort drivers based on visible map bounds and vehicle type
  void filterDriversByVisibleBounds() {
    if (currentVisibleBounds == null || allDriversList.isEmpty) {
      visibleDriversList = [];
      driversList = [];
      updateDriverMarkers();
      _syncDriverLoaderAnimation();
      syncBottomSheetSize();
      increment();
      return;
    }

    // Filter drivers within visible bounds AND matching vehicle type
    visibleDriversList = allDriversList.where((driver) {
      if (driver.lat == null || driver.long == null) return false;

      // Filter by vehicle type if selected
      if (selectedVehicleType.isNotEmpty) {
        String driverVehicleType =
            (driver.vehicleType ?? '').toLowerCase().trim();
        String filterVehicleType = selectedVehicleType.toLowerCase().trim();

        // Check if vehicle type matches (case-insensitive)
        if (!driverVehicleType.contains(filterVehicleType) &&
            !filterVehicleType.contains(driverVehicleType)) {
          return false;
        }
      }

      double driverLat = double.tryParse(driver.lat.toString()) ?? 0;
      double driverLng = double.tryParse(driver.long.toString()) ?? 0;

      // Check if driver is within visible bounds
      return driverLat >= currentVisibleBounds!.southwest.latitude &&
          driverLat <= currentVisibleBounds!.northeast.latitude &&
          driverLng >= currentVisibleBounds!.southwest.longitude &&
          driverLng <= currentVisibleBounds!.northeast.longitude;
    }).toList();

    // Sort by distance - from selected location if set, else user GPS, else map center
    LatLng sortFromPoint =
        hasReferenceLocation ? referenceLocation : currentMapCenter;

    visibleDriversList.sort((a, b) {
      double distA = calculateDistance(
        sortFromPoint.latitude,
        sortFromPoint.longitude,
        double.tryParse(a.lat.toString()) ?? 0,
        double.tryParse(a.long.toString()) ?? 0,
      );
      double distB = calculateDistance(
        sortFromPoint.latitude,
        sortFromPoint.longitude,
        double.tryParse(b.lat.toString()) ?? 0,
        double.tryParse(b.long.toString()) ?? 0,
      );
      return distA.compareTo(distB);
    });

    // Update the driversList that's used by the UI
    driversList = visibleDriversList;
    _syncSelectedDriverSelection();

    // Update markers on map
    updateDriverMarkers();
    _syncDriverLoaderAnimation();
    syncBottomSheetSize();

    print(
        'Visible drivers: ${visibleDriversList.length} out of ${allDriversList.length} (filter: "$selectedVehicleType")');
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
                ? '${selectedLocationAddress.value.substring(
                        0,
                        selectedLocationAddress.value.length > 50
                            ? 50
                            : selectedLocationAddress.value.length)}...'
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
        markers.add(
          Marker(
            markerId: MarkerId('driver_$i'),
            icon: selectIndex == i ? selectedDriverMarker : driverMarker,
            position: LatLng(
              double.tryParse(driver.lat.toString()) ?? 0,
              double.tryParse(driver.long.toString()) ?? 0,
            ),
            onTap: () {
              clickOnDriverIndex(i);
            },
            // Add info window with driver name
            infoWindow: InfoWindow(
              title: driver.fullName ?? 'Driver',
              snippet: driver.vehicleType ?? '',
            ),
            zIndex: selectIndex == i ? 4 : 1,
          ),
        );
      }
    }
  }

  /// Called when map camera moves (zoom/pan)
  Future<void> onCameraMove(CameraPosition position) async {
    currentMapCenter = position.target;
  }

  /// Called when camera movement is idle (stopped moving)
  Future<void> onCameraIdle() async {
    if (xController == null) return;

    // Get visible region bounds
    currentVisibleBounds = await xController!.getVisibleRegion();

    print(
        'Map bounds updated: SW(${currentVisibleBounds!.southwest.latitude}, ${currentVisibleBounds!.southwest.longitude}) - NE(${currentVisibleBounds!.northeast.latitude}, ${currentVisibleBounds!.northeast.longitude})');

    // Filter drivers based on new visible bounds
    filterDriversByVisibleBounds();
  }

  @override
  void onInit() {
    super.onInit();
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
    checkPermission();
    callingGetUserDetails();
    callingGetAllDriverListApi();
    _startDriverPolling();
    // WidgetsBinding.instance.addPostFrameCallback((_) {
    //   leftPosition.value = MediaQuery.of(Get.context!).size.width - 100;
    //   increment();
    // });
    setSelectedCityLocation(
        LatLng(
            LocalData().cityLatLongList[
                int.parse(parameter[ApiKeyConstants.index] ?? '0')]['lat'],
            LocalData().cityLatLongList[
                int.parse(parameter[ApiKeyConstants.index] ?? '0')]['lon']),
        LocalData().cityLatLongList[
            int.parse(parameter[ApiKeyConstants.index] ?? '0')]['city']);

    // Initialize socket for real-time driver updates
    _initSocket();
  }


  @override
  void onClose() {
    WidgetsBinding.instance.removeObserver(this);
    animationController.dispose();
    _stopDriverPolling();
    _disconnectSocket();
    super.onClose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.detached) {
      _stopDriverPolling();
      // App is in background - leave city room
      if (_currentCity != null) {
        socketService.emitLeaveCityRoom(_currentCity!);
      }
    } else if (state == AppLifecycleState.resumed) {
      _startDriverPolling();
      callingGetAllDriverListApi(showLoader: false, showError: false);
      // App is in foreground - rejoin city room
      if (_currentCity != null) {
        socketService.emitJoinCityRoom(
          _currentCity!,
          vehicleType: selectedVehicleType,
        );
      }
    }
  }

  void _startDriverPolling() {
    _stopDriverPolling();
    _driverPollingTimer = Timer.periodic(
      const Duration(seconds: _driverPollingIntervalSeconds),
      (_) => callingGetAllDriverListApi(showLoader: false, showError: false),
    );
  }

  void _stopDriverPolling() {
    _driverPollingTimer?.cancel();
    _driverPollingTimer = null;
  }

  void _joinRealtimeTrackingRoom() {
    if (_currentCity != null && _currentCity!.isNotEmpty) {
      socketService.emitJoinCityRoom(
        _currentCity!,
        vehicleType: selectedVehicleType,
      );
      print('Joined city room: $_currentCity');
    }
    emitUserLocation();
    callingGetAllDriverListApi(showLoader: false, showError: false);
  }

  /// Initialize socket connection and listen for driver updates
  Future<void> _initSocket() async {
    SharedPreferences pref = await SharedPreferences.getInstance();
    String token = pref.getString(ApiKeyConstants.token) ?? '';
    _currentCity = parameter[ApiKeyConstants.city] ?? '';

    if (token.isNotEmpty) {
      socketService.connect(ApiUrlConstants.socketUrl, token);
      socketService.onConnect(() {
        print('User location socket ready');
        _joinRealtimeTrackingRoom();
      });

      // Listen for nearby driver updates
      socketService.onDriversNearby((data) {
        print('Received drivers-nearby: $data');
        _handleDriversNearbyUpdate(data);
      });

      if (socketService.isConnected) {
        _joinRealtimeTrackingRoom();
      }
    }
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

  Iterable<Map<String, dynamic>> _extractNearbyDriverUpdates(dynamic data) sync* {
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
    final double? newLat = _extractCoordinate(driverUpdate, ['lat', 'latitude']);
    final double? newLong =
        _extractCoordinate(driverUpdate, ['long', 'lng', 'longitude']);

    if (driverId == null || newLat == null || newLong == null) {
      return false;
    }

    final int index = allDriversList.indexWhere((Drivers d) => d.sId == driverId);
    if (index == -1) {
      print('Driver update received for unknown driver: $driverId');
      return false;
    }

    allDriversList[index].lat = newLat;
    allDriversList[index].long = newLong;
    print('Updated driver $driverId location: $newLat, $newLong');
    return true;
  }

  /// Handle incoming driver location updates from socket
  void _handleDriversNearbyUpdate(dynamic data) {
    if (data == null) return;

    try {
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
          '&components=country:ae');

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
    mapPosition = LatLng(
        LocalData().cityLatLongList[
            int.parse(parameter[ApiKeyConstants.index] ?? '0')]['lat'],
        LocalData().cityLatLongList[
            int.parse(parameter[ApiKeyConstants.index] ?? '0')]['lon']);
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

    print('Fetching route from: $url');

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
    if (xController == null) return;

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

    xController!.animateCamera(
      CameraUpdate.newLatLngBounds(bounds, 80), // 80px padding
    );
  }

  /// Clear the selection
  void clearRoute() {
    _resetSelectedDriver();
    updateDriverMarkers();
    increment();
  }

  void clickOnMenu() {
    if (userData.isNotEmpty) {
      scaffoldKey.currentState?.openEndDrawer();
    } else {
      CommonWidgets.showMyToastMessage('User data is loading please wait ....');
    }
  }

  /// Launch WhatsApp with driver's number
  Future<void> openWhatsApp(Drivers driver) async {
    // Use whatsappNumber if available, otherwise fallback to phone
    String? phoneNumber = driver.whatsappNumber ??
        (driver.countryCode != null && driver.phone != null
            ? '${driver.countryCode}${driver.phone}'
            : driver.phone);

    if (phoneNumber == null || phoneNumber.isEmpty) {
      CommonWidgets.snackBarView(title: 'WhatsApp number not available');
      return;
    }

    // Remove any spaces, dashes, or special characters from phone number
    phoneNumber = phoneNumber.replaceAll(RegExp(r'[\s\-\(\)]'), '');

    // Remove leading + if present for WhatsApp URL
    if (phoneNumber.startsWith('+')) {
      phoneNumber = phoneNumber.substring(1);
    }

    final whatsappUrl = Uri.parse('https://wa.me/$phoneNumber');

    try {
      if (await canLaunchUrl(whatsappUrl)) {
        await launchUrl(whatsappUrl, mode: LaunchMode.externalApplication);
      } else {
        CommonWidgets.snackBarView(title: 'Could not open WhatsApp');
      }
    } catch (e) {
      print('Error launching WhatsApp: $e');
      CommonWidgets.snackBarView(title: 'Error opening WhatsApp');
    }
  }

  Future<void> checkPermission() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      showPermissionAlert();
    } else {
      getCurrentLocation();
    }
  }

  Future<void> getCurrentLocation() async {
    LocationPermission permission = await Geolocator.requestPermission();
    if (permission == LocationPermission.denied) {
      print('Permission Denied.....');
      showPermissionAlert();
    } else {
      print('Permission Granted.....');
      try {
        Position currentPosition = await Geolocator.getCurrentPosition(
          desiredAccuracy: LocationAccuracy.high,
        );

        userLat.value = currentPosition.latitude;
        userLng.value = currentPosition.longitude;
        isUserLocationLoaded.value = true;

        print('User location: ${userLat.value}, ${userLng.value}');

        // Update markers with user location
        updateDriverMarkers();

        // Re-filter drivers by distance from user
        filterDriversByVisibleBounds();

        emitUserLocation();

        increment();
      } catch (e) {
        print('Error getting location: $e');
      }
    }
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

    print('Selected place: ${prediction.description}');
    print('Prediction JSON: ${prediction.toJson()}');

    if (prediction.placeId != null) {
      final placeId = prediction.placeId!;
      final url =
          "https://maps.googleapis.com/maps/api/place/details/json?place_id=$placeId&key=${ApiKeyConstants.googleMapKey}";

      final response = await http.get(Uri.parse(url));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);

        if (data["status"] == "OK") {
          final location = data["result"]["geometry"]["location"];
          final lat = location["lat"];
          final lng = location["lng"];

          print("Lat: $lat, Lng: $lng");

          mapPosition = LatLng(lat, lng);

          // Set the selected location (this will add a draggable marker)
          selectedLocationLat.value = lat;
          selectedLocationLng.value = lng;
          selectedLocationAddress.value = prediction.description ?? '';
          isSelectedLocationSet.value = true;

          // Update markers and filter drivers
          updateDriverMarkers();
          filterDriversByVisibleBounds();

          xController!.animateCamera(
            CameraUpdate.newCameraPosition(
              CameraPosition(
                target: mapPosition,
                zoom: 14,
              ),
            ),
          );

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
      SharedPreferences pref = await SharedPreferences.getInstance();
      String userId = pref.getString(ApiKeyConstants.userId) ?? '';
      LoginModel? loginModel =
          await ApiMethods.getUserDetailsApi(userId: userId);
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
        print('get user details successfully completed....$userData');
      } else {
        CommonWidgets.snackBarView(
            title: loginModel?.message ?? 'Get user data Failed ...');
      }
    } catch (e) {
      CommonWidgets.snackBarView(title: 'Somethings wrong...');
    }
    increment();
  }

  Future<void> callingGetAllDriverListApi({
    bool showLoader = true,
    bool showError = true,
  }) async {
    if (_isRefreshingDriverList) return;
    _isRefreshingDriverList = true;

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
          // city: parameter[ApiKeyConstants.city]??'',
          vType: parameter[ApiKeyConstants.vehicleType] ?? '');
      if (driverListModel != null &&
          driverListModel.success != null &&
          driverListModel.success! &&
          driverListModel.drivers != null) {
        // Store all drivers in master list
        allDriversList = driverListModel.drivers!;

        print('Total drivers from API: ${allDriversList.length}');

        if (xController != null) {
          await Future.delayed(const Duration(milliseconds: 500));
          await onCameraIdle();
        } else {
          // Initial filter will happen when map is created and bounds are available
          driversList = allDriversList;
          _syncSelectedDriverSelection();
          updateDriverMarkers();
          _syncDriverLoaderAnimation();
        }
      } else {
        if (showError) {
          CommonWidgets.snackBarView(
              title: driverListModel?.message ?? 'Driver not found ...');
        }
      }
    } catch (e) {
      if (showError) {
        CommonWidgets.snackBarView(title: 'Somethings wrong 1...}');
      }
      print("Error: -----${e.toString()}");
    } finally {
      _isRefreshingDriverList = false;
      isDriversLoading.value = false;
      syncBottomSheetSize();
      _syncDriverLoaderAnimation();
      increment();
    }
  }
}
