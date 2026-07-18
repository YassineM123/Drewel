import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:drewel/app/data/apis/api_constants/api_key_constants.dart';
import 'package:drewel/app/data/apis/api_models/get_all_driver_model.dart';
import 'package:drewel/app/data/apis/api_models/get_banner_model.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../../../../common/http_methods.dart';
import '../api_constants/api_url_constants.dart';
import '../api_models/get_add_driver_details_model.dart';
import '../api_models/get_login_model.dart';
import '../api_models/get_send_otp_model.dart';
import '../api_models/get_simple_response_model.dart';

class ApiMethods {
  static Map<String, dynamic>? _tryDecodeMap(String body) {
    try {
      final dynamic decoded = jsonDecode(body);
      if (decoded is Map<String, dynamic>) return decoded;
      if (decoded is Map) {
        return Map<String, dynamic>.from(decoded);
      }
    } catch (_) {}
    return null;
  }

  static String _normalizeDriverStatusFromDetails(
      Map<String, dynamic> driverMap) {
    final String status = '${driverMap['status'] ?? ''}'.trim().toLowerCase();
    final bool isApproved = driverMap['isApproved'] == true ||
        '${driverMap['isApproved'] ?? ''}'.trim().toLowerCase() == 'true';
    if (status == ApiKeyConstants.completed) {
      return ApiKeyConstants.completed;
    }
    if (isApproved) return ApiKeyConstants.approvedStatus;
    if (status == ApiKeyConstants.approvedStatus) {
      return ApiKeyConstants.approvedStatus;
    }
    if (status == ApiKeyConstants.rejected) return ApiKeyConstants.rejected;
    if (status == ApiKeyConstants.pending) return ApiKeyConstants.pending;

    return ApiKeyConstants.pending;
  }

  static String _legacyProfileImageKey(String key) {
    switch (key) {
      case 'license_car':
        return 'carLicenseFront';
      case 'license_driver':
        return 'drivingLicenseFront';
      case 'profile_image':
        return 'profileImage';
      case 'id_document':
        return 'idProofFront';
      case 'passport_copy':
        return 'passportCopy';
      default:
        return key;
    }
  }

  static Map<String, dynamic> _legacyCompleteProfileBody(
      Map<String, dynamic> bodyParams) {
    final String firstName =
        '${bodyParams[ApiKeyConstants.firstName] ?? ''}'.trim();
    final String lastName =
        '${bodyParams[ApiKeyConstants.lastName] ?? ''}'.trim();
    final String contractNumber =
        '${bodyParams[ApiKeyConstants.contractNumber] ?? ''}'.trim();
    final String licenseCompany =
        '${bodyParams[ApiKeyConstants.licenseCompanyField] ?? ''}'.trim();
    final String vehicleType =
        '${bodyParams['vehicle_type'] ?? bodyParams[ApiKeyConstants.vehicleType] ?? ''}'
            .trim();

    final Map<String, dynamic> legacyBody = <String, dynamic>{
      ...bodyParams,
      'firstName': firstName,
      'lastName': lastName,
      'fullName': [firstName, lastName]
          .where((String value) => value.isNotEmpty)
          .join(' '),
      'contractNumber': contractNumber,
      'licenseCompany': licenseCompany,
      'vehicleType': vehicleType,
    };

    legacyBody.removeWhere(
      (String key, dynamic value) =>
          value == null || (value is String && value.trim().isEmpty),
    );
    return legacyBody;
  }

  static AddDriverDetailModel _asFailureModel(
      http.Response? response, String fallbackMessage) {
    final Map<String, dynamic>? decoded = _tryDecodeMap(response?.body ?? '');
    if (decoded != null) return AddDriverDetailModel.fromJson(decoded);

    final String body = (response?.body ?? '').trim();
    final String message = body.isNotEmpty
        ? body
        : response != null
            ? '$fallbackMessage (HTTP ${response.statusCode})'
            : fallbackMessage;

    return AddDriverDetailModel(
      success: false,
      message: message,
    );
  }

