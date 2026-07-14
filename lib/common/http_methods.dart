import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:http_parser/http_parser.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../app/data/apis/api_constants/api_key_constants.dart';
import 'api_interceptor_client.dart';
import 'common_widgets.dart';

class MyHttp {
  static final http.Client _client = ApiInterceptorClient();
  static const int _minMultipartTimeoutSeconds = 60;
  static const int _maxMultipartTimeoutSeconds = 300;

  static String _guessFileName(String path, {String fallback = 'upload.jpg'}) {
    if (path.trim().isEmpty) return fallback;
    final String withoutQuery = path.split('?').first;
    final List<String> parts = withoutQuery.split(RegExp(r'[\\/]'));
    final String name = parts.isNotEmpty ? parts.last.trim() : '';
    if (name.isEmpty) return fallback;
    if (!name.contains('.')) return '$name.jpg';
    return name;
  }

  static Future<http.MultipartFile> _buildMultipartFile({
    required String field,
    required File file,
  }) async {
    final String fileName = _guessFileName(file.path);
    final String ext = fileName.split('.').last.toLowerCase();
    MediaType? contentType;
    if (ext == 'jpg' || ext == 'jpeg') {
      contentType = MediaType('image', 'jpeg');
    } else if (ext == 'png') {
      contentType = MediaType('image', 'png');
    } else if (ext == 'webp') {
      contentType = MediaType('image', 'webp');
    } else if (ext == 'pdf') {
      contentType = MediaType('application', 'pdf');
    }

    if (kIsWeb) {
      final XFile xFile = XFile(file.path);
      final List<int> bytes = await xFile.readAsBytes();

      return http.MultipartFile.fromBytes(
        field,
        bytes,
        filename: fileName,
        contentType: contentType,
      );
    }
    return http.MultipartFile.fromPath(
      field,
      file.path,
      filename: fileName,
      contentType: contentType,
    );
  }

  static Duration _resolveMultipartTimeout({
    required int fileCount,
    required int fieldCount,
  }) {
    const int baseSeconds = kIsWeb ? 90 : 60;
    const int perFileSeconds = kIsWeb ? 45 : 30;
    const int perFieldSeconds = 2;
    final int computedSeconds = baseSeconds +
        (fileCount * perFileSeconds) +
        (fieldCount * perFieldSeconds);
    final int boundedSeconds = computedSeconds
        .clamp(
          _minMultipartTimeoutSeconds,
          _maxMultipartTimeoutSeconds,
        )
        .toInt();
    return Duration(seconds: boundedSeconds);
  }

  static Future<http.Response?> getMethod(
      {required String url, void Function(int)? checkResponse}) async {
    SharedPreferences sharedPreferences = await SharedPreferences.getInstance();
    String? token = sharedPreferences.getString(ApiKeyConstants.token) ?? '';
    Map<String, String> authorization = {};
    authorization = {
      "Authorization": 'Bearer $token',
      'Accept': 'application/json'
    };
    if (kDebugMode) print("URL:: $url");

    try {
      http.Response? response = await _client.get(
        Uri.parse(url),
        headers: authorization,
      );
      if (kDebugMode) print("CALLING:: ${response.body}");
      if (await CommonWidgets.responseCheckForGetMethod(response: response)) {
        checkResponse?.call(response.statusCode);
        return response;
      } else {
        checkResponse?.call(response.statusCode);
        if (kDebugMode) {
          print(
              "ERROR::statusCode=${response.statusCode}: :response=${response.body}");
        }
        return null;
      }
    } catch (e) {
      if (kDebugMode) print("EXCEPTION:: Server Down $e");
      return null;
    }
  }

  static Future<http.Response?> getMethodParams(
      {required Map<String, dynamic> queryParameters,
      required String baseUri,
      required String endPointUri}) async {
    SharedPreferences sharedPreferences = await SharedPreferences.getInstance();
    String? token = sharedPreferences.getString(ApiKeyConstants.token) ?? '';
    Map<String, String> authorization = {};
    authorization = {"Authorization": token, 'Accept': 'application/json'};
    if (kDebugMode) print("endPointUri:: $endPointUri");
    if (kDebugMode) print("BASEURL:: $baseUri");
    if (await CommonWidgets.internetConnectionCheckerMethod()) {
      try {
        Uri uri = Uri.http(baseUri, endPointUri, queryParameters);
        if (kDebugMode) print("URI:: $uri");
        http.Response? response =
            await _client.get(uri, headers: authorization);
        if (kDebugMode) print("CALLING:: ${response.body}");
        if (await CommonWidgets.responseCheckForGetMethod(
          response: response,
        )) {
          return response;
        } else {
          if (kDebugMode) {
            print(
                "ERROR::statusCode=${response.statusCode}: :response=${response.body}");
          }
          return null;
        }
      } catch (e) {
        if (kDebugMode) print("EXCEPTION:: Server Down");
        return null;
      }
    } else {
      CommonWidgets.networkConnectionShowSnackBar();
      return null;
    }
  }

