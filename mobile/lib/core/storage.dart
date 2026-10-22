import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

/// Everything the phone keeps between launches: who you are, an anonymous id for events,
/// the last invite you opened (so it shows offline), and a claim you typed but couldn't send.
class LocalStore {
  LocalStore(this._prefs);

  final SharedPreferences _prefs;

  static const _userId = 'velio.userId';
  static const _anonId = 'velio.anonId';
  static const _invitePrefix = 'velio.invite.';
  static const _activityPrefix = 'velio.activity.';
  static const _pendingClaim = 'velio.pendingClaim';

  static Future<LocalStore> open() async => LocalStore(await SharedPreferences.getInstance());

  String? get userId => _prefs.getString(_userId);
  Future<void> setUserId(String? id) => id == null ? _prefs.remove(_userId) : _prefs.setString(_userId, id);

  String get anonId {
    final existing = _prefs.getString(_anonId);
    if (existing != null) return existing;
    final fresh = _newId();
    _prefs.setString(_anonId, fresh);
    return fresh;
  }

  Future<void> cacheInvite(String code, Map<String, dynamic> json) =>
      _prefs.setString('$_invitePrefix$code', jsonEncode({'savedAt': DateTime.now().toIso8601String(), 'data': json}));

  Cached<Map<String, dynamic>>? cachedInvite(String code) => _read('$_invitePrefix$code');

  Future<void> cacheActivity(String id, Map<String, dynamic> json) =>
      _prefs.setString('$_activityPrefix$id', jsonEncode({'savedAt': DateTime.now().toIso8601String(), 'data': json}));

  Cached<Map<String, dynamic>>? cachedActivity(String id) => _read('$_activityPrefix$id');

  Cached<Map<String, dynamic>>? _read(String key) {
    final raw = _prefs.getString(key);
    if (raw == null) return null;
    final decoded = jsonDecode(raw) as Map<String, dynamic>;
    return Cached(savedAt: DateTime.parse(decoded['savedAt'] as String), data: decoded['data'] as Map<String, dynamic>);
  }

  PendingClaim? get pendingClaim {
    final raw = _prefs.getString(_pendingClaim);
    return raw == null ? null : PendingClaim.fromJson(jsonDecode(raw) as Map<String, dynamic>);
  }

  Future<void> setPendingClaim(PendingClaim? claim) =>
      claim == null ? _prefs.remove(_pendingClaim) : _prefs.setString(_pendingClaim, jsonEncode(claim.toJson()));

  static String _newId() {
    final now = DateTime.now().microsecondsSinceEpoch.toRadixString(16);
    final salt = (now.hashCode ^ identityHashCode(Object())).toRadixString(16);
    return 'anon-$now-$salt';
  }
}

class Cached<T> {
  const Cached({required this.savedAt, required this.data});

  final DateTime savedAt;
  final T data;
}

/// What the guest typed plus the idempotency key, kept so a retry after coming back online can never book twice.
class PendingClaim {
  const PendingClaim({required this.code, required this.idempotencyKey, required this.displayName, required this.contact});

  final String code;
  final String idempotencyKey;
  final String displayName;
  final String contact;

  factory PendingClaim.fromJson(Map<String, dynamic> j) =>
      PendingClaim(code: j['code'] as String, idempotencyKey: j['idempotencyKey'] as String, displayName: j['displayName'] as String, contact: j['contact'] as String);

  Map<String, dynamic> toJson() => {'code': code, 'idempotencyKey': idempotencyKey, 'displayName': displayName, 'contact': contact};
}
