import 'dart:convert';
import 'dart:io';

import 'package:drewel/common/http_methods.dart';

import '../apis/api_constants/api_url_constants.dart';
import '../apis/api_models/active_ride_model.dart';
import '../apis/api_models/get_add_driver_details_model.dart';
import '../apis/api_models/passenger_account_models.dart';
import '../apis/communication_api_client.dart';

class DriverAccountRepository {
  DriverAccountRepository(this._api);

  final CommunicationApiClient _api;

  Future<Driver> getDriver(String driverId) async {
    final Map<String, dynamic> response = await _api.get(
      '${ApiUrlConstants.endPointOfDriverDetails}/$driverId',
    );
    final dynamic raw = response['driver'];
    return Driver.fromJson(Map<String, dynamic>.from(raw as Map));
  }

  Future<Driver> updateProfile({
    required String driverId,
    required String firstName,
    required String lastName,
    required String phone,
    required String email,
    required String whatsappNumber,
  }) async {
    final Map<String, dynamic> response = await _api.post(
      ApiUrlConstants.endPointOfDriverUpdatePersonalDetails,
      <String, dynamic>{
        'id': driverId,
        'firstName': firstName,
        'lastName': lastName,
        'fullName': [firstName, lastName]
            .where((String value) => value.trim().isNotEmpty)
            .join(' '),
        'phone': phone,
        if (email.trim().isNotEmpty) 'email': email.trim(),
        if (whatsappNumber.trim().isNotEmpty)
          'whatsappNumber': whatsappNumber.trim(),
      },
    );
    final dynamic raw = response['driver'];
    return Driver.fromJson(Map<String, dynamic>.from(raw as Map));
  }

  Future<String> updateProfilePhoto({
    required String driverId,
    required File file,
  }) async {
    final response = await MyHttp.myMultipart(
      url: ApiUrlConstants.endPointOfDriverUpdatePersonalDetails,
      bodyParams: <String, String>{'id': driverId},
      images: <File?>[file],
      imagesKey: const <String>['profileImage'],
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
    final dynamic raw = payload['driver'];
    final Driver driver =
        Driver.fromJson(Map<String, dynamic>.from(raw as Map));
    return driver.profileImageUrl ?? '';
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

  Future<LegalContentModel> legal(String type, {String language = 'en'}) async {
    try {
      final Map<String, dynamic> response = await _api.get(
          '${ApiUrlConstants.baseUrl}account/legal/$type?language=$language');
      final dynamic raw = response['legal'] ?? response['data'];
      final LegalContentModel legal =
          LegalContentModel.fromJson(Map<String, dynamic>.from(raw as Map));
      return legal.body.trim().isEmpty
          ? LegalContentModel.fallback(type, language: language)
          : legal;
    } on CommunicationApiException catch (error) {
      if (error.statusCode == 404 ||
          error.code == 'API_ROUTE_NOT_FOUND' ||
          error.message.contains('Cannot GET')) {
        return LegalContentModel.fallback(type, language: language);
      }
      rethrow;
    }
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
}