  static Future<http.Response?> postMethod(
      {required String url,
      bool wantSnackBar = true,
      bool returnResponseOnError = false,
      Map<String, dynamic>? bodyParams,
      void Function(int)? checkResponse}) async {
    SharedPreferences prefs = await SharedPreferences.getInstance();
    String token = prefs.getString(ApiKeyConstants.token) ?? '';
    Map<String, String> authorization = {};
    //Authorization
    authorization = {
      "Authorization": 'Bearer $token',
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };
    if (kDebugMode) print("URL:: $url");
    if (kDebugMode) print("bodyParams:: ${bodyParams ?? {}}");
    if (await CommonWidgets.internetConnectionCheckerMethod()) {
      Future<http.Response?> doPost(http.Client client) async {
        final response = await client.post(
          Uri.parse(url),
          body: jsonEncode(bodyParams ?? <String, dynamic>{}),
          headers: authorization,
        );
        if (kDebugMode) print("CALLING:: ${response.statusCode}");
        if (kDebugMode) print("CALLING:: ${response.body}");
        if (await CommonWidgets.responseCheckForPostMethod(
            response: response, wantSnackBar: wantSnackBar)) {
          checkResponse?.call(response.statusCode);
          return response;
        } else {
          checkResponse?.call(response.statusCode);
          if (kDebugMode) {
            print(
                "ERROR::statusCode=${response.statusCode}: :response=${response.body}");
          }
          return returnResponseOnError ? response : null;
        }
      }

      try {
        return await doPost(_client);
      } on SocketException catch (e) {
        // On Windows, stale pooled connections cause semaphore timeout errors.
        // Retry once with a fresh connection.
        if (kDebugMode) {
          print(
              "EXCEPTION:: SocketException, retrying with fresh connection: $e");
        }
        try {
          final freshClient = ApiInterceptorClient();
          final result = await doPost(freshClient);
          freshClient.close();
          return result;
        } catch (retryError) {
          if (kDebugMode) {
            print("EXCEPTION:: Retry also failed: $retryError");
          }
          return null;
        }
      } catch (e) {
        if (kDebugMode) print("EXCEPTION:: Server Down $e");
        if (kIsWeb && e.toString().contains('Failed to fetch')) {
          if (kDebugMode) {
            print(
                "EXCEPTION:: Possible web CORS block for origin ${Uri.base.origin} on $url");
          }
          CommonWidgets.snackBarView(
            title:
                'Web request blocked. Use localhost:5173 or update backend CORS.',
          );
        }
        return null;
      }
    } else {
      CommonWidgets.networkConnectionShowSnackBar();
      return null;
    }
  }

  static Future<http.Response?> deleteMethod({
    required String url,
    Map<String, dynamic>? bodyParams,
    void Function(int)? checkResponse,
  }) async {
    SharedPreferences prefs = await SharedPreferences.getInstance();
    String token = prefs.getString(ApiKeyConstants.token) ?? '';
    Map<String, String> authorization = {
      "Authorization": 'Bearer $token',
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };
    if (kDebugMode) print("URL:: $url");
    if (kDebugMode) print("bodyParams:: ${bodyParams ?? {}}");
    if (await CommonWidgets.internetConnectionCheckerMethod()) {
      try {
        http.Response? response = await _client.delete(
          Uri.parse(url),
          headers: authorization,
        );
        if (kDebugMode) print("CALLING:: ${response.body}");
        if (await CommonWidgets.responseCheckForPostMethod(
            response: response)) {
          checkResponse?.call(response.statusCode);
          return response;
        } else {
          checkResponse?.call(response.statusCode);
          if (kDebugMode) {
            print(
                "ERROR::statusCode=${response.statusCode}: :response=${response.body}");
          }
          return null;
        }
      } catch (e) {
        if (kDebugMode) print("EXCEPTION:: Server Down $e");
        return null;
      }
    } else {
      CommonWidgets.networkConnectionShowSnackBar();
      return null;
    }
  }