  /// Login api.....
  static Future<SendOtpModel?> sendOtpApi({
    void Function(int)? checkResponse,
    Map<String, dynamic>? bodyParams,
  }) async {
    SendOtpModel? sendOtpModel;
    http.Response? response = await MyHttp.postMethod(
        bodyParams: bodyParams,
        url: ApiUrlConstants.endPointOfLogin,
        checkResponse: checkResponse,
        wantSnackBar: false);
    if (response != null) {
      sendOtpModel = SendOtpModel.fromJson(jsonDecode(response.body));
      return sendOtpModel;
    }
    return null;
  }

  /// Send whatsapp otp api.....
  static Future<SimpleResponseModel?> sendOtpWhatsAppApi({
    void Function(int)? checkResponse,
    Map<String, dynamic>? bodyParams,
  }) async {
    SimpleResponseModel? simpleResponseModel;
    http.Response? response = await MyHttp.postMethod(
      bodyParams: bodyParams,
      url: ApiUrlConstants.endPointOfSendOtpWhatsapp,
      checkResponse: checkResponse,
      wantSnackBar: false,
      returnResponseOnError: true,
    );
    if (response != null) {
      simpleResponseModel =
          SimpleResponseModel.fromJson(jsonDecode(response.body));
      return simpleResponseModel;
    }
    return null;
  }

  ///  Otp verify api....
  static Future<LoginModel?> otpVerifyApi({
    void Function(int)? checkResponse,
    Map<String, dynamic>? bodyParams,
  }) async {
    LoginModel? loginModel;
    http.Response? response = await MyHttp.postMethod(
      bodyParams: bodyParams,
      url: ApiUrlConstants.endPointOfOtpVerify,
      checkResponse: checkResponse,
    );
    if (response != null) {
      loginModel = LoginModel.fromJson(jsonDecode(response.body));
      return loginModel;
    }
    return null;
  }

  ///  Whatsapp otp verify api....
  static Future<LoginModel?> verifyOtpWhatsAppApi({
    void Function(int)? checkResponse,
    Map<String, dynamic>? bodyParams,
  }) async {
    LoginModel? loginModel;
    http.Response? response = await MyHttp.postMethod(
      bodyParams: bodyParams,
      url: ApiUrlConstants.endPointOfVerifyOtpWhatsapp,
      checkResponse: checkResponse,
    );
    if (response != null) {
      loginModel = LoginModel.fromJson(jsonDecode(response.body));
      return loginModel;
    }
    return null;
  }

  ///  Driver upload details api....
  static Future<AddDriverDetailModel?> driverUploadDetailsApi({
    void Function(int)? checkResponse,
    Map<String, dynamic>? bodyParams,
    required List<File?> imageList,
    required List<String> imageKeyList,
  }) async {
    AddDriverDetailModel? addDriverDetailModel;
    http.Response? response = await MyHttp.myMultipart(
      bodyParams: bodyParams,
      url: ApiUrlConstants.endPointOfDriverAddPersonalDetails,
      imagesKey: imageKeyList,
      images: imageList,
      checkResponse: checkResponse,
    );
    if (response != null) {
      addDriverDetailModel =
          AddDriverDetailModel.fromJson(jsonDecode(response.body));
      return addDriverDetailModel;
    }
    return null;
  }

