import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:geocoding/geocoding.dart' as native_geo;
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:google_places_flutter/model/prediction.dart';
import 'package:http/http.dart' as http;

import '../apis/api_constants/api_key_constants.dart';
import '../config/app_config.dart';

class DrewelLocationSearchService {
  DrewelLocationSearchService._();
  static final DrewelLocationSearchService instance =
      DrewelLocationSearchService._();

  static const Duration _httpTimeout = Duration(seconds: 6);
  static const Map<String, String> _nominatimHeaders = <String, String>{
    'User-Agent': 'DrewelApp/1.0 (contact@drewel.com)',
    'Accept-Language': 'en,fr,ar',
  };

  /// Autocomplete search: tries Google Places first; falls back seamlessly to
  /// OpenStreetMap (Photon / Nominatim) if Google is unavailable or denied.
  Future<List<Prediction>> searchPlaces(
    String query, {
    LatLng? nearLocation,
  }) async {
    final String trimmed = query.trim();
    if (trimmed.length < 2) return <Prediction>[];

    // 1. Try Google Places if key is configured
    final String googleKey = ApiKeyConstants.googleMapKey.trim();
    if (googleKey.isNotEmpty) {
      try {
        final List<Prediction>? googleResults =
            await _searchGooglePlaces(trimmed);
        if (googleResults != null && googleResults.isNotEmpty) {
          return googleResults;
        }
      } catch (e) {
        debugPrint('Google Places search error: $e');
      }
    }

    // 2. Fallback to OpenStreetMap Photon & Nominatim
    try {
      final List<Prediction> osmResults =
          await _searchPhotonOsm(trimmed, nearLocation: nearLocation);
      if (osmResults.isNotEmpty) {
        return osmResults;
      }
    } catch (e) {
      debugPrint('Photon search error: $e');
    }

    try {
      return await _searchNominatim(trimmed);
    } catch (e) {
      debugPrint('Nominatim search error: $e');
      return <Prediction>[];
    }
  }

  /// Search Google Places Autocomplete
  Future<List<Prediction>?> _searchGooglePlaces(String query) async {
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

    final http.Response response = await http.get(uri).timeout(_httpTimeout);
    if (response.statusCode != 200) return null;

    final Map<String, dynamic> data =
        json.decode(response.body) as Map<String, dynamic>;
    final String status = data['status']?.toString() ?? '';

    if (status == 'OK') {
      final List<dynamic> preds = data['predictions'] as List<dynamic>;
      return preds
          .map((dynamic item) => Prediction.fromJson(item))
          .toList(growable: false);
    } else if (status == 'ZERO_RESULTS') {
      return <Prediction>[];
    }
    // Any error status (REQUEST_DENIED, OVER_QUERY_LIMIT, etc.) triggers fallback
    return null;
  }

  /// Search OpenStreetMap via Photon (fast, worldwide, free)
  Future<List<Prediction>> _searchPhotonOsm(
    String query, {
    LatLng? nearLocation,
  }) async {
    final Map<String, String> queryParams = <String, String>{
      'q': query,
      'limit': '10',
      'lang': 'en',
    };
    if (nearLocation != null) {
      queryParams['lat'] = nearLocation.latitude.toString();
      queryParams['lon'] = nearLocation.longitude.toString();
    }

    final Uri uri = Uri.https('photon.komoot.io', '/api/', queryParams);
    final http.Response response = await http.get(uri).timeout(_httpTimeout);
    if (response.statusCode != 200) return <Prediction>[];

    final Map<String, dynamic> data =
        json.decode(utf8.decode(response.bodyBytes)) as Map<String, dynamic>;
    final List<dynamic> features =
        (data['features'] as List<dynamic>?) ?? <dynamic>[];

    final List<Prediction> results = <Prediction>[];
    for (final dynamic f in features) {
      if (f is! Map<String, dynamic>) continue;
      final Map<String, dynamic> props =
          (f['properties'] as Map<String, dynamic>?) ?? <String, dynamic>{};
      final Map<String, dynamic> geom =
          (f['geometry'] as Map<String, dynamic>?) ?? <String, dynamic>{};
      final List<dynamic> coords =
          (geom['coordinates'] as List<dynamic>?) ?? <dynamic>[];

      if (coords.length < 2) continue;
      final double lng = (coords[0] as num).toDouble();
      final double lat = (coords[1] as num).toDouble();

      final String name = (props['name'] ?? props['street'] ?? '').toString();
      if (name.trim().isEmpty) continue;

      final List<String> secondaryParts = <String>[];
      final String street = (props['street'] ?? '').toString().trim();
      final String district = (props['district'] ?? '').toString().trim();
      final String city =
          (props['city'] ?? props['county'] ?? props['state'] ?? '')
              .toString()
              .trim();
      final String country = (props['country'] ?? '').toString().trim();

      if (street.isNotEmpty && street != name) secondaryParts.add(street);
      if (district.isNotEmpty) secondaryParts.add(district);
      if (city.isNotEmpty) secondaryParts.add(city);
      if (country.isNotEmpty) secondaryParts.add(country);

      final String secondaryText = secondaryParts.join(', ');
      final String fullDescription =
          secondaryText.isEmpty ? name : '$name, $secondaryText';

      final Prediction pred = Prediction(
        description: fullDescription,
        placeId: 'osm_${props['osm_id'] ?? name}',
        structuredFormatting: StructuredFormatting(
          mainText: name,
          secondaryText: secondaryText,
        ),
      );
      pred.lat = lat.toString();
      pred.lng = lng.toString();
      results.add(pred);
    }
    return results;
  }

