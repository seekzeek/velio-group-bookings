import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/errors.dart';
import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../../widgets/bits.dart';
import '../../widgets/collapsing_header.dart';
import '../booking/invite_sheet.dart';
import '../host/host_screen.dart';
import '../invite/code_screen.dart';
import 'going_screen.dart';

final myPlansProvider = FutureProvider.autoDispose<MyPlans>((ref) {
  ref.watch(sessionProvider);
  return ref.watch(apiProvider).myPlans(includePast: true);
});

/// My plans: what you're going to, and what you're hosting.
class PlansScreen extends ConsumerStatefulWidget {
  const PlansScreen({super.key, this.initialTab = 0});

  final int initialTab;

  @override
  ConsumerState<PlansScreen> createState() => _PlansScreenState();
}

class _PlansScreenState extends ConsumerState<PlansScreen> {
  late int _tab = widget.initialTab;
  bool _past = false;

  @override
  Widget build(BuildContext context) {
    final userId = ref.watch(sessionProvider);
    final text = Theme.of(context).textTheme;
    if (userId == null) {
      return Scaffold(
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(VelioSpace.page),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const SizedBox(height: 20),
              Text('My plans', style: text.displaySmall),
              const SizedBox(height: 20),
              EmptyView(title: 'Nothing booked yet', body: 'Claim an invite or enter a code, and your plans will be here next time.', children: [
                FilledButton(onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const CodeScreen())), child: const Text('Got an invite code?')),
                const SizedBox(height: 8),
                const UserPickerRow(),
              ]),
            ]),
          ),
        ),
      );
    }
    final plans = ref.watch(myPlansProvider);
    return Scaffold(
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: RefreshIndicator(
                onRefresh: () => ref.refresh(myPlansProvider.future),
                child: CustomScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  slivers: [
                    CollapsingHeader(
                      title: 'My plans',
                      compactTitle: 'My plans',
                      action: TextButton(onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const CodeScreen())), child: const Text('Got a code?')),
                      pinnedHeight: 60,
                      pinned: Padding(
                        padding: const EdgeInsets.fromLTRB(VelioSpace.page, 0, VelioSpace.page, 12),
                        child: _Tabs(
                          labels: ['Going · ${plans.value?.going.length ?? 0}', 'Hosting · ${plans.value?.hosting.length ?? 0}'],
                          index: _tab,
                          onChanged: (i) => setState(() => _tab = i),
                        ),
                      ),
                    ),
                    plans.when(
                      loading: () => SliverPadding(
                          padding: const EdgeInsets.all(VelioSpace.page),
                          sliver: SliverList.list(children: const [Skeleton(height: 180, radius: 20), SizedBox(height: 12), Skeleton(height: 180, radius: 20)])),
                      error: (err, _) => SliverFillRemaining(
                          hasScrollBody: false,
                          child: Padding(
                              padding: const EdgeInsets.all(VelioSpace.page),
                              child: ErrorView(
                                  code: err is ApiException ? err.code : ApiErrorCode.tryAgain, action: TextButton(onPressed: () => ref.invalidate(myPlansProvider), child: const Text('Try again'))))),
                      data: (data) => _tab == 0 ? _Going(data: data, userId: userId, showPast: _past, onTogglePast: () => setState(() => _past = !_past)) : _Hosting(data: data),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Tabs extends StatelessWidget {
  const _Tabs({required this.labels, required this.index, required this.onChanged});

  final List<String> labels;
  final int index;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(color: const Color(0xFFE9EBEE), borderRadius: BorderRadius.circular(14)),
      child: Row(
        children: [
          for (var i = 0; i < labels.length; i++)
            Expanded(
              child: Semantics(
                selected: index == i,
                button: true,
                child: InkWell(
                  onTap: () => onChanged(i),
                  borderRadius: BorderRadius.circular(10),
                  child: Container(
                    height: 40,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                        color: index == i ? VelioColors.surface : Colors.transparent,
                        borderRadius: BorderRadius.circular(10),
                        boxShadow: index == i ? const [BoxShadow(color: Color(0x0F15171A), blurRadius: 2, offset: Offset(0, 1))] : null),
                    child: Text(labels[i], style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: index == i ? VelioColors.ink : VelioColors.muted)),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _Going extends StatelessWidget {
  const _Going({required this.data, required this.userId, required this.showPast, required this.onTogglePast});

  final MyPlans data;
  final String userId;
  final bool showPast;
  final VoidCallback onTogglePast;

  @override
  Widget build(BuildContext context) {
    if (data.going.isEmpty && !showPast) {
      return SliverPadding(
        padding: const EdgeInsets.all(VelioSpace.page),
        sliver: SliverList.list(children: [
          EmptyView(title: 'Nothing booked yet', body: 'Book one spot on something this week. Then bring your people.', children: [
            FilledButton(onPressed: () => Navigator.of(context).popUntil((r) => r.isFirst), child: const Text('Find something on Explore')),
            const SizedBox(height: 8),
            OutlinedButton(onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const CodeScreen())), child: const Text('Got an invite code?')),
          ]),
          if (data.past.isNotEmpty) Center(child: TextButton(onPressed: onTogglePast, child: const Text('Past plans'))),
        ]),
      );
    }
    final rows = showPast ? data.past : data.going;
    return SliverPadding(
      padding: const EdgeInsets.all(VelioSpace.page),
      sliver: SliverList.list(children: [
        for (final e in rows) Padding(padding: const EdgeInsets.only(bottom: 12), child: _GoingCard(entry: e, userId: userId, past: showPast)),
        Center(child: TextButton(onPressed: onTogglePast, child: Text(showPast ? 'Back to upcoming' : 'Past plans'))),
      ]),
    );
  }
}

class _GoingCard extends ConsumerWidget {
  const _GoingCard({required this.entry, required this.userId, required this.past});

  final PlanEntry entry;
  final String userId;
  final bool past;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final a = entry.activity;
    final text = Theme.of(context).textTheme;
    final others = entry.plan.members.where((m) => m.userId != userId).map((m) => m.displayName).toList();
    final owner = entry.viewerRole == 'owner';
    final who = owner ? (others.isEmpty ? 'Just you so far' : 'You and ${listNames(others)}') : '${listNames(others)} and you';
    return InkWell(
      onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => GoingScreen(entry: entry))),
      borderRadius: BorderRadius.circular(VelioRadius.card),
      child: VelioCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              Text(owner ? 'YOUR GROUP' : "IN ${entry.plan.owner.displayName.toUpperCase()}'S GROUP", style: text.labelSmall),
              Text(formatWhen(a.startsAt, a.timezone), style: text.bodySmall),
            ]),
            const SizedBox(height: 8),
            Text(a.title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
            const SizedBox(height: 12),
            Row(children: [
              AvatarStack(names: [if (owner) 'You', ...others, if (entry.pendingVouches > 0) '?'], size: 28),
              const SizedBox(width: 10),
              Expanded(child: Text('$who${entry.pendingVouches > 0 ? ' · ${entry.pendingVouches} ${entry.pendingVouches == 1 ? 'vouch' : 'vouches'} not claimed yet' : ''}', style: text.bodyMedium)),
            ]),
            if (!past) ...[
              const SizedBox(height: 12),
              Row(children: [
                Expanded(
                    child: Text('${a.spotsLeft} spots left${entry.viewerJoinedVia == 'public' && !owner ? " · you joined from ${entry.plan.owner.displayName}'s link" : ''}', style: text.bodySmall)),
                if (a.invitesEnabled && a.spotsLeft > 0) TextButton(onPressed: () => showInviteSheet(context, ref, activity: a), child: const Text('Invite more')),
              ]),
            ],
          ],
        ),
      ),
    );
  }
}

