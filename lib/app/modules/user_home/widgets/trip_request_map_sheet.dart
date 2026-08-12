import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

import '../../../../common/colors.dart';
import '../../../../common/drewel_osm_map.dart';

class TripRouteRequest {
  const TripRouteRequest({required this.pickup, required this.destination});

  final Map<String, dynamic> pickup;
  final Map<String, dynamic> destination;
}

/// A short, passenger-owned map flow. The fresh GPS fix seeds pickup, but the
/// passenger can move both pickup and destination before sending the request.
Future<TripRouteRequest?> showTripRequestMapSheet(
  BuildContext context, {
  required LatLng pickup,
  required String pickupAddress,
}) async {
  LatLng selectedPickup = pickup;
  LatLng? destination;
  bool editingPickup = false;
  return showModalBottomSheet<TripRouteRequest>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
    ),
    builder: (BuildContext sheetContext) => StatefulBuilder(
      builder: (BuildContext context, StateSetter setSheetState) => SafeArea(
        child: SizedBox(
          height: MediaQuery.sizeOf(context).height * .78,
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
                      style:
                          TextStyle(fontSize: 21, fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 8),
                    SegmentedButton<bool>(
                      segments: const <ButtonSegment<bool>>[
                        ButtonSegment<bool>(
                          value: true,
                          icon: Icon(Icons.my_location_rounded),
                          label: Text('Pickup'),
                        ),
                        ButtonSegment<bool>(
                          value: false,
                          icon: Icon(Icons.location_on_rounded),
                          label: Text('Destination'),
                        ),
                      ],
                      selected: <bool>{editingPickup},
                      onSelectionChanged: (Set<bool> value) {
                        setSheetState(() => editingPickup = value.first);
                      },
                    ),
                    const SizedBox(height: 10),
                    _RouteLine(
                      icon: Icons.radio_button_checked_rounded,
                      label: 'PICKUP',
                      active: editingPickup,
                      value: editingPickup
                          ? 'Tap the map to move pickup'
                          : pickupAddress.isEmpty
                              ? 'Pickup pinned'
                              : pickupAddress,
                    ),
                    _RouteLine(
                      icon: Icons.location_on_rounded,
                      label: 'DESTINATION',
                      active: !editingPickup,
                      value: destination == null
                          ? 'Tap the map to choose destination'
                          : 'Pinned destination',
                    ),
                  ],
                ),
              ),
              Expanded(
                child: kIsWeb
                    ? DrewelOsmMap(
                        center: editingPickup
                            ? selectedPickup
                            : destination ?? selectedPickup,
                        zoom: 14,
                        onTap: (LatLng position) => setSheetState(() {
                          if (editingPickup) {
                            selectedPickup = position;
                          } else {
                            destination = position;
                          }
                        }),
                        markers: <DrewelOsmMarker>[
                          DrewelOsmMarker(
                            id: 'pickup',
                            position: selectedPickup,
                            child: const Icon(Icons.radio_button_checked,
                                color: Colors.green, size: 36),
                          ),
                          if (destination != null)
                            DrewelOsmMarker(
                              id: 'destination',
                              position: destination!,
                              child: const Icon(Icons.location_on,
                                  color: primaryColor, size: 40),
                            ),
                        ],
                      )
                    : GoogleMap(
                        initialCameraPosition:
                            CameraPosition(target: selectedPickup, zoom: 14),
                        onTap: (LatLng position) => setSheetState(() {
                          if (editingPickup) {
                            selectedPickup = position;
                          } else {
                            destination = position;
                          }
                        }),
                        markers: <Marker>{
                          Marker(
                              markerId: const MarkerId('pickup'),
                              position: selectedPickup,
                              icon: BitmapDescriptor.defaultMarkerWithHue(
                                  BitmapDescriptor.hueGreen)),
                          if (destination != null)
                            Marker(
                                markerId: const MarkerId('destination'),
                                position: destination!),
                        },
                      ),
              ),
              Padding(
                padding: const EdgeInsets.all(16),
                child: SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: FilledButton(
                    style:
                        FilledButton.styleFrom(backgroundColor: primaryColor),
                    onPressed: destination == null
                        ? null
                        : () => Navigator.pop(
                              sheetContext,
                              TripRouteRequest(
                                pickup: <String, dynamic>{
                                  'lat': selectedPickup.latitude,
                                  'long': selectedPickup.longitude,
                                  'address': pickupAddress.isEmpty
                                      ? 'Pinned pickup'
                                      : pickupAddress,
                                },
                                destination: <String, dynamic>{
                                  'lat': destination!.latitude,
                                  'long': destination!.longitude,
                                  'address': 'Pinned destination',
                                },
                              ),
                            ),
                    child: const Text('Send trip request'),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
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
  Widget build(BuildContext context) => Container(
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