  /// Driver request step-1
  static Future<AddDriverDetailModel?> driverRequestApi({
    void Function(int)? checkResponse,
    required Map<String, dynamic> bodyParams,
  }) async {
    final http.Response? response = await MyHttp.postMethod(
      bodyParams: bodyParams,
      url: ApiUrlConstants.endPointOfDriverRequest,
      checkResponse: checkResponse,
    );
    if (response != null) {
      final Map<String, dynamic>? decoded = _tryDecodeMap(response.body);
      if (decoded != null) return AddDriverDetailModel.fromJson(decoded);
    }

    // Backward compatibility for deployments that do not expose /driver/request.
    final String firstName =
        '${bodyParams[ApiKeyConstants.firstName] ?? ''}'.trim();
    final String lastName =
        '${bodyParams[ApiKeyConstants.lastName] ?? ''}'.trim();
    final String whatsapp =
        '${bodyParams[ApiKeyConstants.whatsappNumberField] ?? ''}'.trim();
    final Map<String, dynamic> fallbackBody = <String, dynamic>{
      'firstName': firstName,
      'lastName': lastName,
      'whatsappNumber': whatsapp,
      'fullName':
          [firstName, lastName].where((String v) => v.isNotEmpty).join(' '),
    };

    final http.Response? fallbackResponse = await MyHttp.postMethod(
      bodyParams: fallbackBody,
      url: ApiUrlConstants.endPointOfDriverAddPersonalDetails,
      checkResponse: checkResponse,
    );
    if (fallbackResponse != null) {
      final Map<String, dynamic>? decoded =
          _tryDecodeMap(fallbackResponse.body);
      if (decoded != null) return AddDriverDetailModel.fromJson(decoded);
    }

    return null;
  }

  /// Driver status for verification flow
  static Future<Map<String, dynamic>?> getDriverStatusApi({
    void Function(int)? checkResponse,
    required String driverId,
  }) async {
    // Prefer details endpoint because some deployments do not expose /:id/status.
    final http.Response? detailsResponse = await MyHttp.getMethod(
      url: '${ApiUrlConstants.endPointOfDriverDetails}/$driverId',
      checkResponse: checkResponse,
    );
    if (detailsResponse != null) {
      final Map<String, dynamic>? decoded = _tryDecodeMap(detailsResponse.body);
      final Map<String, dynamic>? driverMap = decoded?['driver'] is Map
          ? Map<String, dynamic>.from(decoded?['driver'] as Map)
          : null;
      if (driverMap != null) {
        final String status = _normalizeDriverStatusFromDetails(driverMap);
        return <String, dynamic>{
          'success': true,
          'status': status,
          'profileRequestStatus':
              '${driverMap['profileRequestStatus'] ?? 'not_submitted'}'
                  .trim()
                  .toLowerCase(),
          'profileRejectionReason':
              '${driverMap['profileRejectionReason'] ?? ''}'.trim(),
          ApiKeyConstants.rejectionReason:
              '${driverMap['rejectionReason'] ?? ''}'.trim(),
          'isProfileUnlocked': status == ApiKeyConstants.approvedStatus,
        };
      }
    }

    // Fallback for deployments that provide a dedicated status endpoint.
    final http.Response? response = await MyHttp.getMethod(
      url: '${ApiUrlConstants.endPointOfDriverBase}/$driverId/status',
      checkResponse: checkResponse,
    );
    if (response != null) {
      final Map<String, dynamic>? decoded = _tryDecodeMap(response.body);
      if (decoded != null) {
        if (decoded['profileRequestStatus'] == null &&
            decoded['profile_request_status'] != null) {
          decoded['profileRequestStatus'] = decoded['profile_request_status'];
        }
        if (decoded['profileRejectionReason'] == null &&
            decoded['profile_rejection_reason'] != null) {
          decoded['profileRejectionReason'] =
              decoded['profile_rejection_reason'];
        }
        return decoded;
      }
    }

    return null;
  }

