import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../../widgets/bits.dart';
import '../../widgets/cover.dart';
import '../booking/activity_controller.dart';
import '../booking/invite_sheet.dart';
import '../invites/invites_screen.dart';

final activityInvitesProvider = FutureProvider.autoDispose.family<MyInvites, String>((ref, activityId) {
  ref.watch(sessionProvider);
  return ref.watch(apiProvider).myInvites(activityId: activityId);
});

/// "Activity you're going to": your group, live spots, and your invites for it.
class GoingScreen extends ConsumerWidget {
  const GoingScreen({super.key, required this.entry});

  final PlanEntry entry;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = Theme.of(context).textTheme;
    final live = ref.watch(activityProvider(entry.activity.id)).value;
    final a = live?.activity ?? entry.activity;
    final userId = ref.watch(sessionProvider);
    final invites = ref.watch(activityInvitesProvider(a.id));
    return Scaffold(
      appBar: AppBar(title: Text("You're going · ${entry.viewerRole == 'owner' ? 'your group' : "${entry.plan.owner.displayName}'s group"}", style: text.titleSmall)),
      body: ListView(
        padding: const EdgeInsets.all(VelioSpace.page),
        children: [
          Text(a.title, style: text.headlineMedium),
          const SizedBox(height: 4),
          Text('Hosted by ${a.host.displayName}', style: text.bodyMedium),
          const SizedBox(height: 16),
          VelioCard(
            clip: true,
            padding: EdgeInsets.zero,
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              CoverCarousel(illustration: a.illustration, photos: a.photos, height: 140),
              Padding(
                padding: const EdgeInsets.all(16),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(a.description, style: text.bodyMedium),
                  const SizedBox(height: 10),
                  Text('${formatWhen(a.startsAt, a.timezone)} local time', style: text.bodyMedium),
                  Text(a.location, style: text.bodyMedium),
                  Text('${formatMoney(a.price)} per person, pay ${a.host.displayName} on the day', style: text.bodyMedium),
                ]),
              ),
            ]),
          ),
          const SizedBox(height: 16),
          VelioCard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                Text('Your group · ${entry.plan.membersCount}', style: text.titleSmall),
                Text(spotsText(a.spotsLeft, a.capacity, short: true), style: TextStyle(fontWeight: FontWeight.w700, color: spotColour(a.spotsLeft))),
              ]),
              const SizedBox(height: 12),
              Wrap(spacing: 14, runSpacing: 8, children: [
                for (final m in entry.plan.members)
                  Row(mainAxisSize: MainAxisSize.min, children: [
                    Avatar(name: m.displayName, size: 28),
                    const SizedBox(width: 6),
                    Text(m.userId == userId ? 'You' : m.displayName, style: const TextStyle(fontWeight: FontWeight.w600))
                  ]),
              ]),
            ]),
          ),
          const SizedBox(height: 20),
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Text('Your invites for this', style: text.titleMedium),
            TextButton(onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const InvitesScreen(standalone: true))), child: const Text('All invites')),
          ]),
          invites.maybeWhen(
            data: (data) {
              final rows = data.groups.expand((g) => g.invites).toList();
              if (rows.isEmpty) return Text("You haven't invited anyone to this yet.", style: text.bodyMedium);
              return VelioCard(
                padding: EdgeInsets.zero,
                child: Column(children: [
                  for (var i = 0; i < rows.length; i++) ...[
                    if (i > 0) const Divider(height: 1, indent: 16, endIndent: 16),
                    InviteRow(invite: rows[i], activity: a),
                  ],
                ]),
              );
            },
            orElse: () => const Skeleton(height: 120, radius: 20),
          ),
          const SizedBox(height: 10),
          Text("Invites don't hold a spot. ${a.spotsLeft > 0 ? 'With ${a.spotsLeft} left, whoever claims first gets in.' : "It's full now."}", style: text.bodySmall),
          const SizedBox(height: 20),
          if (a.invitesEnabled && a.spotsLeft > 0) Cta(label: 'Invite someone else', onPressed: () => showInviteSheet(context, ref, activity: a)),
        ],
      ),
    );
  }
}

/// One invite as the inviter sees it, with its status chip and the nudge or copy action.
class InviteRow extends ConsumerStatefulWidget {
  const InviteRow({super.key, required this.invite, required this.activity});

  final Invite invite;
  final Activity activity;

  @override
  ConsumerState<InviteRow> createState() => _InviteRowState();
}

class _InviteRowState extends ConsumerState<InviteRow> {
  String? _done;

  Future<void> _reshare(String event) async {
    await Clipboard.setData(ClipboardData(text: widget.invite.url));
    track(ref, event, inviteCode: widget.invite.code, activityId: widget.activity.id);
    HapticFeedback.selectionClick();
    setState(() => _done = event == 'invite_nudged' ? 'Nudged · link copied' : 'Copied');
  }

  @override
  Widget build(BuildContext context) {
    final i = widget.invite;
    final text = Theme.of(context).textTheme;
    final label = i.recipientLabel ?? (i.isVouch ? 'Vouch' : 'Group chat link');
    final (chipLabel, tone) = switch (i.status) {
      'joined' => ('Joined ${i.joinedAt != null ? formatRelative(i.joinedAt!) : ''}'.trim(), 'ok'),
      'opened' => ('Opened, not claimed', 'warn'),
      'opened_when_full' => ('Opened when it was full', 'warn'),
      'not_opened' => ('Not opened yet', 'grey'),
      'expired' => (i.opensCount > 0 ? 'Expired' : 'Expired, never opened', 'dim'),
      'revoked' => ('Link turned off', 'dim'),
      _ => ('${i.opensCount} opened · ${i.joinedCount} joined', 'grey'),
    };
    final action = _done != null
        ? Text(_done!, style: text.bodySmall)
        : switch (i.status) {
            'opened' => TextButton(onPressed: () => _reshare('invite_nudged'), child: const Text('Nudge')),
            'not_opened' => TextButton(onPressed: () => _reshare('invite_link_copied'), child: const Text('Copy again')),
            _ => null,
          };
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 10, 8, 10),
      child: Row(children: [
        Avatar(name: i.isVouch ? label : '#', size: 32, colour: i.isVouch ? null : VelioColors.body),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label, style: const TextStyle(fontWeight: FontWeight.w700)),
            Text('${i.isVouch ? 'Vouch' : 'Public link'} · ${i.isVouch ? 'sent' : 'shared'} ${formatRelative(i.createdAt)}', style: text.bodySmall),
          ]),
        ),
        Chip2(chipLabel, tone: tone),
        if (action != null) action,
      ]),
    );
  }
}
