import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_map/flutter_map.dart' show MapController;
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:google_places_flutter/model/prediction.dart';
import 'package:latlong2/latlong.dart' as latlong;

import '../../../../common/colors.dart';
import '../../../../common/drewel_osm_map.dart';
import '../../../../common/motion.dart';
import '../../../data/config/app_config.dart';
import '../../../data/services/location_search_service.dart';

class TripRouteRequest {
  const TripRouteRequest({required this.pickup, required this.destination});

  final Map<String, dynamic> pickup;
  final Map<String, dynamic> destination;
}

enum _TripPointMode { pickup, destination }

/// A modern, passenger-owned map flow. The fresh GPS fix seeds pickup, but the
/// passenger can smoothly move both pickup and destination with fingers on the map
/// (like Uber / InDrive / Google Maps) or search by name.
Future<TripRouteRequest?> showTripRequestMapSheet(
  BuildContext context, {
  required LatLng pickup,
  required String pickupAddress,
}) {
  return showModalBottomSheet<TripRouteRequest>(
    context: context,
    isScrollControlled: true,
    enableDrag: false,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
    ),
    builder: (BuildContext sheetContext) => _TripRequestMapSheet(
      pickup: pickup,
      pickupAddress: pickupAddress,
    ),
  );
}

class _TripRequestMapSheet extends StatefulWidget {
  const _TripRequestMapSheet({
    required this.pickup,
    required this.pickupAddress,
  });

  final LatLng pickup;
  final String pickupAddress;

  @override
  State<_TripRequestMapSheet> createState() => _TripRequestMapSheetState();
}

class _TripRequestMapSheetState extends State<_TripRequestMapSheet> {
  static const int _searchDebounceMs = 300;
  static const double _mapZoom = 15.5;

  final TextEditingController _searchController = TextEditingController();
  final FocusNode _searchFocusNode = FocusNode();
  final MapController _osmMapController = MapController();

  GoogleMapController? _googleMapController;
  Timer? _searchDebounce;
  Timer? _reverseGeocodeDebounce;
  int _searchRequestId = 0;
  int _geocodeRequestId = 0;

  late LatLng _selectedPickup;
  late String _pickupAddress;
  LatLng? _destination;
  String _destinationAddress = '';
  _TripPointMode _mode = _TripPointMode.destination;

  bool _isSearching = false;
  bool _isMovingMap = false;
  bool _isGeocoding = false;
  String _searchError = '';
  List<Prediction> _suggestions = <Prediction>[];
  LatLng? _currentCameraTarget;

  bool get _editingPickup => _mode == _TripPointMode.pickup;

