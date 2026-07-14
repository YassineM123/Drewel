/*GoogleMapController? controller;
Completer<GoogleMapController> controllerCompleter = Completer();
GlobalKey<ScaffoldState> scaffoldKey = GlobalKey();
bool loading=false;
List<carList> car = [];
LatLng initialposition = LatLng(-12.122711, -77.027475);
Set<Marker> markers={};
String butText="Request Now";
LocationData? currentLocation;
LatLng _markerLocation = LatLng(0.0, 0.0);
String location = "Search";
String googleApikey = "";
// LatLng startLocation =  LatLng(22.234,75.24546);
LatLng? endLocation;// Initial marker location
final ValueNotifier<String> address = ValueNotifier<String>('');
final ValueNotifier<LatLng> startLocation = ValueNotifier<LatLng>(LatLng(22.234,75.24546));

void onMapCreated(GoogleMapController controller) {
  controller = controller;
}

void _onMarkerDragEnd(LatLng position) {
  // setState(() {
  _markerLocation = position;
  // });
  print('New Marker Position: $position');
}
getCurrentLocation()async{
  // setState(() {
  loading=true;
  // });
  var location = Location();
  try {
    currentLocation = await location.getLocation();
    print("current location -----------${currentLocation!.latitude}"
        "\n${currentLocation!.longitude}");
    startLocation.value=LatLng(currentLocation!.latitude!,currentLocation!
        .longitude!);
    getAddressFromCoordinates(currentLocation!.latitude!,currentLocation!.longitude!);
    // setState(() {
    _markerLocation=   LatLng(currentLocation!.latitude!,currentLocation!.longitude!);
    markers.add(
      Marker(
        markerId: MarkerId('tapped_location'),
        position: _markerLocation,
        infoWindow: InfoWindow(title: 'Tapped Location'),
      ),
    );
    // });
    // setState(() {
    initialposition = LatLng(currentLocation!.latitude!,currentLocation!.longitude!);

    // });


  } catch (e) {
    // setState(() {
    loading=false;
    // });
    print('Error: $e');
  }
}

Future<void> getAddressFromCoordinates(double latitude, double longitude) async {
  // address='fetching address ...';
  try {
    List<geoCode.Placemark> placemarks = await geoCode
        .placemarkFromCoordinates
      (latitude, longitude);

    if (placemarks != null && placemarks.isNotEmpty) {
      geoCode.Placemark place = placemarks[0];
      // setState(() {
      address.value = "${place.street}, ${place.locality}, ${place
          .postalCode}, ${place.country}";
      loading=false;

      // });
    } else {
      // setState(() {
      address.value = 'No address found';
      loading=false;
      // });
    }
  } catch (e) {
    print('Error: $e');
    // setState(() {
    address.value = 'Failed to get address';
    loading=false;
    // });
  }
}

Future<void> onMapTapped(LatLng location) async {
  await getAddressFromCoordinates(location.latitude, location.longitude) ;

  // setState(()  {

  markers.clear();
  markers.add(
    Marker(
      markerId: MarkerId('tapped_location'),
      position: location,
      infoWindow: InfoWindow(title: 'Tapped Location'),
    ),
  );
  // });
  print('Tapped Location: $location');
}
void addCustomMarker() {
  print("addCustomMarker");
  // Creating a custom marker icon
  BitmapDescriptor.fromAssetImage(
    ImageConfiguration(devicePixelRatio: 2.5),
    'assets/icons/quic_car_.png', // Replace with your custom marker image path
  ).then((BitmapDescriptor customIcon) {
    // setState(() {
    markers.add(
      Marker(
        markerId: MarkerId('custom_marker'),
        position: LatLng(22.7196, 75.8577), // Custom marker position
        icon: customIcon,
        infoWindow: InfoWindow(title: 'Custom Marker'),
      ),
    );
    // });
  });
}*/
