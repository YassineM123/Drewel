import 'dart:async';
import 'dart:convert';
import 'dart:io' show SocketException;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_map/flutter_map.dart' show MapController;
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:google_places_flutter/model/prediction.dart';
import 'package:http/http.dart' as http;
import 'package:latlong2/latlong.dart' as latlong;

import '../../../../common/colors.dart';
import '../../../../common/drewel_osm_map.dart';
import '../../../../common/motion.dart';
import '../../../data/apis/api_constants/api_key_constants.dart';
import '../../../data/config/app_config.dart';

class TripRouteRequest {
  const TripRouteRequest({required this.pickup, required this.destination});

  final Map<String, dynamic> pickup;
  final Map<String, dynamic> destination;
}

enum _TripPointMode { pickup, destination }

/// A short, passenger-owned map flow. The fresh GPS fix seeds pickup, but the
/// passenger can move both pickup and destination before sending the request.
Future<TripRouteRequest?> showTripRequestMapSheet(
  BuildContext context, {
  required LatLng pickup,
  required String pickupAddress,
}) {
  return showModalBottomSheet<TripRouteRequest>(
    context: context,
    isScrollControlled: true,
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
  static const int _searchDebounceMs = 350;
  static const double _mapZoom = 15;
  static const Duration _placesHttpTimeout = Duration(seconds: 10);

  final TextEditingController _searchController = TextEditingController();
  final FocusNode _searchFocusNode = FocusNode();
  final MapController _osmMapController = MapController();

  GoogleMapController? _googleMapController;
  Timer? _searchDebounce;
  int _searchRequestId = 0;

  late LatLng _selectedPickup;
  late String _pickupAddress;
  LatLng? _destination;
  String _destinationAddress = '';
  _TripPointMode _mode = _TripPointMode.destination;
  bool _isSearching = false;
  String _searchError = '';
  List<Prediction> _suggestions = <Prediction>[];

  bool get _editingPickup => _mode == _TripPointMode.pickup;

  @override
  void initState() {
    super.initState();
    _selectedPickup = widget.pickup;
    _pickupAddress = widget.pickupAddress.trim();
    _searchFocusNode.addListener(() {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _googleMapController?.dispose();
    _searchController.dispose();
    _searchFocusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * .82,
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
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  const Text(
                    'Request a trip',
                    style: TextStyle(fontSize: 21, fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 10),
                  _buildModeSelector(),
                  const SizedBox(height: 12),
                  _buildSearch(),
                  const SizedBox(height: 12),
                  _RouteLine(
                    icon: Icons.radio_button_checked_rounded,
                    label: 'PICKUP',
                    active: _editingPickup,
                    value: _editingPickup
                        ? 'Move pickup on the map or search'
                        : _pickupAddress.isEmpty
                            ? 'Pickup pinned'
                            : _pickupAddress,
                  ),
                  _RouteLine(
                    icon: Icons.location_on_rounded,
                    label: 'DESTINATION',
                    active: !_editingPickup,
                    value: _destination == null
                        ? 'Search or tap the map to choose destination'
                        : _destinationAddress.isEmpty
                            ? 'Pinned destination'
                            : _destinationAddress,
                  ),
                ],
              ),
            ),
            Expanded(child: _buildMap()),
            Padding(
              padding: const EdgeInsets.all(16),
              child: SizedBox(
                width: double.infinity,
                height: 52,
                child: AnimatedPressable(
                  onTap: _destination == null ? null : _submit,
                  child: FilledButton(
                    style:
                        FilledButton.styleFrom(backgroundColor: primaryColor),
                    onPressed: _destination == null ? null : _submit,
                    child: const Text('Send trip request'),
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
    return SegmentedButton<_TripPointMode>(
      segments: const <ButtonSegment<_TripPointMode>>[
        ButtonSegment<_TripPointMode>(
          value: _TripPointMode.pickup,
          icon: Icon(Icons.my_location_rounded),
          label: Text('Pickup'),
        ),
        ButtonSegment<_TripPointMode>(
          value: _TripPointMode.destination,
          icon: Icon(Icons.location_on_rounded),
          label: Text('Destination'),
        ),
      ],
      selected: <_TripPointMode>{_mode},
      onSelectionChanged: (Set<_TripPointMode> value) {
        setState(() {
          _mode = value.first;
          _clearSearch(clearText: true);
        });
        _moveCamera(_editingPickup ? _selectedPickup : _destination);
      },
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
          height: 48,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: _searchFocusNode.hasFocus
                  ? primaryColor
                  : Colors.black.withValues(alpha: 0.1),
              width: _searchFocusNode.hasFocus ? 1.4 : 1,
            ),
            boxShadow: <BoxShadow>[
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.08),
                blurRadius: 14,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Row(
            children: <Widget>[
              const SizedBox(width: 12),
              Icon(
                Icons.search_rounded,
                color: _searchFocusNode.hasFocus ? primaryColor : text2Color,
                size: 22,
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
                        ? 'Search pickup location'
                        : 'Search destination',
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    isDense: true,
                    contentPadding: EdgeInsets.zero,
                    hintStyle: const TextStyle(color: hintColor),
                  ),
                ),
              ),
              if (hasText)
                IconButton(
                  visualDensity: VisualDensity.compact,
                  icon: const Icon(Icons.close_rounded, size: 20),
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
        message: 'No locations found',
      );
    } else {
      content = ListView.builder(
        shrinkWrap: true,
        padding: const EdgeInsets.symmetric(vertical: 4),
        itemCount: _suggestions.length,
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
            leading: const Icon(Icons.location_on_rounded, color: primaryColor),
            title: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis),
            subtitle: subtitle.isEmpty
                ? null
                : Text(
                    subtitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
            onTap: () => _selectSuggestion(prediction),
          );
        },
      );
    }

    return FadeSlideIn(
      offsetY: 6,
      child: Container(
        margin: const EdgeInsets.only(top: 8),
        constraints: const BoxConstraints(maxHeight: 230),
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          boxShadow: <BoxShadow>[
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.12),
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
        markers: <DrewelOsmMarker>[
          DrewelOsmMarker(
            id: 'pickup',
            position: _selectedPickup,
            child: const Icon(
              Icons.radio_button_checked,
              color: Colors.green,
              size: 36,
            ),
          ),
          if (_destination != null)
            DrewelOsmMarker(
              id: 'destination',
              position: _destination!,
              child: const Icon(
                Icons.location_on,
                color: primaryColor,
                size: 40,
              ),
            ),
        ],
      );
    }

    return GoogleMap(
      initialCameraPosition: CameraPosition(
        target: effectiveCenter,
        zoom: _mapZoom,
      ),
      compassEnabled: false,
      mapToolbarEnabled: false,
      myLocationButtonEnabled: false,
      zoomControlsEnabled: false,
      onMapCreated: (GoogleMapController controller) {
        _googleMapController = controller;
      },
      onTap: _selectPointFromMap,
      markers: <Marker>{
        Marker(
          markerId: const MarkerId('pickup'),
          position: _selectedPickup,
          icon: BitmapDescriptor.defaultMarkerWithHue(
            BitmapDescriptor.hueGreen,
          ),
        ),
        if (_destination != null)
          Marker(
            markerId: const MarkerId('destination'),
            position: _destination!,
          ),
      },
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

  Future<http.Response?> _getWithTimeout(
    Uri uri, {
    void Function(String message)? onError,
  }) async {
    try {
      return await http.get(uri).timeout(_placesHttpTimeout);
    } on TimeoutException {
      onError?.call('Search timed out. Check your connection and try again.');
    } on SocketException {
      onError?.call('No internet connection. Check your network and try again.');
    } catch (_) {
      onError?.call('Unable to find locations. Try again.');
    }
    return null;
  }

  Future<void> _fetchSuggestions(String query, int requestId) async {
    final Uri uri = Uri.https(
      'maps.googleapis.com',
      '/maps/api/place/autocomplete/json',
      <String, String>{
        'input': query,
        'key': ApiKeyConstants.googleMapKey,
        'language': 'en',
        'components': 'country:${AppConfig.marketplaceCountryCode}',
      },
    );

    String? failureMessage;
    final http.Response? response = await _getWithTimeout(
      uri,
      onError: (String message) => failureMessage = message,
    );
    if (!mounted || requestId != _searchRequestId) return;

    if (response == null) {
      _setSearchFailure(failureMessage ?? 'Unable to find locations. Try again.');
      return;
    }

    if (response.statusCode != 200) {
      _setSearchFailure('Unable to find locations. Try again.');
      return;
    }

    final Map<String, dynamic> data =
        json.decode(response.body) as Map<String, dynamic>;
    final String status = data['status']?.toString() ?? '';
    if (status == 'OK') {
      final List<dynamic> predictions = data['predictions'] as List<dynamic>;
      setState(() {
        _suggestions = predictions
            .map((dynamic value) => Prediction.fromJson(value))
            .toList(growable: false);
        _searchError = '';
        _isSearching = false;
      });
    } else if (status == 'ZERO_RESULTS') {
      setState(() {
        _suggestions = <Prediction>[];
        _searchError = '';
        _isSearching = false;
      });
    } else {
      _setSearchFailure(
        status == 'REQUEST_DENIED'
            ? 'Location search is temporarily unavailable.'
            : 'Unable to find locations. Try again.',
      );
    }
  }

  Future<void> _selectSuggestion(Prediction prediction) async {
    final String? placeId = prediction.placeId;
    if (placeId == null || placeId.isEmpty) return;

    setState(() {
      _isSearching = true;
      _searchError = '';
    });

    try {
      final Uri uri = Uri.https(
        'maps.googleapis.com',
        '/maps/api/place/details/json',
        <String, String>{
          'place_id': placeId,
          'key': ApiKeyConstants.googleMapKey,
          'fields': 'formatted_address,geometry,name',
          'language': 'en',
        },
      );
      String? failureMessage;
      final http.Response? response = await _getWithTimeout(
        uri,
        onError: (String message) => failureMessage = message,
      );
      if (!mounted) return;

      if (response == null) {
        _setSearchFailure(failureMessage ?? 'Unable to open this location.');
        return;
      }

      if (response.statusCode != 200) {
        _setSearchFailure('Unable to open this location.');
        return;
      }

      final Map<String, dynamic> data =
          json.decode(response.body) as Map<String, dynamic>;
      if (data['status'] != 'OK') {
        _setSearchFailure('Unable to open this location.');
        return;
      }

      final Map<String, dynamic> result =
          data['result'] as Map<String, dynamic>;
      final Map<String, dynamic> geometry =
          result['geometry'] as Map<String, dynamic>;
      final Map<String, dynamic> location =
          geometry['location'] as Map<String, dynamic>;
      final LatLng point = LatLng(
        (location['lat'] as num).toDouble(),
        (location['lng'] as num).toDouble(),
      );
      final String address = (result['formatted_address'] ??
              prediction.description ??
              result['name'] ??
              '')
          .toString()
          .trim();

      _applySelectedPoint(point, address);
      _searchFocusNode.unfocus();
      _searchController.clear();
      _clearSearch(clearText: false);
      await _moveCamera(point);
    } catch (_) {
      if (!mounted) return;
      _setSearchFailure('Unable to open this location.');
    }
  }

  void _selectPointFromMap(LatLng point) {
    _applySelectedPoint(point, _editingPickup ? 'Pinned pickup' : '');
    _moveCamera(point);
  }

  void _applySelectedPoint(LatLng point, String address) {
    setState(() {
      if (_editingPickup) {
        _selectedPickup = point;
        _pickupAddress = address.isEmpty ? 'Pinned pickup' : address;
      } else {
        _destination = point;
        _destinationAddress = address;
      }
    });
  }

  Future<void> _moveCamera(LatLng? point) async {
    if (point == null) return;
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

  void _setSearchFailure(String message) {
    setState(() {
      _suggestions = <Prediction>[];
      _searchError = message;
      _isSearching = false;
    });
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
    final LatLng destination = _destination!;
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

class _SearchStatus extends StatelessWidget {
  const _SearchStatus({required this.icon, required this.message});

  final Widget icon;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
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
              style: TextStyle(color: Colors.black.withValues(alpha: 0.58)),
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
    required this.label,
    required this.value,
    this.active = false,
  });

  final IconData icon;
  final String label;
  final String value;
  final bool active;

  @override
  Widget build(BuildContext context) => AnimatedContainer(
        duration: MotionDuration.normal,
        curve: MotionCurve.standard,
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: active ? primaryColor.withValues(alpha: 0.07) : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: active
                ? primaryColor.withValues(alpha: 0.28)
                : Colors.transparent,
          ),
        ),
        child: Row(children: <Widget>[
          Icon(icon, color: active ? primaryColor : text2Color, size: 19),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 10,
                    color: text2Color,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                Text(value, maxLines: 1, overflow: TextOverflow.ellipsis),
              ],
            ),
          ),
        ]),
      );
}
