import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart' show MediaType;
import 'package:shared_preferences/shared_preferences.dart';

import '../../../common/api_interceptor_client.dart';
import 'api_constants/api_key_constants.dart';

class CommunicationApiException implements Exception {
  const CommunicationApiException(
    this.message, {
    this.statusCode,
    this.code,
    this.payload = const <String, dynamic>{},
  });

  final String message;
  final int? statusCode;
  final String? code;
  final Map<String, dynamic> payload;

  @override
  String toString() => message;
}

class CommunicationApiClient {
  CommunicationApiClient({http.Client? client})
      : _client = client ?? ApiInterceptorClient();

  final http.Client _client;
  static const Duration _requestTimeout = Duration(seconds: 20);
  static const Duration _multipartTimeout = Duration(seconds: 75);

  Future<Map<String, dynamic>> get(String url) => _send('GET', url);

  Future<Map<String, dynamic>> post(
    String url, [
    Map<String, dynamic>? body,
    Map<String, String>? extraHeaders,
  ]) =>
      _send('POST', url, body: body, extraHeaders: extraHeaders);

  Future<Map<String, dynamic>> patch(
    String url, [
    Map<String, dynamic>? body,
    Map<String, String>? extraHeaders,
  ]) =>
      _send('PATCH', url, body: body, extraHeaders: extraHeaders);

  /// Multipart upload (voice notes). The file is streamed from disk so a
  /// 2-minute recording never has to be fully resident in memory twice.
  Future<Map<String, dynamic>> postMultipartFile(
    String url, {
    required String fileField,
    required String filePath,
    String? fileName,
    String? contentType,
    Map<String, String> fields = const <String, String>{},
  }) async {
    final SharedPreferences preferences = await SharedPreferences.getInstance();
    final String token =
        preferences.getString(ApiKeyConstants.token)?.trim() ?? '';
    if (token.isEmpty) {
      throw const CommunicationApiException('Authentication required.');
    }
    final Uri uri = Uri.parse(url);
    final http.MultipartRequest request = http.MultipartRequest('POST', uri)
      ..headers['Authorization'] = 'Bearer $token'
      ..headers['Accept'] = 'application/json'
      ..fields.addAll(fields);
    try {
      request.files.add(
        await http.MultipartFile.fromPath(
          fileField,
          filePath,
          filename: fileName,
          contentType:
              contentType == null ? null : MediaType.parse(contentType),
        ),
      );
    } on FormatException {
      throw const CommunicationApiException(
        'The recording could not be read. Please record it again.',
      );
    }
    try {
      final http.StreamedResponse streamedResponse =
          await _client.send(request).timeout(_multipartTimeout);
      final http.Response response =
          await http.Response.fromStream(streamedResponse);
      return _decodeResponse(response);
    } on TimeoutException {
      throw const CommunicationApiException(
        'The voice message upload timed out. Please retry.',
        code: 'REQUEST_TIMEOUT',
      );
    }
  }

  Future<Map<String, dynamic>> _send(
    String method,
    String url, {
    Map<String, dynamic>? body,
    Map<String, String>? extraHeaders,
  }) async {
    final SharedPreferences preferences = await SharedPreferences.getInstance();
    final String token =
        preferences.getString(ApiKeyConstants.token)?.trim() ?? '';
    if (token.isEmpty) {
      throw const CommunicationApiException('Authentication required.');
    }

    final Uri uri = Uri.parse(url);
    final Map<String, String> headers = <String, String>{
      'Authorization': 'Bearer $token',
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...?extraHeaders,
    };
    try {
      final http.Response response = await switch (method) {
        'GET' => _client.get(uri, headers: headers),
        'PATCH' => _client.patch(
            uri,
            headers: headers,
            body: jsonEncode(body ?? const <String, dynamic>{}),
          ),
        _ => _client.post(
            uri,
            headers: headers,
            body: jsonEncode(body ?? const <String, dynamic>{}),
          ),
      }
          .timeout(_requestTimeout);
      return _decodeResponse(response);
    } on TimeoutException {
      throw const CommunicationApiException(
        'The server did not respond in time. Please retry.',
        code: 'REQUEST_TIMEOUT',
      );
    }
  }

  Map<String, dynamic> _decodeResponse(http.Response response) {
    dynamic decoded = <String, dynamic>{};
    if (response.body.trim().isNotEmpty) {
      try {
        decoded = jsonDecode(response.body);
      } on FormatException {
        decoded = <String, dynamic>{};
      }
    }
    final Map<String, dynamic> payload = decoded is Map
        ? Map<String, dynamic>.from(decoded)
        : <String, dynamic>{};
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final String rawMessage = response.body
          .replaceAll(RegExp(r'<[^>]*>'), ' ')
          .replaceAll(RegExp(r'\s+'), ' ')
          .trim();
      // Bare server/framework text (e.g. Express's "Cannot POST /x") is not
      // meant for end users, so it is never surfaced even when short.
      final bool looksLikeFrameworkError =
          RegExp(r'^Cannot (GET|POST|PUT|PATCH|DELETE)\b').hasMatch(rawMessage);
      throw CommunicationApiException(
        (payload['message'] ??
                (rawMessage.isNotEmpty &&
                        rawMessage.length <= 240 &&
                        !looksLikeFrameworkError
                    ? rawMessage
                    : 'Unable to complete this action.'))
            .toString(),
        statusCode: response.statusCode,
        code: payload['code']?.toString(),
        payload: payload,
      );
    }
    if (decoded is! Map) {
      throw CommunicationApiException(
        'The server returned an invalid response.',
        statusCode: response.statusCode,
      );
    }
    return payload;
  }
}