  /// Driver step-3 complete profile
  static Future<AddDriverDetailModel?> completeDriverProfileApi({
    void Function(int)? checkResponse,
    required String driverId,
    required Map<String, dynamic> bodyParams,
    required List<File?> imageList,
    required List<String> imageKeyList,
  }) async {
    final http.Response? response = await MyHttp.myMultipart(
      bodyParams: bodyParams,
      url: '${ApiUrlConstants.endPointOfDriverBase}/$driverId/complete-profile',
      images: imageList,
      imagesKey: imageKeyList,
      checkResponse: checkResponse,
    );

    final Map<String, dynamic>? decoded =
        response != null ? _tryDecodeMap(response.body) : null;
    if (decoded != null && response?.statusCode != 404) {
      return AddDriverDetailModel.fromJson(decoded);
    }

    // Legacy backend compatibility: some deployments do not expose /:id/complete-profile.
    if (response == null || response.statusCode == 404) {
      final List<String> legacyImageKeys =
          imageKeyList.map(_legacyProfileImageKey).toList();
      final Map<String, dynamic> legacyBody =
          _legacyCompleteProfileBody(bodyParams);

      final http.Response? legacyResponse = await MyHttp.myMultipart(
        bodyParams: legacyBody,
        url: ApiUrlConstants.endPointOfDriverAddPersonalDetails,
        images: imageList,
        imagesKey: legacyImageKeys,
        checkResponse: checkResponse,
      );

      final Map<String, dynamic>? legacyDecoded =
          legacyResponse != null ? _tryDecodeMap(legacyResponse.body) : null;
      if (legacyDecoded != null) {
        return AddDriverDetailModel.fromJson(legacyDecoded);
      }

      return _asFailureModel(legacyResponse, 'Failed to submit documents');
    }

    return _asFailureModel(response, 'Failed to submit documents');
  }

  ///  Driver update personal details api....
  static Future<AddDriverDetailModel?> driverUpdateDetailsApi({
    void Function(int)? checkResponse,
    Map<String, dynamic>? bodyParams,
    required List<File?> imageList,
    required List<String> imageKeyList,
  }) async {
    AddDriverDetailModel? addDriverDetailModel;
    http.Response? response = await MyHttp.myMultipart(
      bodyParams: bodyParams,
      url: ApiUrlConstants.endPointOfDriverUpdatePersonalDetails,
      imagesKey: imageKeyList,
      images: imageList,
      checkResponse: checkResponse,
    );
    if (response != null) {
      addDriverDetailModel =
          AddDriverDetailModel.fromJson(jsonDecode(response.body));
      return addDriverDetailModel;
    }
    return null;
  }

  ///  Driver update location api....
  static Future<SimpleResponseModel?> driverUpdateLocationApi({
    void Function(int)? checkResponse,
    Map<String, dynamic>? bodyParams,
  }) async {
    SimpleResponseModel? simpleResponseModel;
    http.Response? response = await MyHttp.postMethod(
        bodyParams: bodyParams,
        url: ApiUrlConstants.endPointOfDriverUpdateLocation,
        checkResponse: checkResponse,
        wantSnackBar: false);
    if (response != null) {
      simpleResponseModel =
          SimpleResponseModel.fromJson(jsonDecode(response.body));
      return simpleResponseModel;
    }
    return null;
  }

  ///  Driver update onlineStatus api....
  static Future<SimpleResponseModel?> driverUpdateOnlineStatusApi({
    void Function(int)? checkResponse,
    Map<String, dynamic>? bodyParams,
  }) async {
    SimpleResponseModel? simpleResponseModel;
    http.Response? response = await MyHttp.postMethod(
        bodyParams: bodyParams,
        url: ApiUrlConstants.endPointOfDriverUpdateOnlineStatus,
        checkResponse: checkResponse,
        wantSnackBar: false);
    if (response != null) {
      simpleResponseModel =
          SimpleResponseModel.fromJson(jsonDecode(response.body));
      return simpleResponseModel;
    }
    return null;
  }

  ///  Driver get details api....
  static Future<AddDriverDetailModel?> getDriverDetailsApi(
      {void Function(int)? checkResponse, required String driverId}) async {
    AddDriverDetailModel? addDriverDetailModel;
    http.Response? response = await MyHttp.getMethod(
      url: '${ApiUrlConstants.endPointOfDriverDetails}/$driverId',
      checkResponse: checkResponse,
    );
    if (response != null) {
      addDriverDetailModel =
          AddDriverDetailModel.fromJson(jsonDecode(response.body));
      return addDriverDetailModel;
    }
    return null;
  }