  static Future<http.Response?> multipart(
      {String multipartRequestType = 'POST', // POST or GET
      required String url,
      //Single Image Upload
      File? image,
      String? imageKey,
      Map<String, dynamic>? bodyParams,
      //Upload with Multiple key
      Map<String, File>? imageMap,
      //Upload with Single key
      List<File>? images,
      void Function(int)? checkResponse}) async {
    SharedPreferences prefs = await SharedPreferences.getInstance();
    String token = prefs.getString(ApiKeyConstants.token) ?? '';
    Map<String, String> authorization = {};
    //Authorization
    authorization = {
      "Authorization": 'Bearer $token',
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };
    if (kDebugMode) print("bodyParams:: ${bodyParams ?? {}}");
    if (kDebugMode) print("URL:: $url");
    if (await CommonWidgets.internetConnectionCheckerMethod()) {
      try {
        http.Response res;
        var request =
            http.MultipartRequest(multipartRequestType, Uri.parse(url));
        request.headers.addAll({
          'Content-Type':
              'multipart/form-data; boundary=<calculated when request is sent>'
        });
        request.headers.addAll(authorization);
        // request.headers['Authorization'] = "Bearer ''}";
        if (kDebugMode) print("CALLING:: $url");
        //Single Image Upload
        if (image != null && imageKey != null) {
          if (kDebugMode) print("imageKey:: $imageKey   image::$image");
          request.files.add(getUserProfileImageFile(
              image: image, userProfileImageKey: imageKey));
        }
        //Upload with Multiple key
        if (imageMap != null) {
          if (kDebugMode) print("imageMap:: $imageMap");
          imageMap.forEach((key, value) {
            request.files.add(getUserProfileImageFile(
                image: value, userProfileImageKey: key));
          });
        }
        //Upload with Single key
        if (images != null && imageKey != null) {
          for (int i = 0; i < images.length; i++) {
            request.files.add(getUserProfileImageFile(
                image: images[i], userProfileImageKey: imageKey));
            /*var stream = http.ByteStream(images[i].openRead());
            var length = await images[i].length();
            var multipartFile = http.MultipartFile(imageKey, stream, length,
                filename: images[i].path);
            request.files.add(multipartFile);*/
          }
        }

        if (bodyParams != null) {
          if (kDebugMode) print("bodyParams:: $bodyParams");
          bodyParams.forEach((key, value) {
            request.fields[key] = value;
          });
        }
        var response = await _client.send(request);
        res = await http.Response.fromStream(response);
        if (kDebugMode) print("CALLING:: ${res.body}");
        if (await CommonWidgets.responseCheckForPostMethod(response: res)) {
          checkResponse?.call(response.statusCode);
          return res;
        } else {
          checkResponse?.call(response.statusCode);
          if (kDebugMode) {
            print("ERROR::statusCode=${res.statusCode}: :response=${res.body}");
          }
          return null;
        }
      } catch (e) {
        if (kDebugMode) print("EXCEPTION:: Server Down");
        return null;
      }
    } else {
      return null;
    }
  }

/*
  static Future<http.Response?> myMultipart(
      {String multipartRequestType = 'POST', // POST or GET
      required String url,
      File? image,
      String? imageKey,
      Map<String, dynamic>? bodyParams,
      List< File?>? images,
      List< String>? imagesKey,
      void Function(int)? checkResponse}) async {
    SharedPreferences sharedPreferences = await SharedPreferences.getInstance();
    String? token = sharedPreferences.getString(ApiKeyConstants.token);
    if (kDebugMode) print("bodyParams:: ${bodyParams ?? {}}");
    if (kDebugMode) print("URL:: $url");
    if (await CommonWidgets.internetConnectionCheckerMethod()) {
      try {
        http.Response res;
        var request =
            http.MultipartRequest(multipartRequestType, Uri.parse(url));
        request.headers.addAll({'Content-Type': 'multipart/form-data'});
        request.headers.addAll({'Accept': 'application/json'});
         request.headers['Authorization'] = "Bearer ${token ?? ''}";
        if (kDebugMode) print("CALLING:: $url");
        //Single Image Upload
        if (image != null && imageKey != null) {
          if (kDebugMode) print("imageKey:: $imageKey   image::$image");
          request.files.add(getUserProfileImageFile(
              image: image, userProfileImageKey: imageKey));
        }
        //Upload with Single key
        if (images != null && imagesKey!=null && images.isNotEmpty && images.length==imagesKey.length) {
          for (int i = 0; i < images.length; i++) {
            if(images[i]!=null){
              request.files.add(getUserProfileImageFile(
                  image: images[i], userProfileImageKey: imagesKey[i]));
            }

          }
        }

        if (bodyParams != null) {
          if (kDebugMode) print("bodyParams:: $bodyParams");
          bodyParams.forEach((key, value) {
            request.fields[key] = value;
          });
        }
        var response = await request.send();
        res = await http.Response.fromStream(response);
        if (kDebugMode) print("CALLING:: ${res.body}");
        if (await CommonWidgets.responseCheckForPostMethod(response: res)) {
          checkResponse?.call(response.statusCode);
          return res;
        } else {
          checkResponse?.call(response.statusCode);
          if (kDebugMode) {
            print("ERROR::statusCode=${res.statusCode}: :response=${res.body}");
          }
          return null;
        }
      } catch (e) {
        if (kDebugMode) {
          print("EXCEPTION:: Multipart request failed ::::---${e.toString()}");
        }
        if (kIsWeb &&
            (e.toString().contains('Failed to fetch') ||
                e.toString().contains('XMLHttpRequest error'))) {
          CommonWidgets.snackBarView(
            title:
                'Web upload blocked. Run web on localhost:5173 or allow this origin in backend CORS.',
          );
        }
        return null;
      }
    } else {
      CommonWidgets.networkConnectionShowSnackBar();
      return null;
    }
  }
    */

