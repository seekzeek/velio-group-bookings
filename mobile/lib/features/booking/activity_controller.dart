import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/config.dart';
import '../../core/errors.dart';
import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/sse.dart';
import '../../core/storage.dart';

class ActivityView {
  const ActivityView({required this.activity, required this.live, this.fromCache = false, this.savedAt, this.toast, this.soldOutJustNow = false, this.booking = false});

  final Activity activity;
  final bool live;
  final bool fromCache;
  final DateTime? savedAt;
  final String? toast;
  final bool soldOutJustNow;
  final bool booking;

  ActivityView copyWith({Activity? activity, bool? live, bool? fromCache, DateTime? savedAt, String? toast, bool clearToast = false, bool? soldOutJustNow, bool? booking}) => ActivityView(
        activity: activity ?? this.activity,
        live: live ?? this.live,
        fromCache: fromCache ?? this.fromCache,
        savedAt: savedAt ?? this.savedAt,
        toast: clearToast ? null : (toast ?? this.toast),
        soldOutJustNow: soldOutJustNow ?? this.soldOutJustNow,
        booking: booking ?? this.booking,
      );
}

/// Loads one activity, keeps its counts live over SSE, falls back to the cache offline, and books with an optimistic count.
class ActivityController extends AutoDisposeFamilyAsyncNotifier<ActivityView, String> {
  AvailabilityStream? _stream;
  int _ownVersion = 0;

  @override
  Future<ActivityView> build(String activityId) async {
    ref.onDispose(() => _stream?.close());
    final api = ref.watch(apiProvider);
    final store = ref.watch(localStoreProvider);
    final anonId = ref.watch(anonIdProvider);
    ref.watch(sessionProvider);
    try {
      final json = await api.activityJson(activityId, anonId: anonId);
      await store.cacheActivity(activityId, json);
      final activity = Activity.fromJson(json);
      _listen(activity);
      track(ref, 'activity_viewed', activityId: activityId, props: {'fromInvite': false});
      return ActivityView(activity: activity, live: false);
    } on ApiException catch (e) {
      final cached = store.cachedActivity(activityId);
      if (cached != null && (e.code == ApiErrorCode.offline || e.code == ApiErrorCode.tryAgain)) {
        return ActivityView(activity: Activity.fromJson(cached.data), live: false, fromCache: true, savedAt: cached.savedAt);
      }
      rethrow;
    }
  }

  void _listen(Activity activity) {
    _stream?.close();
    final stream = AvailabilityStream(
      url: Uri.parse('${AppConfig.apiBaseUrl}/activities/${activity.id}/stream'),
      onAvailability: (a) {
        final current = state.value;
        if (current == null || a.version <= current.activity.version) return;
        final announce = a.version > _ownVersion && current.activity.spotsTaken < a.spotsTaken;
        state = AsyncData(current.copyWith(
          activity: current.activity.withCounts(spotsTaken: a.spotsTaken, spotsLeft: a.spotsLeft, version: a.version),
          live: true,
          toast: announce ? (a.spotsLeft == 0 ? 'Someone just booked · now full' : 'Someone just booked · ${a.spotsLeft} ${a.spotsLeft == 1 ? 'spot' : 'spots'} left') : null,
        ));
      },
      onGap: (_) => refresh(),
      onConnected: (connected) {
        final current = state.value;
        if (current != null) state = AsyncData(current.copyWith(live: connected));
      },
    )..lastVersion = activity.version;
    _stream = stream;
    stream.start();
  }

  Future<void> refresh() async {
    final current = state.value;
    try {
      final fresh = await ref.read(apiProvider).activity(arg, anonId: ref.read(anonIdProvider));
      _stream?.lastVersion = fresh.version;
      state = AsyncData((current ?? ActivityView(activity: fresh, live: false)).copyWith(activity: fresh, fromCache: false));
    } catch (_) {
      // Keep what we have; the next heartbeat or reconnect will try again.
    }
  }

  void clearToast() {
    final current = state.value;
    if (current != null && current.toast != null) state = AsyncData(current.copyWith(clearToast: true));
  }

  /// Books one spot. The count drops at once; the server answer replaces it, or a SOLD_OUT puts it back.
  Future<BookingResult?> book(String idempotencyKey) async {
    final current = state.value;
    if (current == null || current.booking) return null;
    final optimistic = current.activity.withCounts(spotsTaken: current.activity.spotsTaken + 1, spotsLeft: current.activity.spotsLeft - 1, version: current.activity.version);
    state = AsyncData(current.copyWith(activity: optimistic, booking: true, soldOutJustNow: false));
    try {
      final result = await ref.read(apiProvider).book(arg, idempotencyKey: idempotencyKey, anonId: ref.read(anonIdProvider));
      _ownVersion = result.activity.version;
      _stream?.lastVersion = result.activity.version;
      state = AsyncData(current.copyWith(activity: result.activity, booking: false, soldOutJustNow: false));
      unawaited(HapticFeedback.mediumImpact());
      return result;
    } on ApiException catch (e) {
      if (e.code == ApiErrorCode.soldOut) {
        state = AsyncData(current.copyWith(activity: current.activity.withCounts(spotsTaken: current.activity.capacity, spotsLeft: 0, version: current.activity.version), booking: false, soldOutJustNow: true));
        unawaited(HapticFeedback.heavyImpact());
        return null;
      }
      state = AsyncData(current.copyWith(booking: false));
      rethrow;
    }
  }
}

final activityProvider = AsyncNotifierProvider.autoDispose.family<ActivityController, ActivityView, String>(ActivityController.new);

/// Other upcoming dates from the same host that still have room.
final otherDatesProvider = FutureProvider.autoDispose.family<List<Activity>, ({String hostId, String excludeId})>((ref, args) async {
  final all = await ref.watch(apiProvider).activities(hostId: args.hostId, excludeId: args.excludeId);
  return all.where((a) => a.spotsLeft > 0).take(3).toList();
});

/// One idempotency key per screen visit, so a retry can't book twice.
String newIdempotencyKey() {
  final now = DateTime.now().microsecondsSinceEpoch.toRadixString(16);
  final salt = identityHashCode(Object()).toRadixString(16);
  return 'm-$now-$salt-${now.hashCode.toRadixString(16)}';
}

PendingClaim? pendingClaimFor(Object ref, String code) {
  final pending = readFrom(ref, localStoreProvider).pendingClaim;
  return pending != null && pending.code == code ? pending : null;
}
