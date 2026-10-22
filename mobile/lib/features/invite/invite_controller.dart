import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/config.dart';
import '../../core/errors.dart';
import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/sse.dart';
import '../../core/storage.dart';

class InviteView {
  const InviteView({required this.invite, required this.spotsLeft, required this.live, this.fromCache = false, this.savedAt});

  final ResolvedInvite invite;
  final int spotsLeft;
  final bool live;
  final bool fromCache;
  final DateTime? savedAt;

  InviteView copyWith({ResolvedInvite? invite, int? spotsLeft, bool? live, bool? fromCache, DateTime? savedAt}) =>
      InviteView(invite: invite ?? this.invite, spotsLeft: spotsLeft ?? this.spotsLeft, live: live ?? this.live, fromCache: fromCache ?? this.fromCache, savedAt: savedAt ?? this.savedAt);
}

/// Resolves an invite code, caches the answer for offline, keeps spots live, and claims.
class InviteController extends AutoDisposeFamilyAsyncNotifier<InviteView, String> {
  AvailabilityStream? _stream;

  @override
  Future<InviteView> build(String code) async {
    ref.onDispose(() => _stream?.close());
    final api = ref.watch(apiProvider);
    final store = ref.watch(localStoreProvider);
    ref.watch(sessionProvider);
    try {
      final json = await api.inviteJson(code);
      final invite = ResolvedInvite.fromJson(json);
      await store.cacheInvite(invite.code, json);
      track(ref, 'invite_opened', inviteCode: invite.code, props: {'spotsLeftAtOpen': invite.activity.spotsLeft});
      _listen(invite);
      return InviteView(invite: invite, spotsLeft: invite.activity.spotsLeft, live: false);
    } on ApiException catch (e) {
      final cached = store.cachedInvite(code.toUpperCase().replaceAll(RegExp('[^A-Z0-9]'), ''));
      if (cached != null && (e.code == ApiErrorCode.offline || e.code == ApiErrorCode.tryAgain)) {
        final invite = ResolvedInvite.fromJson(cached.data);
        return InviteView(invite: invite, spotsLeft: invite.activity.spotsLeft, live: false, fromCache: true, savedAt: cached.savedAt);
      }
      rethrow;
    }
  }

  void _listen(ResolvedInvite invite) {
    _stream?.close();
    final stream = AvailabilityStream(
      url: Uri.parse('${AppConfig.apiBaseUrl}/activities/${invite.activity.id}/stream'),
      onAvailability: (a) {
        final current = state.value;
        if (current == null) return;
        state = AsyncData(current.copyWith(spotsLeft: a.spotsLeft, live: true));
      },
      onGap: (_) => ref.invalidateSelf(),
      onConnected: (connected) {
        final current = state.value;
        if (current != null) state = AsyncData(current.copyWith(live: connected));
      },
    )..lastVersion = invite.activity.version;
    _stream = stream;
    stream.start();
  }

  /// Claims with the saved key. Keeps the typed details when offline so one tap finishes it later.
  Future<ClaimResult> claim({required String idempotencyKey, required String displayName, required String contact}) async {
    final store = ref.read(localStoreProvider);
    final code = state.value?.invite.code ?? arg;
    await store.setPendingClaim(PendingClaim(code: code, idempotencyKey: idempotencyKey, displayName: displayName, contact: contact));
    track(ref, 'claim_submitted', inviteCode: code);
    try {
      final result = await ref.read(apiProvider).claim(code, idempotencyKey: idempotencyKey, displayName: displayName, contact: contact, anonId: ref.read(anonIdProvider));
      await store.setPendingClaim(null);
      await ref.read(sessionProvider.notifier).set(result.userId);
      unawaited(HapticFeedback.mediumImpact());
      return result;
    } on ApiException catch (e) {
      if (e.code != ApiErrorCode.offline && e.code != ApiErrorCode.tryAgain && e.code != ApiErrorCode.rateLimited) {
        await store.setPendingClaim(null);
      }
      if (e.code == ApiErrorCode.soldOut) {
        final current = state.value;
        if (current != null) state = AsyncData(current.copyWith(spotsLeft: 0));
      }
      rethrow;
    }
  }
}

final inviteProvider = AsyncNotifierProvider.autoDispose.family<InviteController, InviteView, String>(InviteController.new);

String normalizeCode(String input) {
  final cleaned = input.toUpperCase().replaceAll(RegExp('[^A-Z0-9]'), '');
  return cleaned;
}

String displayCode(String code) => code.length == 8 ? '${code.substring(0, 4)}-${code.substring(4)}' : code;

ApiErrorCode statusError(String status) => switch (status) {
      'expired' => ApiErrorCode.inviteExpired,
      'used' => ApiErrorCode.inviteUsed,
      'revoked' => ApiErrorCode.inviteRevoked,
      'started' => ApiErrorCode.activityStarted,
      'off' => ApiErrorCode.invitesOff,
      _ => ApiErrorCode.tryAgain,
    };
