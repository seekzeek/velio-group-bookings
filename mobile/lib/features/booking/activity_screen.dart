import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/errors.dart';
import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../../widgets/bits.dart';
import '../../widgets/cover.dart';
import 'activity_controller.dart';
import 'invite_sheet.dart';

/// The activity page: details, live spots, book with an optimistic count, sold out with the host's other date,
/// and once booked, the invite sheet (or just the calendar on a holdout activity).
class ActivityScreen extends ConsumerStatefulWidget {
  const ActivityScreen({super.key, required this.activityId});

  final String activityId;

  @override
  ConsumerState<ActivityScreen> createState() => _ActivityScreenState();
}

class _ActivityScreenState extends ConsumerState<ActivityScreen> {
  late final String _idempotencyKey = newIdempotencyKey();

  Future<void> _book() async {
    if (ref.read(sessionProvider) == null) {
      showToast(context, 'Pick who you are first. Claim an invite or enter a code.');
      return;
    }
    try {
      final result = await ref.read(activityProvider(widget.activityId).notifier).book(_idempotencyKey);
      if (result != null && mounted) {
        await showInviteSheet(context, ref, activity: result.activity);
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      showToast(context, e.code == ApiErrorCode.alreadyBooked ? "You're already going to this one." : ErrorCopy.of(e.code).title);
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(activityProvider(widget.activityId));
    ref.listen(activityProvider(widget.activityId), (_, next) {
      final toast = next.value?.toast;
      if (toast != null) {
        showToast(context, toast);
        ref.read(activityProvider(widget.activityId).notifier).clearToast();
      }
    });
    return Scaffold(
      body: state.when(
        loading: () => const _ActivitySkeleton(),
        error: (err, _) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(VelioSpace.page),
            child: Column(children: [
              const SizedBox(height: 24),
              ErrorView(code: err is ApiException ? err.code : ApiErrorCode.tryAgain, action: TextButton(onPressed: () => ref.invalidate(activityProvider(widget.activityId)), child: const Text('Try again'))),
            ]),
          ),
        ),
        data: (view) => _Body(view: view, onBook: _book),
      ),
    );
  }
}

class _Body extends ConsumerWidget {
  const _Body({required this.view, required this.onBook});

