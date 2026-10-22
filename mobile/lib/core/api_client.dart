import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import 'config.dart';
import 'errors.dart';

/// Thin HTTP client for the backend. Adds the identity header, decodes the error
/// envelope into [ApiException], and turns connection failures into [ApiErrorCode.offline].
class ApiClient {
  ApiClient({http.Client? httpClient, String? baseUrl, this.userIdProvider})
      : _http = httpClient ?? http.Client(),
        baseUrl = baseUrl ?? AppConfig.apiBaseUrl;

  final http.Client _http;
  final String baseUrl;
  final String? Function()? userIdProvider;

  static const _timeout = Duration(seconds: 12);

  Uri uri(String path, [Map<String, String>? query]) => Uri.parse('$baseUrl$path').replace(queryParameters: query);

  Map<String, String> headers({bool json = false}) {
    final userId = userIdProvider?.call();
    return {
      'Accept': 'application/json',
      if (json) 'Content-Type': 'application/json',
      if (userId != null && userId.isNotEmpty) 'x-user-id': userId,
    };
  }

  Future<Map<String, dynamic>> get(String path, {Map<String, String>? query}) =>
      _send(() => _http.get(uri(path, query), headers: headers()));

  Future<Map<String, dynamic>> post(String path, {Object? body}) =>
      _send(() => _http.post(uri(path), headers: headers(json: body != null), body: body == null ? null : jsonEncode(body)));

  Future<Map<String, dynamic>> patch(String path, {Object? body}) =>
      _send(() => _http.patch(uri(path), headers: headers(json: body != null), body: body == null ? null : jsonEncode(body)));

  Future<Map<String, dynamic>> _send(Future<http.Response> Function() request) async {
    http.Response response;
    try {
      response = await request().timeout(_timeout);
    } on SocketException {
      throw ApiException(ApiErrorCode.offline);
    } on HttpException {
      throw ApiException(ApiErrorCode.tryAgain);
    } on FormatException {
      throw ApiException(ApiErrorCode.tryAgain);
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(ApiErrorCode.offline, message: e.toString());
    }

    if (response.statusCode == 204 || response.body.isEmpty) {
      if (response.statusCode >= 400) throw ApiException(ApiErrorCode.tryAgain, status: response.statusCode);
      return const {};
    }

    final decoded = jsonDecode(utf8.decode(response.bodyBytes));
    final map = decoded is Map<String, dynamic> ? decoded : <String, dynamic>{'data': decoded};
    if (response.statusCode >= 400) {
      final error = map['error'] is Map<String, dynamic> ? map['error'] as Map<String, dynamic> : const <String, dynamic>{};
      throw ApiException(
        ApiErrorCode.fromWire(error['code'] as String?),
        message: error['message'] as String?,
        status: response.statusCode,
        details: error['details'] is Map<String, dynamic> ? error['details'] as Map<String, dynamic> : null,
      );
    }
    return map;
  }

  void close() => _http.close();
}
