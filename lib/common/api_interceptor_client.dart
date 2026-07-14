import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

class ApiInterceptorClient extends http.BaseClient {
  ApiInterceptorClient({http.Client? innerClient})
      : _innerClient = innerClient ?? http.Client();

  final http.Client _innerClient;

  static const int _maxLogBodyLength = 600;

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    final Stopwatch stopwatch = Stopwatch()..start();
    _logRequest(request);

    try {
      final http.StreamedResponse response = await _innerClient.send(request);
      final List<int> bytes = await response.stream.toBytes();

      _logResponse(
        request: request,
        response: response,
        durationMs: stopwatch.elapsedMilliseconds,
        bodyPreview: _buildResponseBodyPreview(
          bytes: bytes,
          headers: response.headers,
        ),
      );

      return http.StreamedResponse(
        Stream<List<int>>.value(bytes),
        response.statusCode,
        contentLength: bytes.length,
        request: response.request,
        headers: response.headers,
        isRedirect: response.isRedirect,
        persistentConnection: response.persistentConnection,
        reasonPhrase: response.reasonPhrase,
      );
    } catch (error, stackTrace) {
      if (kDebugMode) {
        print(
          '[API][ERROR] ${request.method} ${request.url} '
          'after ${stopwatch.elapsedMilliseconds}ms :: $error',
        );
        print('[API][STACK] $stackTrace');
      }
      rethrow;
    }
  }

  void _logRequest(http.BaseRequest request) {
    if (!kDebugMode) return;

    print('[API][REQUEST] ${request.method} ${request.url}');
    print('[API][HEADERS] ${_maskSensitiveHeaders(request.headers)}');

    final String bodyPreview = _buildRequestBodyPreview(request);
    if (bodyPreview.isNotEmpty) {
      print('[API][BODY] $bodyPreview');
    }
  }

  void _logResponse({
    required http.BaseRequest request,
    required http.StreamedResponse response,
    required int durationMs,
    required String bodyPreview,
  }) {
    if (!kDebugMode) return;

    print(
      '[API][RESPONSE] ${request.method} ${request.url} '
      'status=${response.statusCode} (${durationMs}ms)',
    );

    if (bodyPreview.isNotEmpty) {
      print('[API][RESPONSE BODY] $bodyPreview');
    }
  }

  Map<String, String> _maskSensitiveHeaders(Map<String, String> headers) {
    final Map<String, String> masked = Map<String, String>.from(headers);
    for (final String key in masked.keys.toList()) {
      if (key.toLowerCase() == 'authorization') {
        masked[key] = _maskToken(masked[key] ?? '');
      }
    }
    return masked;
  }

  String _maskToken(String token) {
    if (token.isEmpty) return token;
    if (token.length <= 14) return '***';
    return '${token.substring(0, 10)}...${token.substring(token.length - 4)}';
  }

  String _buildRequestBodyPreview(http.BaseRequest request) {
    if (request is http.Request) {
      return _truncate(request.body);
    }

    if (request is http.MultipartRequest) {
      final Map<String, dynamic> payload = {
        'fields': request.fields,
        'files': request.files
            .map((file) => '${file.field}:${file.filename}')
            .toList(),
      };
      return _truncate(jsonEncode(payload));
    }

    return '';
  }

  String _buildResponseBodyPreview({
    required List<int> bytes,
    required Map<String, String> headers,
  }) {
    if (bytes.isEmpty) return '';

    final String contentType = headers['content-type'] ?? '';
    final bool isProbablyText = contentType.contains('json') ||
        contentType.contains('text') ||
        contentType.contains('xml') ||
        contentType.contains('html');

    if (!isProbablyText) {
      return '<${bytes.length} bytes>';
    }

    final String decoded = utf8.decode(bytes, allowMalformed: true);
    return _truncate(decoded);
  }

  String _truncate(String value) {
    if (value.isEmpty) return value;
    if (value.length <= _maxLogBodyLength) return value;
    return '${value.substring(0, _maxLogBodyLength)}...<truncated>';
  }
}
