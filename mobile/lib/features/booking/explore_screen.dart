import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/errors.dart';
import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../../widgets/bits.dart';
import '../../widgets/cover.dart';
import '../invite/code_screen.dart';
import 'activity_screen.dart';

final exploreFilterProvider = StateProvider<String?>((ref) => null);

/// Explore polls instead of opening a stream per card: the phone has a handful of sockets and the activity page uses one.
final exploreProvider = FutureProvider.autoDispose<List<Activity>>((ref) async {
  ref.watch(sessionProvider);
  final category = ref.watch(exploreFilterProvider);
  final timer = Stream<void>.periodic(const Duration(seconds: 10)).listen((_) => ref.invalidateSelf());
  ref.onDispose(timer.cancel);
  return ref.watch(apiProvider).activities(category: category);
});

class ExploreScreen extends ConsumerWidget {
  const ExploreScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final activities = ref.watch(exploreProvider);
    final filter = ref.watch(exploreFilterProvider);
    final online = isOnline(ref);
    final text = Theme.of(context).textTheme;
    const chips = [(null, 'This week'), ('outdoors', 'Outdoors'), ('nights_out', 'Nights out'), ('food_and_drink', 'Food'), ('classes', 'Classes')];

    return Scaffold(
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (!online) const OfflineBanner(),
            Padding(
              padding: const EdgeInsets.fromLTRB(VelioSpace.page, 20, VelioSpace.page, 0),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Wordmark(),
                  TextButton(onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const CodeScreen())), child: const Text('Got a code?')),
                ],
              ),
            ),
            Padding(padding: const EdgeInsets.fromLTRB(VelioSpace.page, 8, VelioSpace.page, 0), child: Text('What are you doing this week?', style: text.displaySmall)),
            SizedBox(
              height: 60,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.fromLTRB(VelioSpace.page, 16, VelioSpace.page, 0),
                children: [
                  for (final (key, label) in chips)
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: FilterChip(
                        label: Text(label),
                        selected: filter == key,
                        showCheckmark: false,
                        labelStyle: TextStyle(fontWeight: FontWeight.w600, color: filter == key ? Colors.white : VelioColors.body),
                        onSelected: (_) => ref.read(exploreFilterProvider.notifier).state = key,
                      ),
                    ),
                ],
              ),
            ),
            Expanded(
              child: activities.when(
                loading: () => ListView(
                  padding: const EdgeInsets.all(VelioSpace.page),
                  children: const [Skeleton(height: 260, radius: 20), SizedBox(height: 16), Skeleton(height: 96, radius: 20), SizedBox(height: 16), Skeleton(height: 96, radius: 20)],
                ),
                error: (err, _) => Padding(
                  padding: const EdgeInsets.all(VelioSpace.page),
                  child: ErrorView(
                    code: err is ApiException ? err.code : ApiErrorCode.tryAgain,
                    action: TextButton(onPressed: () => ref.invalidate(exploreProvider), child: const Text('Try again')),
                  ),
                ),
                data: (rows) => RefreshIndicator(
                  onRefresh: () => ref.refresh(exploreProvider.future),
                  child: ListView.separated(
                    padding: const EdgeInsets.all(VelioSpace.page),
                    itemCount: rows.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 12),
                    itemBuilder: (context, i) => i == 0 ? _FeaturedCard(activity: rows[i]) : _RowCard(activity: rows[i]),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

void openActivity(BuildContext context, Activity activity) {
  Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => ActivityScreen(activityId: activity.id)));
}

class _FeaturedCard extends StatelessWidget {
  const _FeaturedCard({required this.activity});

  final Activity activity;

  @override
  Widget build(BuildContext context) {
    final a = activity;
    return InkWell(
      onTap: () => openActivity(context, a),
      borderRadius: BorderRadius.circular(VelioRadius.card),
      child: VelioCard(
        clip: true,
        padding: EdgeInsets.zero,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Stack(children: [
              Cover(illustration: a.illustration, photos: a.photos, height: 170),
              if (isFillingFast(a.spotsLeft, a.capacity) && !a.booked)
                Positioned(top: 12, right: 12, child: Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5), decoration: BoxDecoration(color: VelioColors.warningBackground, borderRadius: BorderRadius.circular(999)), child: const Text('Filling fast', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: VelioColors.warningText)))),
            ]),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [Expanded(child: Text(a.title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700))), Text(formatMoney(a.price), style: const TextStyle(fontWeight: FontWeight.w700))]),
                  const SizedBox(height: 4),
                  Text('${formatWhen(a.startsAt, a.timezone)} · ${a.location} · ${a.host.displayName}', style: const TextStyle(fontSize: 13, color: VelioColors.body)),
                  const SizedBox(height: 12),
                  if (a.booked) const _Going() else SpotsLine(spotsLeft: a.spotsLeft, capacity: a.capacity, short: true),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RowCard extends StatelessWidget {
  const _RowCard({required this.activity});

  final Activity activity;

  @override
  Widget build(BuildContext context) {
    final a = activity;
    return InkWell(
      onTap: () => openActivity(context, a),
      borderRadius: BorderRadius.circular(VelioRadius.card),
      child: VelioCard(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            ClipRRect(borderRadius: BorderRadius.circular(12), child: SizedBox(width: 72, height: 72, child: Cover(illustration: a.illustration, photos: a.photos))),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [Expanded(child: Text(a.title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700))), Text(formatMoney(a.price), style: const TextStyle(fontWeight: FontWeight.w700))]),
                  const SizedBox(height: 2),
                  Text('${formatWhen(a.startsAt, a.timezone)} · ${a.host.displayName}', style: const TextStyle(fontSize: 13, color: VelioColors.body)),
                  const SizedBox(height: 8),
                  if (a.booked) const _Going() else SpotsLine(spotsLeft: a.spotsLeft, capacity: a.capacity, short: true, bar: false),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Going extends StatelessWidget {
  const _Going();

  @override
  Widget build(BuildContext context) {
    return const Row(children: [
      Icon(Icons.check_circle_outline, size: 16, color: VelioColors.primaryDeep),
      SizedBox(width: 6),
      Text("You're going", style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: VelioColors.primaryDeep)),
    ]);
  }
}
