import 'dart:async';
import 'dart:convert';
import 'package:drewel/app/data/apis/api_models/get_add_driver_details_model.dart';
import 'package:drewel/app/data/apis/api_models/get_simple_response_model.dart';
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
import '../../../../common/socket_services.dart';
import '../../../../common/text_styles.dart';
import '../../../data/apis/api_constants/api_key_constants.dart';
import '../../../data/apis/api_methods/api_methods.dart';
import '../../../data/constants/icons_constant.dart';
import '../../../data/constants/string_constants.dart';
import '../../../data/apis/api_constants/api_url_constants.dart';
import '../../../routes/app_pages.dart';

class DriverHomeController extends GetxController with WidgetsBindingObserver {
  final GlobalKey<ScaffoldState> scaffoldKey = GlobalKey<ScaffoldState>();
  TextEditingController locationController=TextEditingController();
  FocusNode locationFocusNode = FocusNode();
  final lat = 23.4241.obs;
  final lon = 53.8478.obs;
  LatLng mapPosition = const LatLng(23.4241, 53.8478);
  GoogleMapController? xController;

  final count = 0.obs;
  BitmapDescriptor customMarker=BitmapDescriptor.defaultMarker;
  /// Google Places autocomplete suggestions
  final RxList<Prediction> placeSuggestions = <Prediction>[].obs;
  Timer? _placesDebounce;
  StreamSubscription<Position>? _positionStreamSubscription;
  
  // Socket service for real-time location updates
  final SocketService socketService = SocketService();
  Timer? _locationUpdateTimer;
  String? _driverId;
  String? _driverName;
  String? _vehicleType;
  String? _city;
  static const int _locationUpdateIntervalSeconds = 10; // Update every 10 seconds
  DateTime? _lastDriverLocationApiUpdateAt;
  bool _isUpdatingDriverLocation = false;
  bool _hasDriverLocation = false;

  bool get _isDriverOnline => !isGoOnline.value;

  Future<BitmapDescriptor> getResizedMarker(String assetPath, {int width = 80}) async {
    final ByteData data = await rootBundle.load(assetPath);
    final codec = await ui.instantiateImageCodec(
      data.buffer.asUint8List(),
      targetWidth: width, // adjust width for desired size
    );
    final frameInfo = await codec.getNextFrame();
    final resizedImage = await frameInfo.image.toByteData(format: ui.ImageByteFormat.png);
    return BitmapDescriptor.fromBytes(resizedImage!.buffer.asUint8List());
  }
  void loadCustomMarker() async {
    if (Platform.isIOS) {
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
  final isGoOnline=true.obs;
  final showLoading=false.obs;
  final RxMap<String,String> userData = <String,String>{}.obs;
  @override
  void onInit() {
    super.onInit();
    WidgetsBinding.instance.addObserver(this);
    loadCustomMarker();
    checkPermission();
    callingGetDriverDetails();
    _initSocket();
  }


  @override
  void onClose() {
    WidgetsBinding.instance.removeObserver(this);
    _stopLocationUpdates();
    _stopRealtimeLocationTracking();
    _placesDebounce?.cancel();
    socketService.disconnect();
    super.onClose();
  }
  
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);
    if (state == AppLifecycleState.paused || state == AppLifecycleState.detached) {
      // App is in background or closing - stop location updates
      _stopLocationUpdates();
      _stopRealtimeLocationTracking();
    } else if (state == AppLifecycleState.resumed) {
      // App is in foreground - resume location updates and realtime GPS tracking
      _initSocket();
      _startRealtimeLocationTracking();
      if (_isDriverOnline) {
        _startLocationUpdates();
      }
    }
  }
  
  /// Initialize socket connection
  Future<void> _initSocket() async {
    SharedPreferences pref = await SharedPreferences.getInstance();
    String token = pref.getString(ApiKeyConstants.token) ?? '';
    _driverId = pref.getString(ApiKeyConstants.userId) ?? '';
    
    if (token.isNotEmpty) {
      socketService.connect(ApiUrlConstants.socketUrl, token);
      socketService.onConnect(() {
        print('Driver location socket ready');
        if (_isDriverOnline) {
          _emitCurrentLocation();
        }
      });
      print('Socket connected for driver location updates');
    }
  }
  
  /// Start periodic location updates via socket
  void _startLocationUpdates() {
    _stopLocationUpdates(); // Stop any existing timer
    
    // Emit location immediately
    _emitCurrentLocation();
    
    // Then emit every 10 seconds
    _locationUpdateTimer = Timer.periodic(
      const Duration(seconds: _locationUpdateIntervalSeconds),
      (_) => _emitCurrentLocation(),
    );
    
    print('Started location updates - emitting every $_locationUpdateIntervalSeconds seconds');
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
    if (!socketService.isConnected) {
      print('Socket not connected, skipping location emit');
      return;
    }
    
    socketService.emitDriverLocationUpdate({
      'driverId': _driverId,
      'lat': lat.value,
      'long': lon.value,
      'fullName': _driverName ?? '',
      'vehicleType': _vehicleType ?? '',
      'city': _city ?? '',
    });

    print('Emitted driver location: ${lat.value}, ${lon.value}');
  }