class _Hosting extends ConsumerWidget {
  const _Hosting({required this.data});

  final MyPlans data;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = Theme.of(context).textTheme;
    return SliverPadding(
      padding: const EdgeInsets.all(VelioSpace.page),
      sliver: SliverList.list(children: [
        if (data.hosting.isEmpty)
          EmptyView(title: 'Nothing hosted yet', body: 'Create an activity and watch the groups form.', children: [
            FilledButton(onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const CreateActivityScreen())), child: const Text('+ New activity')),
          ]),
        for (final h in data.hosting)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: VelioCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [Text("YOU'RE HOSTING", style: text.labelSmall), Text(formatWhen(h.activity.startsAt, h.activity.timezone), style: text.bodySmall)]),
                  const SizedBox(height: 8),
                  Text(h.activity.title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 12),
                  Row(children: [
                    Container(width: 8, height: 8, decoration: BoxDecoration(color: dotColour(h.activity.spotsLeft), shape: BoxShape.circle)),
                    const SizedBox(width: 10),
                    Expanded(
                        child: Text('${h.activity.spotsTaken} of ${h.activity.capacity} booked · ${h.plansCount} ${h.plansCount == 1 ? 'group' : 'groups'}',
                            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: spotColour(h.activity.spotsLeft)))),
                    Text('LIVE', style: text.labelSmall),
                  ]),
                  const SizedBox(height: 10),
                  ClipRRect(
                      borderRadius: BorderRadius.circular(2),
                      child: LinearProgressIndicator(
                          value: h.activity.capacity == 0 ? 0 : h.activity.spotsTaken / h.activity.capacity,
                          minHeight: 4,
                          backgroundColor: VelioColors.border,
                          color: dotColour(h.activity.spotsLeft))),
                  const SizedBox(height: 14),
                  Row(children: [
                    Expanded(
                        child: FilledButton(
                            onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => AttendanceScreen(activityId: h.activity.id))), child: const Text('Live attendance'))),
                    const SizedBox(width: 8),
                    if (h.activity.invitesEnabled)
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () async {
                            final invite = await ref.read(apiProvider).createInvite(rail: 'public', activityId: h.activity.id);
                            await Share.share('Come to ${h.activity.title}: ${invite.url}');
                          },
                          child: const Text('Share link'),
                        ),
                      ),
                  ]),
                ],
              ),
            ),
          ),
        if (data.hosting.isNotEmpty)
          Center(child: TextButton(onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const CreateActivityScreen())), child: const Text('+ New activity'))),
      ]),
    );
  }
}

/// A row that stands in for sign-in on the phone: pick a seeded user. The guest flow sets the id on its own.
class UserPickerRow extends ConsumerWidget {
  const UserPickerRow({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final users = ref.watch(usersProvider);
    final current = ref.watch(sessionProvider);
    return users.maybeWhen(
      data: (list) => DropdownButtonFormField<String?>(
        initialValue: list.any((u) => u.id == current) ? current : null,
        decoration: const InputDecoration(labelText: 'Or try the app as'),
        items: [
          const DropdownMenuItem<String?>(value: null, child: Text('Nobody yet')),
          for (final u in list) DropdownMenuItem<String?>(value: u.id, child: Text('${u.displayName} · ${u.isHost ? 'host' : 'booker'}'))
        ],
        onChanged: (id) => ref.read(sessionProvider.notifier).set(id),
      ),
      orElse: () => const SizedBox.shrink(),
    );
  }
}
