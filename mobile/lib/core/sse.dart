import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

/// One availability update from the stream.
class Availability {
  const Availability({required this.spotsTaken, required this.capacity, required this.spotsLeft, required this.version});

  final int spotsTaken;
  final int capacity;
  final int spotsLeft;
  final int version;

  factory Availability.fromJson(Map<String, dynamic> j) =>
      Availability(spotsTaken: j['spotsTaken'] as int, capacity: j['capacity'] as int, spotsLeft: j['spotsLeft'] as int, version: j['version'] as int);
}

/// Reads the activity's Server-Sent Events stream with plain http. Reconnects with the retry the server asks for,
/// and reports a heartbeat whose version is newer than what we hold as a gap, so the caller can refetch.
class AvailabilityStream {
  AvailabilityStream({required this.url, required this.onAvailability, required this.onGap, this.onConnected, http.Client? client}) : _client = client ?? http.Client();

  final Uri url;
  final void Function(Availability availability) onAvailability;
  final void Function(int version) onGap;
  final void Function(bool connected)? onConnected;
  final http.Client _client;

  int lastVersion = 0;
  bool _closed = false;
  int _retryMs = 3000;
  StreamSubscription<String>? _subscription;
  Timer? _reconnectTimer;

  void start() {
    _closed = false;
    _connect();
  }

  Future<void> _connect() async {
    if (_closed) return;
    try {
      final request = http.Request('GET', url)..headers['Accept'] = 'text/event-stream';
      final response = await _client.send(request);
      if (response.statusCode != 200) throw http.ClientException('stream ${response.statusCode}');
      onConnected?.call(true);
      var event = 'message';
      var data = StringBuffer();
      _subscription = response.stream.transform(utf8.decoder).transform(const LineSplitter()).listen(
        (line) {
          if (line.isEmpty) {
            _dispatch(event, data.toString());
            event = 'message';
            data = StringBuffer();
          } else if (line.startsWith('event:')) {
            event = line.substring(6).trim();
          } else if (line.startsWith('data:')) {
            data.write(line.substring(5).trim());
          } else if (line.startsWith('retry:')) {
            _retryMs = int.tryParse(line.substring(6).trim()) ?? _retryMs;
          }
        },
        onDone: _scheduleReconnect,
        onError: (_) => _scheduleReconnect(),
        cancelOnError: true,
      );
    } catch (_) {
      _scheduleReconnect();
    }
  }

  void _dispatch(String event, String raw) {
    if (raw.isEmpty) return;
    final json = jsonDecode(raw) as Map<String, dynamic>;
    final version = json['version'] as int;
    if (event == 'availability') {
      if (version <= lastVersion) return;
      lastVersion = version;
      onAvailability(Availability.fromJson(json));
    } else if (event == 'heartbeat' && version > lastVersion) {
      lastVersion = version;
      onGap(version);
    }
  }

  void _scheduleReconnect() {
    onConnected?.call(false);
    _subscription = null;
    if (_closed) return;
    _reconnectTimer = Timer(Duration(milliseconds: _retryMs), _connect);
  }

  void close() {
    _closed = true;
    _reconnectTimer?.cancel();
    _subscription?.cancel();
    _client.close();
  }
}