  void _startRealtimeLocationTracking() {
    if (_positionStreamSubscription != null) return;

    const locationSettings = LocationSettings(
      accuracy: LocationAccuracy.bestForNavigation,
      distanceFilter: 10,
    );

    _positionStreamSubscription = Geolocator.getPositionStream(
      locationSettings: locationSettings,
    ).listen(
      (Position position) {
        _applyDriverPosition(
          position,
          syncToServer: _isDriverOnline,
        );
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
  }) async {
    final bool hasPositionChanged =
        lat.value != position.latitude || lon.value != position.longitude;

    lat.value = position.latitude;
    lon.value = position.longitude;
    mapPosition = LatLng(position.latitude, position.longitude);
    _hasDriverLocation = true;

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
      final bool updated =
          await callingUpdateDriverLocation(showError: false);
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

  void clickOnMenu(){
    if(userData.isNotEmpty){
      scaffoldKey.currentState?.openEndDrawer();
    }else{
      CommonWidgets.showMyToastMessage('Driver data is loading please wait ....');
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
      Position currentPosition = await Geolocator.getCurrentPosition();
      await _applyDriverPosition(
        currentPosition,
        animateCamera: true,
        forceServerSync: true,
        updateAddress: true,
      );
      _startRealtimeLocationTracking();
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
                  Icon(Icons.location_on,size: 100.px,color: primaryColor,),
                  SizedBox(
                    height: 20.px,
                  ),
                  Text(
                    StringConstants.enableLocation, style: MyTextStyle.titleStyle20bb,),
                  SizedBox(
                    height: 10.px,
                  ),
                  Text(
                    StringConstants
                        .toUseThisServicesWeNeedPermissionToAccess,
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
                      CommonWidgets.snackBarView(title:
                      'Without location permission you can not use app...',success: false);
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
                        StringConstants.cancel, style: MyTextStyle.titleStyle16bw,),
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
          final latValue = location["lat"];
          final lngValue = location["lng"];
          final selectedMapLocation = LatLng(latValue, lngValue);

          print("Lat: $latValue, Lng: $lngValue");

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
        Map<String, dynamic> bodyParams = {
          ApiKeyConstants.lat:lat.value,
          ApiKeyConstants.long:lon.value,
        };
        SimpleResponseModel? simpleResponseModel =
        await ApiMethods.driverUpdateLocationApi(bodyParams: bodyParams);
        if (simpleResponseModel != null && simpleResponseModel.success != null &&
            simpleResponseModel.success! ) {
          print('update location successfully completed....');
          return true;
          } else {
          if (showError) {
            CommonWidgets.snackBarView(title: simpleResponseModel?.message??'Current location Failed ...');
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
    try {
        Map<String, dynamic> bodyParams = {
          ApiKeyConstants.isOnline:isGoOnline.value,
        };
        showLoading.value=true;
        SimpleResponseModel? simpleResponseModel =
        await ApiMethods.driverUpdateOnlineStatusApi(bodyParams: bodyParams);
        if (simpleResponseModel != null && simpleResponseModel.success != null &&
            simpleResponseModel.success! ) {
          print('update online status successfully completed....');
          isGoOnline.value=!isGoOnline.value;
          
          // Start/Stop socket location updates based on online status
          if (_isDriverOnline) {
            // Driver is now online - start emitting location
            _startLocationUpdates();
            _syncDriverLocationToServer(force: true);
          } else {
            // Driver is now offline - stop emitting location
            _stopLocationUpdates();
          }
          } else {
          CommonWidgets.snackBarView(title: simpleResponseModel?.message??'Current location Failed ...');
        }
      } catch (e) {
        CommonWidgets.snackBarView(title: 'Somethings wrong...');
      }
    showLoading.value=false;

  }
  Future<void> callingGetDriverDetails() async {
    print('start driver details.......');
    try {
        SharedPreferences pref=await SharedPreferences.getInstance();
       String driverId=pref.getString(ApiKeyConstants.userId)??'';
        AddDriverDetailModel? loginModel =
        await ApiMethods.getDriverDetailsApi(driverId: driverId);
        if (loginModel != null && loginModel.success != null &&
            loginModel.success! && loginModel.driver!=null ) {
          print('get driver details successfully completed....');
          userData.value = {
            ApiKeyConstants.phone:loginModel.driver!.phone??'',
            ApiKeyConstants.countryCode:loginModel.driver!.countryCode??'',
            ApiKeyConstants.profileImage:loginModel.driver!.profileImageUrl??'',
            ApiKeyConstants.fullName:loginModel.driver!.fullName??'',
            ApiKeyConstants.type:ApiKeyConstants.driver,
          };
          
          // Store driver info for socket location updates
          _driverId = driverId;
          _driverName = loginModel.driver!.fullName ?? '';
          _vehicleType = loginModel.driver!.vehicleType ?? '';
          _city = loginModel.driver!.city ?? '';
          
           if(loginModel.driver!.isOnline??false){
             isGoOnline.value=false;
             // Driver is online - start location updates
             _startLocationUpdates();
             _syncDriverLocationToServer(force: true);
           }else{
             isGoOnline.value=true;
           }
           if(!(loginModel.driver!.isApproved??false)){
             pref.clear();
             Get.offNamedUntil(Routes.SPLASH, (routes)=>false);
           }
          } else {
          CommonWidgets.snackBarView(title: loginModel?.message??'Get driver data Failed ...');
        }
      } catch (e) {
        CommonWidgets.snackBarView(title: 'Somethings wrong...');
      }

  }
}
