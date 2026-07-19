import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../../../common/api_interceptor_client.dart';
import 'api_constants/api_key_constants.dart';

class CommunicationApiException implements Exception {
  const CommunicationApiException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  @override
  String toString() => message;
}

class CommunicationApiClient {
  CommunicationApiClient({http.Client? client})
      : _client = client ?? ApiInterceptorClient();

  final http.Client _client;

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
  ]) =>
      _send('PATCH', url, body: body);

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
    final http.Response response = switch (method) {
      'GET' => await _client.get(uri, headers: headers),
      'PATCH' => await _client.patch(
          uri,
          headers: headers,
          body: jsonEncode(body ?? const <String, dynamic>{}),
        ),
      _ => await _client.post(
          uri,
          headers: headers,
          body: jsonEncode(body ?? const <String, dynamic>{}),
        ),
    };

    final dynamic decoded = response.body.trim().isEmpty
        ? <String, dynamic>{}
        : jsonDecode(response.body);
    final Map<String, dynamic> payload = decoded is Map
        ? Map<String, dynamic>.from(decoded)
        : <String, dynamic>{};
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw CommunicationApiException(
        (payload['message'] ?? 'Unable to complete this action.').toString(),
        statusCode: response.statusCode,
      );
    }
    return payload;
  }
}
