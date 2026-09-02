import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart' as google;
import 'package:latlong2/latlong.dart' as osm;

class DrewelOsmMarker {
  const DrewelOsmMarker({
    required this.id,
    required this.position,
    required this.child,
    this.onTap,
    this.width = 48,
    this.height = 48,
  });

  final String id;
  final google.LatLng position;
  final Widget child;
  final VoidCallback? onTap;
  final double width;
  final double height;
}

class DrewelOsmMap extends StatelessWidget {
  const DrewelOsmMap({
    super.key,
    required this.center,
    this.zoom = 12,
    this.mapController,
    this.markers = const <DrewelOsmMarker>[],
    this.polylines = const <List<google.LatLng>>[],
    this.onTap,
    this.onCenterChanged,
  });

  final google.LatLng center;
  final double zoom;
  final MapController? mapController;
  final List<DrewelOsmMarker> markers;
  final List<List<google.LatLng>> polylines;
  final ValueChanged<google.LatLng>? onTap;
  final ValueChanged<google.LatLng>? onCenterChanged;

  osm.LatLng _point(google.LatLng value) =>
      osm.LatLng(value.latitude, value.longitude);

  @override
  Widget build(BuildContext context) => FlutterMap(
        mapController: mapController,
        options: MapOptions(
          initialCenter: _point(center),
          initialZoom: zoom,
          minZoom: 3,
          maxZoom: 19,
          onTap: onTap == null
              ? null
              : (_, osm.LatLng point) =>
                  onTap!(google.LatLng(point.latitude, point.longitude)),
          onPositionChanged: onCenterChanged == null
              ? null
              : (MapCamera camera, bool hasGesture) {
                  if (!hasGesture) return;
                  onCenterChanged!(google.LatLng(
                    camera.center.latitude,
                    camera.center.longitude,
                  ));
                },
        ),
        children: <Widget>[
          TileLayer(
            urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            userAgentPackageName: 'com.drewel',
            maxNativeZoom: 19,
            errorTileCallback: (tile, error, stackTrace) {
              debugPrint('OSM tile failed (${tile.coordinates}): $error');
            },
          ),
          if (polylines.isNotEmpty)
            PolylineLayer(
              polylines: polylines
                  .where((List<google.LatLng> line) => line.length > 1)
                  .map(
                    (List<google.LatLng> line) => Polyline(
                      points: line.map(_point).toList(growable: false),
                      color: Theme.of(context).colorScheme.primary,
                      strokeWidth: 4,
                    ),
                  )
                  .toList(growable: false),
            ),
          MarkerLayer(
            markers: markers
                .map(
                  (DrewelOsmMarker marker) => Marker(
                    key: ValueKey<String>(marker.id),
                    point: _point(marker.position),
                    width: marker.width,
                    height: marker.height,
                    child: GestureDetector(
                      onTap: marker.onTap,
                      child: marker.child,
                    ),
                  ),
                )
                .toList(growable: false),
          ),
          const RichAttributionWidget(
            showFlutterMapAttribution: false,
            attributions: <SourceAttribution>[
              TextSourceAttribution(
                'OpenStreetMap contributors',
              ),
            ],
          ),
        ],
      );
}