  /// Search OpenStreetMap via Nominatim
  Future<List<Prediction>> _searchNominatim(String query) async {
    final Map<String, String> queryParams = <String, String>{
      'q': query,
      'format': 'json',
      'addressdetails': '1',
      'limit': '10',
    };
    if (AppConfig.marketplaceCountryCode.isNotEmpty) {
      queryParams['countrycodes'] = AppConfig.marketplaceCountryCode;
    }

    final Uri uri =
        Uri.https('nominatim.openstreetmap.org', '/search', queryParams);
    final http.Response response = await http
        .get(uri, headers: _nominatimHeaders)
        .timeout(_httpTimeout);
    if (response.statusCode != 200) return <Prediction>[];

    final List<dynamic> list =
        json.decode(utf8.decode(response.bodyBytes)) as List<dynamic>;
    final List<Prediction> results = <Prediction>[];

    for (final dynamic item in list) {
      if (item is! Map<String, dynamic>) continue;
      final String latStr = item['lat']?.toString() ?? '';
      final String lonStr = item['lon']?.toString() ?? '';
      if (latStr.isEmpty || lonStr.isEmpty) continue;

      final String displayName = item['display_name']?.toString() ?? '';
      final String name = item['name']?.toString() ?? '';
      final String mainText = name.isNotEmpty
          ? name
          : displayName.split(',').first.trim();
      final String secondaryText = displayName.contains(',')
          ? displayName.substring(displayName.indexOf(',') + 1).trim()
          : '';

      final Prediction pred = Prediction(
        description: displayName,
        placeId: 'osm_${item['place_id'] ?? mainText}',
        structuredFormatting: StructuredFormatting(
          mainText: mainText,
          secondaryText: secondaryText,
        ),
      );
      pred.lat = latStr;
      pred.lng = lonStr;
      results.add(pred);
    }
    return results;
  }

  /// Resolve place details (coordinates + formatted address)
  Future<({LatLng point, String address})?> getPlaceDetails(
    Prediction prediction,
  ) async {
    // If coordinates already embedded (Photon/Nominatim), resolve immediately
    if (prediction.lat != null && prediction.lng != null) {
      final double? lat = double.tryParse(prediction.lat!);
      final double? lng = double.tryParse(prediction.lng!);
      if (lat != null && lng != null) {
        return (
          point: LatLng(lat, lng),
          address: prediction.description?.trim().isNotEmpty == true
              ? prediction.description!.trim()
              : (prediction.structuredFormatting?.mainText ?? 'Selected location'),
        );
      }
    }

    final String? placeId = prediction.placeId;
    if (placeId == null || placeId.isEmpty) return null;

    // Google Place Details
    final String googleKey = ApiKeyConstants.googleMapKey.trim();
    if (googleKey.isNotEmpty && !placeId.startsWith('osm_')) {
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
        final http.Response response =
            await http.get(uri).timeout(_httpTimeout);
        if (response.statusCode == 200) {
          final Map<String, dynamic> data =
              json.decode(response.body) as Map<String, dynamic>;
          if (data['status'] == 'OK') {
            final Map<String, dynamic> result =
                data['result'] as Map<String, dynamic>;
            final Map<String, dynamic> geometry =
                result['geometry'] as Map<String, dynamic>;
            final Map<String, dynamic> loc =
                geometry['location'] as Map<String, dynamic>;
            final LatLng point = LatLng(
              (loc['lat'] as num).toDouble(),
              (loc['lng'] as num).toDouble(),
            );
            final String address = (result['formatted_address'] ??
                    prediction.description ??
                    result['name'] ??
                    '')
                .toString()
                .trim();
            return (point: point, address: address);
          }
        }
      } catch (e) {
        debugPrint('Google Place Details error: $e');
      }
    }

