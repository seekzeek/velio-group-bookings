import 'dart:typed_data';

import 'api_client.dart';
import 'models.dart';

/// Typed endpoints from API.md over the thin [ApiClient].
class VelioApi {
  VelioApi(this.client);

  final ApiClient client;

  Future<List<PickerUser>> users() async {
    final body = await client.get('/users');
    return (body['users'] as List).map((u) => PickerUser.fromJson(u as Map<String, dynamic>)).toList();
  }

  Future<List<Activity>> activities({String? category, String? hostId, String? sort, String? excludeId, int? minSpotsLeft}) async {
    final body = await client.get('/activities', query: {
      if (category != null) 'category': category,
      if (hostId != null) 'hostId': hostId,
      if (sort != null) 'sort': sort,
      if (excludeId != null) 'excludeId': excludeId,
      if (minSpotsLeft != null) 'minSpotsLeft': '$minSpotsLeft',
    });
    return (body['activities'] as List).map((a) => Activity.fromJson(a as Map<String, dynamic>)).toList();
  }

  Future<Map<String, dynamic>> activityJson(String id, {String? anonId}) async {
    final body = await client.get('/activities/$id', query: {if (anonId != null) 'anonId': anonId});
    return body['activity'] as Map<String, dynamic>;
  }

  Future<Activity> activity(String id, {String? anonId}) async => Activity.fromJson(await activityJson(id, anonId: anonId));

  Future<Activity> createActivity(Map<String, dynamic> input) async {
    final body = await client.post('/activities', body: input);
    return Activity.fromJson(body['activity'] as Map<String, dynamic>);
  }

  Future<Photo> uploadPhoto(String activityId, {required Uint8List bytes, required String filename, void Function(double fraction)? onProgress}) async {
    final ext = filename.contains('.') ? filename.split('.').last.toLowerCase() : '';
    final contentType = switch (ext) { 'png' => 'image/png', 'webp' => 'image/webp', _ => 'image/jpeg' };
    final json = await client.upload('/activities/$activityId/photos', field: 'photo', filename: filename, bytes: bytes, contentType: contentType, onProgress: onProgress);
    return Photo.fromJson(json['photo'] as Map<String, dynamic>);
  }

  Future<Attendance> attendance(String activityId) async => Attendance.fromJson(await client.get('/activities/$activityId/attendance'));

  Future<void> watch(String activityId, {required String anonId}) => client.post('/activities/$activityId/watch', body: {'anonId': anonId, 'platform': 'mobile'});

  Future<BookingResult> book(String activityId, {required String idempotencyKey, required String anonId}) async =>
      BookingResult.fromJson(await client.post('/activities/$activityId/bookings', body: {'idempotencyKey': idempotencyKey, 'platform': 'mobile', 'anonId': anonId}));

  Future<Map<String, dynamic>> inviteJson(String code) => client.get('/invites/${Uri.encodeComponent(code)}');

  Future<ResolvedInvite> invite(String code) async => ResolvedInvite.fromJson(await inviteJson(code));

  Future<ClaimResult> claim(String code, {required String idempotencyKey, String? displayName, String? contact, required String anonId}) async =>
      ClaimResult.fromJson(await client.post('/invites/${Uri.encodeComponent(code)}/claim', body: {
        'idempotencyKey': idempotencyKey,
        if (displayName != null && displayName.isNotEmpty) 'displayName': displayName,
        if (contact != null && contact.isNotEmpty) 'contact': contact,
        'platform': 'mobile',
        'anonId': anonId,
      }));

  Future<Invite> createInvite({required String rail, required String activityId, String? recipientContact, String? recipientLabel}) async {
    final body = await client.post('/invites', body: {
      'rail': rail,
      'activityId': activityId,
      if (recipientContact != null) 'recipientContact': recipientContact,
      if (recipientLabel != null && recipientLabel.isNotEmpty) 'recipientLabel': recipientLabel,
      'platform': 'mobile',
    });
    return Invite.fromJson(body['invite'] as Map<String, dynamic>);
  }

  Future<void> revokeInvite(String code) => client.post('/invites/$code/revoke', body: {'reason': 'turned_off'});

  Future<MyPlans> myPlans({bool includePast = false}) async => MyPlans.fromJson(await client.get('/me/plans', query: {if (includePast) 'includePast': 'true'}));

  Future<Map<String, dynamic>> plan(String id) => client.get('/plans/$id');

  Future<MyInvites> myInvites({String? activityId}) async => MyInvites.fromJson(await client.get('/me/invites', query: {if (activityId != null) 'activityId': activityId}));

  Future<void> updatePreferences({bool? remindDayBefore, bool? friendUpdates}) => client.patch('/me/preferences', body: {
        if (remindDayBefore != null) 'remindDayBefore': remindDayBefore,
        if (friendUpdates != null) 'friendUpdates': friendUpdates,
      });

  Future<void> event(String name, {required String anonId, String? activityId, String? inviteCode, Map<String, dynamic>? props}) =>
      client.post('/events', body: {
        'name': name,
        'anonId': anonId,
        'platform': 'mobile',
        if (activityId != null) 'activityId': activityId,
        if (inviteCode != null) 'inviteCode': inviteCode,
        if (props != null) 'props': props,
      });
}