  ///  User get details api....
  static Future<LoginModel?> getUserDetailsApi(
      {void Function(int)? checkResponse, required String userId}) async {
    LoginModel? loginModel;
    http.Response? response = await MyHttp.getMethod(
      url: '${ApiUrlConstants.endPointOfUserDetails}/$userId',
      checkResponse: checkResponse,
    );
    if (response != null) {
      loginModel = LoginModel.fromJson(jsonDecode(response.body));
      return loginModel;
    }
    return null;
  }

  ///  Get all driver list api....
  static Future<DriverListModel?> getAllDriverListApi(
      {void Function(int)? checkResponse,
      required String city,
      required String vType}) async {
    final Uri uri = Uri.parse(ApiUrlConstants.endPointOfAvailableDrivers)
        .replace(queryParameters: <String, String>{
      if (city.trim().isNotEmpty) ApiKeyConstants.city: city.trim(),
      if (vType.trim().isNotEmpty) ApiKeyConstants.vehicleType: vType.trim(),
    });
    try {
      final SharedPreferences sharedPreferences =
          await SharedPreferences.getInstance();
      final String token =
          sharedPreferences.getString(ApiKeyConstants.token) ?? '';
      final Map<String, String> headers = <String, String>{
        'Authorization': 'Bearer $token',
        'Accept': 'application/json',
      };

      if (kDebugMode) {
        print("URL:: $uri");
        print(
            "[API][HEADERS] {Authorization: <redacted>, Accept: application/json}");
      }

      final http.Response response = await http.get(uri, headers: headers);
      if (kDebugMode) {
        print("[API][RESPONSE] GET $uri status=${response.statusCode}");
      }
      checkResponse?.call(response.statusCode);

      final Map<String, dynamic>? decoded = _tryDecodeMap(response.body);
      if (decoded != null) {
        return DriverListModel.fromJson(decoded);
      }

      return null;
    } catch (e) {
      if (kDebugMode) {
        print("EXCEPTION:: Available drivers request failed: $e");
      }
      return null;
    }
  }

  ///  Get banner list api....
  static Future<BannerModel?> getBannerApi(
      {void Function(int)? checkResponse}) async {
    BannerModel? bannerModel;
    http.Response? response = await MyHttp.getMethod(
      url: ApiUrlConstants.endPointOfGetBanner,
      checkResponse: checkResponse,
    );
    if (response != null) {
      bannerModel = BannerModel.fromJson(jsonDecode(response.body));
      return bannerModel;
    }
    return null;
  }

  ///  Delete user account api....
  static Future<SimpleResponseModel?> deleteUserAccountApi({
    void Function(int)? checkResponse,
    required String userId,
  }) async {
    SimpleResponseModel? simpleResponseModel;
    http.Response? response = await MyHttp.deleteMethod(
      url: '${ApiUrlConstants.endPointOfDeleteUser}/$userId',
      checkResponse: checkResponse,
    );
    if (response != null) {
      simpleResponseModel =
          SimpleResponseModel.fromJson(jsonDecode(response.body));
      return simpleResponseModel;
    }
    return null;
  }

  ///  Delete driver account api....
  static Future<SimpleResponseModel?> deleteDriverAccountApi({
    void Function(int)? checkResponse,
    required String driverId,
  }) async {
    SimpleResponseModel? simpleResponseModel;
    http.Response? response = await MyHttp.deleteMethod(
      url: '${ApiUrlConstants.endPointOfDeleteDriver}/$driverId',
      checkResponse: checkResponse,
    );
    if (response != null) {
      simpleResponseModel =
          SimpleResponseModel.fromJson(jsonDecode(response.body));
      return simpleResponseModel;
    }
    return null;
  }
}
