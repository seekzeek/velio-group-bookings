import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/errors.dart';
import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../../widgets/bits.dart';
import '../plans/going_screen.dart';

final myInvitesProvider = FutureProvider.autoDispose<MyInvites>((ref) {
  ref.watch(sessionProvider);
  return ref.watch(apiProvider).myInvites();
});

String _filterOf(Invite i) => switch (i.status) {
      'joined' => 'joined',
      'not_opened' || 'opened' => 'waiting',
      'opened_when_full' || 'expired' => 'missed',
      _ => 'other',
    };

/// My invites: every invite you've sent with its label, rail, when, and what happened to it.
class InvitesScreen extends ConsumerStatefulWidget {
  const InvitesScreen({super.key, this.standalone = false});

  final bool standalone;

  @override
  ConsumerState<InvitesScreen> createState() => _InvitesScreenState();
}

class _InvitesScreenState extends ConsumerState<InvitesScreen> {
  String _filter = 'all';

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final userId = ref.watch(sessionProvider);
    final invites = userId == null ? null : ref.watch(myInvitesProvider);
    return Scaffold(
      appBar: widget.standalone ? AppBar(title: Text('My invites', style: text.titleMedium)) : null,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(VelioSpace.page),
          children: [
            if (!widget.standalone) ...[const SizedBox(height: 20), Text('My invites', style: text.displaySmall), const SizedBox(height: 16)],
            if (invites == null)
              const EmptyView(title: 'Nothing sent yet', body: "Claim an invite or book something first. Then invite from any activity you're going to."),
            if (invites != null)
              invites.when(
                loading: () => const Column(children: [Skeleton(height: 80, radius: 20), SizedBox(height: 12), Skeleton(height: 200, radius: 20)]),
                error: (err, _) => ErrorView(code: err is ApiException ? err.code : ApiErrorCode.tryAgain, action: TextButton(onPressed: () => ref.invalidate(myInvitesProvider), child: const Text('Try again'))),
                data: (data) => data.sent == 0 ? _Empty(text: text) : _Filled(data: data, filter: _filter, onFilter: (f) => setState(() => _filter = f)),
              ),
          ],
        ),
      ),
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty({required this.text});

  final TextTheme text;

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('Nothing sent yet', style: text.headlineSmall),
      const SizedBox(height: 6),
      Text("Invite from any activity you're going to. Two ways to do it:", style: text.bodyLarge),
      const SizedBox(height: 16),
      const VelioCard(padding: EdgeInsets.all(16), child: Row(children: [Icon(Icons.verified_user_outlined, color: VelioColors.primaryDeep), SizedBox(width: 12), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('No vouches yet', style: TextStyle(fontWeight: FontWeight.w700)), Text('A personal invite for one friend, with your name on it.', style: TextStyle(fontSize: 13, color: VelioColors.body))]))])),
      const SizedBox(height: 10),
      const VelioCard(padding: EdgeInsets.all(16), child: Row(children: [Icon(Icons.link, color: VelioColors.primaryDeep), SizedBox(width: 12), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('No links shared yet', style: TextStyle(fontWeight: FontWeight.w700)), Text('Anyone with the link can join your plan while spots last.', style: TextStyle(fontSize: 13, color: VelioColors.body))]))])),
    ]);
  }
}

class _Filled extends StatelessWidget {
  const _Filled({required this.data, required this.filter, required this.onFilter});

  final MyInvites data;
  final String filter;
  final ValueChanged<String> onFilter;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    Widget tile(String n, String label) => Expanded(child: VelioCard(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(n, style: text.headlineMedium), Text(label, style: text.bodySmall)])));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(children: [tile('${data.sent}', 'Sent'), const SizedBox(width: 10), tile('${data.joined}', 'Joined you'), const SizedBox(width: 10), tile('${data.waiting}', 'Waiting')]),
        const SizedBox(height: 16),
        SizedBox(
          height: 44,
          child: ListView(scrollDirection: Axis.horizontal, children: [
            for (final f in const ['all', 'waiting', 'joined', 'missed'])
              Padding(
                padding: const EdgeInsets.only(right: 8),
                child: FilterChip(label: Text(f[0].toUpperCase() + f.substring(1)), selected: filter == f, showCheckmark: false, labelStyle: TextStyle(fontWeight: FontWeight.w600, color: filter == f ? Colors.white : VelioColors.body), onSelected: (_) => onFilter(f)),
              ),
          ]),
        ),
        const SizedBox(height: 16),
        for (final g in data.groups)
          if (g.invites.any((i) => filter == 'all' || _filterOf(i) == filter)) ...[
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              Text(g.activity.title, style: text.titleMedium),
              Text(g.activity.hasStarted ? 'Past' : '${formatDay(g.activity.startsAt, g.activity.timezone)} · ${g.activity.isFull ? 'Full' : '${g.activity.spotsLeft} left'}', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: g.activity.hasStarted ? VelioColors.muted : spotColour(g.activity.spotsLeft))),
            ]),
            const SizedBox(height: 8),
            VelioCard(
              padding: EdgeInsets.zero,
              child: Column(children: [
                for (final (index, i) in g.invites.where((i) => filter == 'all' || _filterOf(i) == filter).indexed) ...[
                  if (index > 0) const Divider(height: 1, indent: 16, endIndent: 16),
                  InviteRow(invite: i, activity: g.activity),
                ],
              ]),
            ),
            const SizedBox(height: 16),
          ],
        Text('Names here are the labels you gave when inviting. Only you can see them.', style: text.bodySmall),
      ],
    );
  }
}