  final ActivityView view;
  final Future<void> Function() onBook;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final a = view.activity;
    final text = Theme.of(context).textTheme;
    final soldOut = !a.booked && (view.soldOutJustNow || a.isFull);
    final others = soldOut || a.hasStarted ? ref.watch(otherDatesProvider((hostId: a.host.id, excludeId: a.id))) : null;
    final otherDate = others?.value?.firstOrNull;

    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: EdgeInsets.zero,
            children: [
              Stack(children: [
                Cover(illustration: a.illustration, photos: a.photos, height: 260),
                Positioned(
                  top: MediaQuery.paddingOf(context).top + 12,
                  left: 20,
                  child: Semantics(
                    label: 'Back to Explore',
                    button: true,
                    child: InkWell(
                      onTap: () => Navigator.of(context).maybePop(),
                      borderRadius: BorderRadius.circular(22),
                      child: Container(width: 44, height: 44, decoration: const BoxDecoration(color: VelioColors.surface, shape: BoxShape.circle, boxShadow: VelioShadows.card), child: const Icon(Icons.chevron_left, size: 22)),
                    ),
                  ),
                ),
              ]),
              if (view.fromCache) OfflineBanner(savedAt: view.savedAt),
              Padding(
                padding: const EdgeInsets.fromLTRB(VelioSpace.page, 20, VelioSpace.page, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [Avatar(name: a.host.displayName, size: 24), const SizedBox(width: 8), Text('Hosted by ${a.host.displayName}', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: VelioColors.body))]),
                    const SizedBox(height: 10),
                    Text(a.title, style: text.headlineMedium),
                    const SizedBox(height: 10),
                    Text(a.description, style: text.bodyLarge),
                    const SizedBox(height: 14),
                    Row(children: [const Icon(Icons.calendar_today_outlined, size: 16, color: VelioColors.body), const SizedBox(width: 10), Text('${formatWhen(a.startsAt, a.timezone)} local time', style: text.bodyMedium)]),
                    const SizedBox(height: 8),
                    Row(children: [const Icon(Icons.location_on_outlined, size: 16, color: VelioColors.body), const SizedBox(width: 10), Expanded(child: Text(a.location, style: text.bodyMedium))]),
                    const SizedBox(height: 8),
                    Row(children: [const Icon(Icons.group_outlined, size: 16, color: VelioColors.body), const SizedBox(width: 10), Text('${a.plansCount} ${a.plansCount == 1 ? 'group' : 'groups'} going', style: text.bodyMedium)]),
                    const SizedBox(height: 20),
                    VelioCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          SpotsLine(spotsLeft: a.spotsLeft, capacity: a.capacity, live: view.live && !view.fromCache),
                          const SizedBox(height: 10),
                          Text(a.booked ? "You're going. Bring someone, whoever claims first gets it." : "You can invite friends as soon as you've booked.", style: text.bodySmall),
                        ],
                      ),
                    ),
                    if (soldOut) ...[
                      const SizedBox(height: 16),
                      Notice(
                        title: 'Someone got there a second before you',
                        body: "The last spot went while you were booking, so you haven't been booked.${otherDate != null ? ' ${a.host.displayName} has another date with room.' : ''}",
                      ),
                    ],
                    if (a.hasStarted && !a.booked) ...[const SizedBox(height: 16), const Notice(title: 'This one has already started', body: "Here's what's coming up instead.")],
                    const SizedBox(height: 24),
                  ],
                ),
              ),
            ],
          ),
        ),
        Container(
          padding: EdgeInsets.fromLTRB(VelioSpace.page, 12, VelioSpace.page, MediaQuery.paddingOf(context).bottom + 12),
          decoration: const BoxDecoration(color: VelioColors.surface, boxShadow: [BoxShadow(color: VelioColors.border, offset: Offset(0, -1))]),
          child: Row(
            children: [
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(formatMoney(a.price), style: text.titleLarge),
                Text('per spot, paid on the day', style: text.bodySmall),
              ]),
              const SizedBox(width: 16),
              Expanded(
                child: a.booked
                    ? (a.invitesEnabled && a.spotsLeft > 0
                        ? FilledButton(onPressed: () => showInviteSheet(context, ref, activity: a), child: const Text('Bring a friend'))
                        : FilledButton(onPressed: () => Navigator.of(context).popUntil((r) => r.isFirst), child: const Text('See it in My plans')))
                    : soldOut
                        ? (otherDate != null
                            ? FilledButton(onPressed: () => Navigator.of(context).pushReplacement(MaterialPageRoute<void>(builder: (_) => ActivityScreen(activityId: otherDate.id))), child: Text('${formatDay(otherDate.startsAt, otherDate.timezone)} · ${otherDate.spotsLeft} left'))
                            : _WatchButton(activity: a))
                        : a.hasStarted
                            ? FilledButton(onPressed: () => Navigator.of(context).popUntil((r) => r.isFirst), child: const Text("See what's coming up"))
                            : Cta(label: view.booking ? 'Booking…' : 'Book my spot', busy: view.booking, onPressed: view.fromCache ? null : onBook),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _WatchButton extends ConsumerStatefulWidget {
  const _WatchButton({required this.activity});

  final Activity activity;

  @override
  ConsumerState<_WatchButton> createState() => _WatchButtonState();
}

class _WatchButtonState extends ConsumerState<_WatchButton> {
  bool _watching = false;

  @override
  Widget build(BuildContext context) {
    return Cta(
      label: _watching ? "We'll tell you if a spot opens" : 'Tell me if a spot opens',
      tint: _watching,
      onPressed: () {
        setState(() => _watching = true);
        ref.read(apiProvider).watch(widget.activity.id, anonId: ref.read(anonIdProvider)).catchError((_) {});
      },
    );
  }
}

class _ActivitySkeleton extends StatelessWidget {
  const _ActivitySkeleton();

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Loading the activity',
      child: ListView(
        padding: EdgeInsets.zero,
        children: const [
          Skeleton(height: 260, radius: 0),
          Padding(
            padding: EdgeInsets.all(VelioSpace.page),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Skeleton(height: 14, width: 140), SizedBox(height: 14), Skeleton(height: 28, width: 220), SizedBox(height: 14), Skeleton(height: 12), SizedBox(height: 8), Skeleton(height: 12, width: 260)]),
          ),
        ],
      ),
    );
  }
}