    return null;
  }

  /// Reverse geocode coordinates to a readable address
  Future<String?> reverseGeocode(LatLng point) async {
    // 1. Try Google Geocoding API if key is present
    final String googleKey = ApiKeyConstants.googleMapKey.trim();
    if (googleKey.isNotEmpty) {
      try {
        final Uri uri = Uri.https(
          'maps.googleapis.com',
          '/maps/api/geocode/json',
          <String, String>{
            'latlng': '${point.latitude},${point.longitude}',
            'key': ApiKeyConstants.googleMapKey,
            'language': 'en',
          },
        );
        final http.Response response =
            await http.get(uri).timeout(_httpTimeout);
        if (response.statusCode == 200) {
          final Map<String, dynamic> data =
              json.decode(response.body) as Map<String, dynamic>;
          if (data['status'] == 'OK') {
            final List<dynamic> results =
                data['results'] as List<dynamic>? ?? <dynamic>[];
            if (results.isNotEmpty) {
              final String? addr = results[0]['formatted_address']?.toString();
              if (addr != null && addr.trim().isNotEmpty) {
                return addr.trim();
              }
            }
          }
        }
      } catch (e) {
        debugPrint('Google Geocode error: $e');
      }
    }

    // 2. Try Nominatim reverse geocoding
    try {
      final Uri uri = Uri.https(
        'nominatim.openstreetmap.org',
        '/reverse',
        <String, String>{
          'lat': point.latitude.toString(),
          'lon': point.longitude.toString(),
          'format': 'json',
          'addressdetails': '1',
        },
      );
      final http.Response response = await http
          .get(uri, headers: _nominatimHeaders)
          .timeout(_httpTimeout);
      if (response.statusCode == 200) {
        final Map<String, dynamic> data =
            json.decode(utf8.decode(response.bodyBytes)) as Map<String, dynamic>;
        final String? displayName = data['display_name']?.toString();
        if (displayName != null && displayName.trim().isNotEmpty) {
          return _cleanOsmAddress(displayName, data['address'] as Map<String, dynamic>?);
        }
      }
    } catch (e) {
      debugPrint('Nominatim reverse error: $e');
    }

    // 3. Fallback to native geocoding plugin
    try {
      final List<native_geo.Placemark> placemarks =
          await native_geo.placemarkFromCoordinates(
        point.latitude,
        point.longitude,
      );
      if (placemarks.isNotEmpty) {
        final native_geo.Placemark p = placemarks.first;
        final List<String> parts = <String>[];
        if (p.street != null && p.street!.isNotEmpty) parts.add(p.street!);
        if (p.subLocality != null && p.subLocality!.isNotEmpty) {
          parts.add(p.subLocality!);
        }
        if (p.locality != null && p.locality!.isNotEmpty) {
          parts.add(p.locality!);
        }
        if (p.country != null && p.country!.isNotEmpty) parts.add(p.country!);
        if (parts.isNotEmpty) return parts.join(', ');
      }
    } catch (e) {
      debugPrint('Native geocoding error: $e');
    }

    return null;
  }

  static String _cleanOsmAddress(
    String fullAddress,
    Map<String, dynamic>? addressDetails,
  ) {
    if (addressDetails == null) return fullAddress;
    final String road =
        (addressDetails['road'] ?? addressDetails['pedestrian'] ?? '')
            .toString()
            .trim();
    final String suburb = (addressDetails['suburb'] ??
            addressDetails['neighbourhood'] ??
            addressDetails['district'] ??
            '')
        .toString()
        .trim();
    final String city = (addressDetails['city'] ??
            addressDetails['town'] ??
            addressDetails['village'] ??
            addressDetails['state'] ??
            '')
        .toString()
        .trim();
    final String country = (addressDetails['country'] ?? '').toString().trim();

    final List<String> parts = <String>[];
    if (road.isNotEmpty) parts.add(road);
    if (suburb.isNotEmpty && suburb != road) parts.add(suburb);
    if (city.isNotEmpty) parts.add(city);
    if (country.isNotEmpty) parts.add(country);

    return parts.isNotEmpty ? parts.join(', ') : fullAddress;
  }
}