  @override
  void initState() {
    super.initState();
    _selectedPickup = widget.pickup;
    _pickupAddress = widget.pickupAddress.trim();
    _currentCameraTarget = _destination ?? _selectedPickup;
    _searchFocusNode.addListener(() {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _reverseGeocodeDebounce?.cancel();
    _googleMapController?.dispose();
    _searchController.dispose();
    _searchFocusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * .88,
        child: Column(
          children: <Widget>[
            const SizedBox(height: 10),
            Container(
              height: 4,
              width: 42,
              decoration: BoxDecoration(
                color: const Color(0xFFD9D1D3),
                borderRadius: BorderRadius.circular(4),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 14, 20, 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: <Widget>[
                      const Text(
                        'Request a trip',
                        style: TextStyle(
                          fontSize: 21,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      IconButton(
                        visualDensity: VisualDensity.compact,
                        icon: const Icon(Icons.close_rounded, size: 22),
                        onPressed: () => Navigator.pop(context),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  _buildModeSelector(),
                  const SizedBox(height: 10),
                  _buildSearch(),
                  const SizedBox(height: 10),
                  _RouteLine(
                    icon: Icons.radio_button_checked_rounded,
                    iconColor: Colors.green,
                    label: 'PICKUP',
                    active: _editingPickup,
                    value: _editingPickup && _isGeocoding
                        ? 'Pinning pickup location...'
                        : _pickupAddress.isEmpty
                            ? 'Move map or search to choose pickup'
                            : _pickupAddress,
                    onTap: () {
                      if (!_editingPickup) {
                        setState(() {
                          _mode = _TripPointMode.pickup;
                          _clearSearch(clearText: true);
                        });
                        _moveCamera(_selectedPickup);
                      }
                    },
                  ),
                  _RouteLine(
                    icon: Icons.location_on_rounded,
                    iconColor: primaryColor,
                    label: 'DESTINATION',
                    active: !_editingPickup,
                    value: !_editingPickup && _isGeocoding
                        ? 'Pinning destination...'
                        : _destination == null
                            ? 'Move map or search to choose destination'
                            : _destinationAddress.isEmpty
                                ? 'Destination pinned'
                                : _destinationAddress,
                    onTap: () {
                      if (_editingPickup) {
                        setState(() {
                          _mode = _TripPointMode.destination;
                          _clearSearch(clearText: true);
                        });
                        _moveCamera(_destination ?? _selectedPickup);
                      }
                    },
                  ),
                ],
              ),
            ),
            Expanded(
              child: ClipRRect(
                borderRadius:
                    const BorderRadius.vertical(top: Radius.circular(20)),
                child: Stack(
                  alignment: Alignment.center,
                  children: <Widget>[
                    _buildMap(),
                    _buildCenterPinOverlay(),
                    _buildMapControls(),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 14),
              child: SizedBox(
                width: double.infinity,
                height: 52,
                child: AnimatedPressable(
                  onTap: _destination == null ? null : _submit,
                  child: FilledButton(
                    style: FilledButton.styleFrom(
                      backgroundColor: primaryColor,
                      disabledBackgroundColor:
                          primaryColor.withValues(alpha: 0.35),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                    onPressed: _destination == null ? null : _submit,
                    child: Text(
                      _destination == null
                          ? 'Choose destination on map'
                          : 'Send trip request',
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildModeSelector() {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFF3F4F6),
        borderRadius: BorderRadius.circular(12),
      ),
      padding: const EdgeInsets.all(3),
      child: Row(
        children: <Widget>[
          Expanded(
            child: _ModeTabButton(
              title: '1. Pickup',
              icon: Icons.my_location_rounded,
              iconColor: Colors.green,
              isSelected: _editingPickup,
              onTap: () {
                setState(() {
                  _mode = _TripPointMode.pickup;
                  _clearSearch(clearText: true);
                });
                _moveCamera(_selectedPickup);
              },
            ),
          ),
          const SizedBox(width: 4),
          Expanded(
            child: _ModeTabButton(
              title: '2. Destination',
              icon: Icons.location_on_rounded,
              iconColor: primaryColor,
              isSelected: !_editingPickup,
              onTap: () {
                setState(() {
                  _mode = _TripPointMode.destination;
                  _clearSearch(clearText: true);
                });
                _moveCamera(_destination ?? _selectedPickup);
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSearch() {
    final bool hasText = _searchController.text.trim().isNotEmpty;
    final bool showSuggestions = _searchFocusNode.hasFocus && hasText;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          height: 46,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: _searchFocusNode.hasFocus
                  ? primaryColor
                  : Colors.black.withValues(alpha: 0.12),
              width: _searchFocusNode.hasFocus ? 1.5 : 1,
            ),
            boxShadow: <BoxShadow>[
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.06),
                blurRadius: 10,
                offset: const Offset(0, 3),
              ),
            ],
          ),
          child: Row(
            children: <Widget>[
              const SizedBox(width: 12),
              Icon(
                Icons.search_rounded,
                color: _searchFocusNode.hasFocus ? primaryColor : text2Color,
                size: 20,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextField(
                  controller: _searchController,
                  focusNode: _searchFocusNode,
                  textInputAction: TextInputAction.search,
                  onChanged: _onSearchChanged,
                  decoration: InputDecoration(
                    hintText: _editingPickup
                        ? 'Search pickup address / place'
                        : 'Search destination address / place',
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    isDense: true,
                    contentPadding: EdgeInsets.zero,
                    hintStyle: const TextStyle(
                      color: hintColor,
                      fontSize: 14,
                    ),
                  ),
                ),
              ),
              if (hasText)
                IconButton(
                  visualDensity: VisualDensity.compact,
                  icon: const Icon(Icons.close_rounded, size: 18),
                  onPressed: () {
                    setState(() => _clearSearch(clearText: true));
                    _searchFocusNode.requestFocus();
                  },
                ),
              const SizedBox(width: 4),
            ],
          ),
        ),
        if (showSuggestions) _buildSuggestions(),
      ],
    );
  }

  Widget _buildSuggestions() {
    final Widget content;
    if (_isSearching) {
      content = const _SearchStatus(
        icon: SizedBox(
          width: 18,
          height: 18,
          child: CircularProgressIndicator(strokeWidth: 2.2),
        ),
        message: 'Searching locations...',
      );
    } else if (_searchError.isNotEmpty) {
      content = _SearchStatus(
        icon: const Icon(Icons.error_outline_rounded, size: 20),
        message: _searchError,
      );
    } else if (_suggestions.isEmpty) {
      content = const _SearchStatus(
        icon: Icon(Icons.search_off_rounded, size: 20),
        message: 'No locations found. Move the map to place a pin.',
      );
    } else {
      content = ListView.separated(
        shrinkWrap: true,
        padding: const EdgeInsets.symmetric(vertical: 4),
        itemCount: _suggestions.length,
        separatorBuilder: (_, __) =>
            Divider(height: 1, color: Colors.grey.withValues(alpha: 0.15)),
        itemBuilder: (BuildContext context, int index) {
          final Prediction prediction = _suggestions[index];
          final String title =
              prediction.structuredFormatting?.mainText?.trim().isNotEmpty ==
                      true
                  ? prediction.structuredFormatting!.mainText!
                  : prediction.description ?? '';
          final String subtitle =
              prediction.structuredFormatting?.secondaryText ?? '';
          return ListTile(
            dense: true,
            leading: Icon(
              Icons.location_on_rounded,
              color: _editingPickup ? Colors.green : primaryColor,
            ),
            title: Text(
              title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
            ),
            subtitle: subtitle.isEmpty
                ? null
                : Text(
                    subtitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 11, color: text2Color),
                  ),
            onTap: () => _selectSuggestion(prediction),
          );
        },
      );
    }

    return FadeSlideIn(
      offsetY: 6,
      child: Container(
        margin: const EdgeInsets.only(top: 6),
        constraints: const BoxConstraints(maxHeight: 220),
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          boxShadow: <BoxShadow>[
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.15),
              blurRadius: 18,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: content,
      ),
    );
  }

  Widget _buildMap() {
    final LatLng effectiveCenter =
        _editingPickup ? _selectedPickup : _destination ?? _selectedPickup;

    if (AppConfig.useOpenStreetMapForCurrentPlatform) {
      return DrewelOsmMap(
        mapController: _osmMapController,
        center: effectiveCenter,
        zoom: _mapZoom,
        onTap: _selectPointFromMap,
        onCenterChanged: (LatLng center) {
          _currentCameraTarget = center;
          _scheduleReverseGeocode(center);
        },
        markers: <DrewelOsmMarker>[
          if (!_editingPickup)
            DrewelOsmMarker(
              id: 'pickup_pinned',
              position: _selectedPickup,
              child: const Icon(
                Icons.radio_button_checked,
                color: Colors.green,
                size: 34,
              ),
            ),
          if (_editingPickup && _destination != null)
            DrewelOsmMarker(
              id: 'destination_pinned',
              position: _destination!,
              child: const Icon(
                Icons.location_on,
                color: primaryColor,
                size: 38,
              ),
            ),
        ],
      );
    }

    // Google Map with EagerGestureRecognizer for buttery-smooth finger scrolling
    return GoogleMap(
      initialCameraPosition: CameraPosition(
        target: effectiveCenter,
        zoom: _mapZoom,
      ),
      compassEnabled: false,
      mapToolbarEnabled: false,
      myLocationButtonEnabled: false,
      zoomControlsEnabled: false,
      rotateGesturesEnabled: true,
      scrollGesturesEnabled: true,
      zoomGesturesEnabled: true,
      tiltGesturesEnabled: false,
      gestureRecognizers: <Factory<OneSequenceGestureRecognizer>>{
        Factory<OneSequenceGestureRecognizer>(
          () => EagerGestureRecognizer(),
        ),
      },
      onMapCreated: (GoogleMapController controller) {
        _googleMapController = controller;
      },
      onCameraMoveStarted: () {
        if (!_isMovingMap) {
          setState(() => _isMovingMap = true);
        }
      },
      onCameraMove: (CameraPosition position) {
        _currentCameraTarget = position.target;
      },
      onCameraIdle: () {
        if (_isMovingMap) {
          setState(() => _isMovingMap = false);
        }
        if (_currentCameraTarget != null) {
          _scheduleReverseGeocode(_currentCameraTarget!);
        }
      },
      onTap: _selectPointFromMap,
      markers: <Marker>{
        // Show the other point as a pinned marker so passenger sees the full route
        if (!_editingPickup)
          Marker(
            markerId: const MarkerId('pickup_fixed'),
            position: _selectedPickup,
            icon: BitmapDescriptor.defaultMarkerWithHue(
              BitmapDescriptor.hueGreen,
            ),
            infoWindow: InfoWindow(
              title: 'Pickup',
              snippet: _pickupAddress,
            ),
          ),
        if (_editingPickup && _destination != null)
          Marker(
            markerId: const MarkerId('destination_fixed'),
            position: _destination!,
            icon: BitmapDescriptor.defaultMarkerWithHue(
              BitmapDescriptor.hueRose,
            ),
            infoWindow: InfoWindow(
              title: 'Destination',
              snippet: _destinationAddress,
            ),
          ),
      },
    );
  }

  /// Interactive center pin with animated bounce & label badge (Uber/InDrive style)
  Widget _buildCenterPinOverlay() {
    final Color pinColor = _editingPickup ? Colors.green : primaryColor;
    final String label =
        _editingPickup ? 'Move map to set Pickup' : 'Move map to set Destination';

    return IgnorePointer(
      child: Center(
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          transform: Matrix4.translationValues(
            0,
            _isMovingMap ? -18 : -14,
            0,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.black87,
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: <BoxShadow>[
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.2),
                      blurRadius: 6,
                    ),
                  ],
                ),
                child: Text(
                  label,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              const SizedBox(height: 4),
              Icon(
                Icons.location_on_rounded,
                color: pinColor,
                size: _isMovingMap ? 46 : 42,
              ),
              Container(
                width: 7,
                height: 7,
                decoration: BoxDecoration(
                  color: Colors.black45,
                  shape: BoxShape.circle,
                  boxShadow: <BoxShadow>[
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.4),
                      blurRadius: _isMovingMap ? 8 : 4,
                      spreadRadius: _isMovingMap ? 2 : 1,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildMapControls() {
    return Positioned(
      right: 14,
      bottom: 14,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Material(
            color: Colors.white,
            elevation: 4,
            shape: const CircleBorder(),
            child: InkWell(
              customBorder: const CircleBorder(),
              onTap: _recenterOnGps,
              child: const Padding(
                padding: EdgeInsets.all(10),
                child: Icon(
                  Icons.my_location_rounded,
                  color: primaryColor,
                  size: 22,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _onSearchChanged(String rawQuery) {
    _searchDebounce?.cancel();
    final String query = rawQuery.trim();
    _searchRequestId++;

    if (query.length < 2) {
      setState(() => _clearSearch(clearText: false));
      return;
    }

    setState(() {
      _isSearching = true;
      _searchError = '';
      _suggestions = <Prediction>[];
    });

    final int requestId = _searchRequestId;
    _searchDebounce = Timer(
      const Duration(milliseconds: _searchDebounceMs),
      () => _fetchSuggestions(query, requestId),
    );
  }

  Future<void> _fetchSuggestions(String query, int requestId) async {
    final LatLng near = _currentCameraTarget ?? _selectedPickup;
    final List<Prediction> results =
        await DrewelLocationSearchService.instance.searchPlaces(
      query,
      nearLocation: near,
    );

    if (!mounted || requestId != _searchRequestId) return;

    setState(() {
      _isSearching = false;
      _suggestions = results;
      if (results.isEmpty) {
        _searchError = '';
      }
    });
  }

  Future<void> _selectSuggestion(Prediction prediction) async {
    setState(() {
      _isSearching = true;
      _searchError = '';
    });

    final ({LatLng point, String address})? details =
        await DrewelLocationSearchService.instance.getPlaceDetails(prediction);

    if (!mounted) return;

    if (details != null) {
      _applySelectedPoint(details.point, details.address);
      _searchFocusNode.unfocus();
      _searchController.clear();
      _clearSearch(clearText: false);
      await _moveCamera(details.point);
    } else {
      setState(() {
        _isSearching = false;
        _searchError = 'Unable to select this location.';
      });
    }
  }

  void _selectPointFromMap(LatLng point) {
    _applySelectedPoint(point, '');
    _moveCamera(point);
    _scheduleReverseGeocode(point);
  }

  void _scheduleReverseGeocode(LatLng point) {
    _reverseGeocodeDebounce?.cancel();
    _geocodeRequestId++;
    final int currentId = _geocodeRequestId;

    setState(() {
      _isGeocoding = true;
      if (_editingPickup) {
        _selectedPickup = point;
      } else {
        _destination = point;
      }
    });

    _reverseGeocodeDebounce = Timer(const Duration(milliseconds: 400), () async {
      final String? address =
          await DrewelLocationSearchService.instance.reverseGeocode(point);
      if (!mounted || currentId != _geocodeRequestId) return;

      setState(() {
        _isGeocoding = false;
        final String resolved = address?.trim().isNotEmpty == true
            ? address!.trim()
            : (_editingPickup ? 'Pickup pinned' : 'Destination pinned');
        if (_editingPickup) {
          _selectedPickup = point;
          _pickupAddress = resolved;
        } else {
          _destination = point;
          _destinationAddress = resolved;
        }
      });
    });
  }

  void _applySelectedPoint(LatLng point, String address) {
    setState(() {
      if (_editingPickup) {
        _selectedPickup = point;
        _pickupAddress = address.isEmpty ? 'Pickup pinned' : address;
      } else {
        _destination = point;
        _destinationAddress = address.isEmpty ? 'Destination pinned' : address;
      }
    });
  }

  Future<void> _moveCamera(LatLng? point) async {
    if (point == null) return;
    _currentCameraTarget = point;
    if (AppConfig.useOpenStreetMapForCurrentPlatform) {
      _osmMapController.move(
        latlong.LatLng(point.latitude, point.longitude),
        _mapZoom,
      );
      return;
    }
    await _googleMapController?.animateCamera(
      CameraUpdate.newCameraPosition(
        CameraPosition(target: point, zoom: _mapZoom),
      ),
    );
  }

  void _recenterOnGps() {
    HapticFeedback.selectionClick();
    _moveCamera(widget.pickup);
    _scheduleReverseGeocode(widget.pickup);
  }

  void _clearSearch({required bool clearText}) {
    _searchDebounce?.cancel();
    _searchRequestId++;
    if (clearText) _searchController.clear();
    _suggestions = <Prediction>[];
    _searchError = '';
    _isSearching = false;
  }

  void _submit() {
    HapticFeedback.mediumImpact();
    final LatLng destination = _destination ?? _currentCameraTarget ?? _selectedPickup;
    Navigator.pop(
      context,
      TripRouteRequest(
        pickup: <String, dynamic>{
          'lat': _selectedPickup.latitude,
          'long': _selectedPickup.longitude,
          'address': _pickupAddress.isEmpty ? 'Pinned pickup' : _pickupAddress,
        },
        destination: <String, dynamic>{
          'lat': destination.latitude,
          'long': destination.longitude,
          'address': _destinationAddress.isEmpty
              ? 'Pinned destination'
              : _destinationAddress,
        },
      ),
    );
  }
}

class _ModeTabButton extends StatelessWidget {
  const _ModeTabButton({
    required this.title,
    required this.icon,
    required this.iconColor,
    required this.isSelected,
    required this.onTap,
  });

  final String title;
  final IconData icon;
  final Color iconColor;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? Colors.white : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
          boxShadow: isSelected
              ? <BoxShadow>[
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.08),
                    blurRadius: 6,
                    offset: const Offset(0, 2),
                  ),
                ]
              : null,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: <Widget>[
            Icon(icon, color: isSelected ? iconColor : text2Color, size: 16),
            const SizedBox(width: 6),
            Text(
              title,
              style: TextStyle(
                color: isSelected ? Colors.black87 : text2Color,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                fontSize: 12,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SearchStatus extends StatelessWidget {
  const _SearchStatus({required this.icon, required this.message});

  final Widget icon;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: <Widget>[
          IconTheme(
            data: IconThemeData(color: Colors.black.withValues(alpha: 0.45)),
            child: icon,
          ),
          const SizedBox(width: 10),
          Flexible(
            child: Text(
              message,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.black.withValues(alpha: 0.58),
                fontSize: 12,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _RouteLine extends StatelessWidget {
  const _RouteLine({
    required this.icon,
    required this.iconColor,
    required this.label,
    required this.value,
    this.active = false,
    this.onTap,
  });

  final IconData icon;
  final Color iconColor;
  final String label;
  final String value;
  final bool active;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: AnimatedContainer(
          duration: MotionDuration.normal,
          curve: MotionCurve.standard,
          margin: const EdgeInsets.only(bottom: 6),
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
          decoration: BoxDecoration(
            color: active ? iconColor.withValues(alpha: 0.08) : Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: active
                  ? iconColor.withValues(alpha: 0.35)
                  : Colors.grey.withValues(alpha: 0.2),
            ),
          ),
          child: Row(
            children: <Widget>[
              Icon(icon, color: active ? iconColor : text2Color, size: 18),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      label,
                      style: TextStyle(
                        fontSize: 9,
                        color: active ? iconColor : text2Color,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    Text(
                      value,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: active ? FontWeight.w600 : FontWeight.normal,
                      ),
                    ),
                  ],
                ),
              ),
              if (active)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: iconColor.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    'Active',
                    style: TextStyle(
                      color: iconColor,
                      fontSize: 9,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
            ],
          ),
        ),
      );
}
