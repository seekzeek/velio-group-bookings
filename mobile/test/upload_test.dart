import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:velio/core/api_client.dart';

// Plain test(), not testWidgets(): the widgets binding replaces HttpClient with one that refuses every request.
void main() {
  test('upload streams one multipart part the backend can parse and reports progress', () async {
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    late List<int> received;
    late String contentType;
    late String? userId;
    server.listen((request) async {
      contentType = request.headers.contentType.toString();
      userId = request.headers.value('x-user-id');
      received = await request.fold<List<int>>([], (acc, chunk) => acc..addAll(chunk));
      request.response
        ..statusCode = 201
        ..headers.contentType = ContentType.json
        ..write(jsonEncode({'photo': {'id': 'p1', 'url': 'http://x/uploads/p1.png', 'position': 0}}))
        ..close();
    });

    final bytes = Uint8List.fromList(List.generate(300 * 1024, (i) => i % 251));
    final progress = <double>[];
    final client = ApiClient(baseUrl: 'http://127.0.0.1:${server.port}', userIdProvider: () => 'host-1');
    final json = await client.upload('/activities/a/photos', field: 'photo', filename: 'cover.png', bytes: bytes, contentType: 'image/png', onProgress: progress.add);
    await server.close();

    expect((json['photo'] as Map)['id'], 'p1');
    expect(userId, 'host-1');
    expect(contentType, startsWith('multipart/form-data; boundary=velio'));

    final boundary = contentType.split('boundary=').last;
    final text = latin1.decode(received);
    expect(text, startsWith('--$boundary\r\nContent-Disposition: form-data; name="photo"; filename="cover.png"\r\nContent-Type: image/png\r\n\r\n'));
    expect(text, endsWith('\r\n--$boundary--\r\n'));
    final start = text.indexOf('\r\n\r\n') + 4;
    expect(received.sublist(start, start + bytes.length), bytes);

    expect(progress.length, greaterThan(3));
    expect(progress.last, closeTo(1, 0.01));
    expect(progress, orderedEquals([...progress]..sort()));
  });
}