  static Future<http.Response?> myMultipart({
    String multipartRequestType = 'POST',
    required String url,
    File? image,
    String? imageKey,
    Map<String, dynamic>? bodyParams,
    List<File?>? images,
    List<String>? imagesKey,
    void Function(int)? checkResponse,
  }) async {
    SharedPreferences sharedPreferences = await SharedPreferences.getInstance();
    String? token = sharedPreferences.getString(ApiKeyConstants.token);

    if (kDebugMode) print("bodyParams:: ${bodyParams ?? {}}");
    if (kDebugMode) print("URL:: $url");

    if (await CommonWidgets.internetConnectionCheckerMethod()) {
      try {
        var request =
            http.MultipartRequest(multipartRequestType, Uri.parse(url));

        // ✅ Do not set Content-Type manually
        request.headers.addAll({
          'Accept': 'application/json',
          'Authorization': "Bearer ${token ?? ''}",
        });

        // ✅ Single image
        if (image != null && imageKey != null) {
          request.files.add(
            await _buildMultipartFile(field: imageKey, file: image),
          );
        }

        // ✅ Multiple images
        if (images != null &&
            imagesKey != null &&
            images.isNotEmpty &&
            images.length == imagesKey.length) {
          for (int i = 0; i < images.length; i++) {
            if (images[i] != null) {
              request.files.add(
                await _buildMultipartFile(
                  field: imagesKey[i],
                  file: images[i]!,
                ),
              );
            }
          }
        }

        // ✅ Normal fields
        if (bodyParams != null) {
          bodyParams.forEach((key, value) {
            request.fields[key] = value.toString();
          });
        }

        final Duration multipartTimeout = _resolveMultipartTimeout(
          fileCount: request.files.length,
          fieldCount: request.fields.length,
        );
        if (kDebugMode) {
          print(
            "MULTIPART:: files=${request.files.length}, fields=${request.fields.length}, timeout=${multipartTimeout.inSeconds}s",
          );
        }

        var streamedResponse =
            await _client.send(request).timeout(multipartTimeout);
        var res = await http.Response.fromStream(streamedResponse)
            .timeout(multipartTimeout);

        if (kDebugMode) print("CALLING:: ${res.body}");

        checkResponse?.call(res.statusCode);

        return res;
      } on TimeoutException catch (e) {
        if (kDebugMode) {
          print("EXCEPTION:: Multipart upload timeout ::::---${e.toString()}");
        }
        CommonWidgets.snackBarView(
          title: 'Upload is taking longer than expected. Please try again.',
        );
        return null;
      } catch (e) {
        if (kDebugMode) {
          print("EXCEPTION:: Multipart request failed ::::---${e.toString()}");
        }
        if (kIsWeb &&
            (e.toString().contains('Failed to fetch') ||
                e.toString().contains('XMLHttpRequest error'))) {
          CommonWidgets.snackBarView(
            title:
                'Web upload blocked. Run web on localhost:5173 or allow this origin in backend CORS.',
          );
        }
        return null;
      }
    } else {
      CommonWidgets.networkConnectionShowSnackBar();
      return null;
    }
  }

  static http.MultipartFile getUserProfileImageFile(
      {File? image, required String userProfileImageKey}) {
    if (image == null) {
      throw ArgumentError('Image cannot be null');
    }
    final String fileName = image.uri.pathSegments.last;
    final String ext = fileName.split('.').last.toLowerCase();
    MediaType? contentType;
    if (ext == 'jpg' || ext == 'jpeg') {
      contentType = MediaType('image', 'jpeg');
    } else if (ext == 'png') {
      contentType = MediaType('image', 'png');
    } else if (ext == 'webp') {
      contentType = MediaType('image', 'webp');
    } else if (ext == 'pdf') {
      contentType = MediaType('application', 'pdf');
    }

    return http.MultipartFile.fromBytes(
      userProfileImageKey,
      image.readAsBytesSync(),
      filename: fileName,
      contentType: contentType,
    );
  }
}
