import 'dart:convert';
import 'dart:io';

import 'package:drewel/common/http_methods.dart';

import '../apis/api_constants/api_url_constants.dart';
import '../apis/api_models/active_ride_model.dart';
import '../apis/api_models/passenger_account_models.dart';
import '../apis/communication_api_client.dart';

class PassengerAccountRepository {
  PassengerAccountRepository(this._api);

  final CommunicationApiClient _api;

  Future<PassengerProfileModel> getProfile() async {
    final Map<String, dynamic> response =
        await _api.get('${ApiUrlConstants.baseUrl}users/get-user');
    final dynamic raw = response['user'] ?? response['data'];
    return PassengerProfileModel.fromJson(
        Map<String, dynamic>.from(raw as Map));
  }

  Future<PassengerProfileModel> updateProfile({
    required String fullName,
    required String phone,
    required String email,
    String? countryCode,
  }) async {
    final Map<String, dynamic> response = await _api.post(
      '${ApiUrlConstants.baseUrl}users/update-profile',
      <String, dynamic>{
        'fullName': fullName,
        'phone': phone,
        if (email.trim().isNotEmpty) 'email': email.trim(),
        if (countryCode?.trim().isNotEmpty == true)
          'countryCode': countryCode!.trim(),
      },
    );
    final dynamic raw = response['user'] ?? response['data'];
    return PassengerProfileModel.fromJson(
        Map<String, dynamic>.from(raw as Map));
  }

  Future<String> updateProfilePhoto(File file) async {
    final response = await MyHttp.myMultipart(
      url: '${ApiUrlConstants.baseUrl}users/add-profile-picture',
      image: file,
      imageKey: 'profilePicture',
    );
    if (response == null) {
      throw const CommunicationApiException('Unable to upload profile photo.');
    }
    final Map<String, dynamic> payload =
        Map<String, dynamic>.from(jsonDecode(response.body) as Map);
    if (response.statusCode < 200 ||
        response.statusCode >= 300 ||
        payload['success'] != true) {
      throw CommunicationApiException(
        '${payload['message'] ?? 'Unable to upload profile photo.'}',
        statusCode: response.statusCode,
        payload: payload,
      );
    }
    return '${payload['profilePicture'] ?? ''}';
  }

  Future<List<SavedPlaceModel>> listSavedPlaces() async {
    final Map<String, dynamic> response =
        await _api.get('${ApiUrlConstants.baseUrl}account/saved-places');
    final List<dynamic> raw = response['places'] as List? ?? const <dynamic>[];
    return raw
        .whereType<Map>()
        .map((Map item) =>
            SavedPlaceModel.fromJson(Map<String, dynamic>.from(item)))
        .toList(growable: false);
  }

  Future<SavedPlaceModel> savePlace({
    String? id,
    required String type,
    required String name,
    required String address,
    required double lat,
    required double long,
    String category = '',
  }) async {
    final String url = id == null || id.isEmpty
        ? '${ApiUrlConstants.baseUrl}account/saved-places'
        : '${ApiUrlConstants.baseUrl}account/saved-places/$id';
    final Map<String, dynamic> response = id == null || id.isEmpty
        ? await _api.post(
            url, _placeBody(type, name, address, lat, long, category))
        : await _api.patch(
            url, _placeBody(type, name, address, lat, long, category));
    final dynamic raw = response['place'] ?? response['data'];
    return SavedPlaceModel.fromJson(Map<String, dynamic>.from(raw as Map));
  }

  Map<String, dynamic> _placeBody(
    String type,
    String name,
    String address,
    double lat,
    double long,
    String category,
  ) =>
      <String, dynamic>{
        'type': type,
        'name': name,
        'address': address,
        'lat': lat,
        'long': long,
        if (category.trim().isNotEmpty) 'category': category.trim(),
      };

  Future<void> deletePlace(String id) async {
    await _api
        .post('${ApiUrlConstants.baseUrl}account/saved-places/$id/delete');
  }

  Future<PassengerPreferenceModel> getPreferences() async {
    final Map<String, dynamic> response =
        await _api.get('${ApiUrlConstants.baseUrl}account/preferences');
    final dynamic raw = response['preferences'] ?? response['data'];
    return PassengerPreferenceModel.fromJson(
      Map<String, dynamic>.from(raw as Map),
    );
  }

  Future<PassengerPreferenceModel> updatePreferences({
    String? language,
    NotificationPreferenceModel? notifications,
  }) async {
    final Map<String, dynamic> response = await _api.patch(
      '${ApiUrlConstants.baseUrl}account/preferences',
      <String, dynamic>{
        if (language != null) 'language': language,
        if (notifications != null) 'notifications': notifications.toJson(),
      },
    );
    final dynamic raw = response['preferences'] ?? response['data'];
    return PassengerPreferenceModel.fromJson(
      Map<String, dynamic>.from(raw as Map),
    );
  }

  Future<List<ActiveRideModel>> listRides() async {
    final Map<String, dynamic> response =
        await _api.get('${ApiUrlConstants.baseUrl}rides/mine?status=all');
    final List<dynamic> raw = response['rides'] as List? ?? const <dynamic>[];
    return raw
        .whereType<Map>()
        .map((Map item) =>
            ActiveRideModel.fromJson(Map<String, dynamic>.from(item)))
        .toList(growable: false);
  }

  Future<List<PassengerCallModel>> listCalls() async {
    final Map<String, dynamic> response =
        await _api.get('${ApiUrlConstants.baseUrl}calls');
    final List<dynamic> raw = response['calls'] as List? ?? const <dynamic>[];
    return raw
        .whereType<Map>()
        .map((Map item) =>
            PassengerCallModel.fromJson(Map<String, dynamic>.from(item)))
        .toList(growable: false);
  }

  Future<void> reportProblem({
    required String category,
    String? rideId,
    required String description,
  }) async {
    await _api.post(
      '${ApiUrlConstants.baseUrl}account/support-reports',
      <String, dynamic>{
        'category': category,
        if (rideId?.trim().isNotEmpty == true) 'rideId': rideId!.trim(),
        'description': description,
      },
    );
  }

  Future<LegalContentModel> legal(String type) async {
    final Map<String, dynamic> response =
        await _api.get('${ApiUrlConstants.baseUrl}account/legal/$type');
    final dynamic raw = response['legal'] ?? response['data'];
    return LegalContentModel.fromJson(Map<String, dynamic>.from(raw as Map));
  }
}
