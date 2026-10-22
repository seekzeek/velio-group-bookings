import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../../widgets/bits.dart';
import '../booking/activity_screen.dart';
import '../booking/invite_sheet.dart';

/// "You're in." The plan's members, how each joined, the two reminder choices, and bring a friend.
class ClaimedScreen extends ConsumerStatefulWidget {
  const ClaimedScreen({super.key, required this.invite, required this.result});

  final ResolvedInvite invite;
  final ClaimResult result;

  @override
  ConsumerState<ClaimedScreen> createState() => _ClaimedScreenState();
}

class _ClaimedScreenState extends ConsumerState<ClaimedScreen> {
  bool _remind = true;
  bool _follow = false;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final plan = widget.result.booking.plan;
    final a = widget.result.booking.activity;
    final own = widget.invite.isHostInvite;
    final followName = own ? widget.invite.inviter.displayName : plan.owner.displayName;

    String describe(Member m) {
      if (m.userId == widget.result.userId) return own ? 'Started a group' : 'Just joined';
      if (m.role == 'owner') return 'Started the plan';
      return 'Going';
    }

    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(VelioSpace.page),
          children: [
            const SizedBox(height: 16),
            Text(own ? "You're in. Your own group starts here" : "You're in ${plan.owner.displayName}'s plan", style: text.displaySmall),
            const SizedBox(height: 8),
            Text('${a.title}, ${formatDay(a.startsAt, a.timezone)} at ${formatTime(a.startsAt, a.timezone)}. Your spot is saved.', style: text.bodyLarge),
            const SizedBox(height: 20),
            VelioCard(
              padding: EdgeInsets.zero,
              child: Column(
                children: [
                  for (var i = 0; i < plan.members.length; i++) ...[
                    if (i > 0) const Divider(height: 1, indent: 16, endIndent: 16),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      child: Row(children: [
                        Avatar(name: plan.members[i].displayName),
                        const SizedBox(width: 12),
                        Expanded(child: Text(plan.members[i].userId == widget.result.userId ? '${plan.members[i].displayName} (you)' : plan.members[i].displayName, style: const TextStyle(fontWeight: FontWeight.w700))),
                        Text(describe(plan.members[i]), style: text.bodySmall),
                      ]),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 16),
            SpotsLine(spotsLeft: a.spotsLeft, capacity: a.capacity),
            const SizedBox(height: 20),
            Semantics(
              label: 'Messages from Velio',
              child: Column(children: [
                _Choice(label: 'Remind me the day before', value: _remind, onChanged: (v) {
                  setState(() => _remind = v);
                  ref.read(apiProvider).updatePreferences(remindDayBefore: v).catchError((_) {});
                }),
                _Choice(label: 'Tell me when $followName plans something new', value: _follow, onChanged: (v) {
                  setState(() => _follow = v);
                  ref.read(apiProvider).updatePreferences(friendUpdates: v).catchError((_) {});
                }),
              ]),
            ),
            const SizedBox(height: 20),
            Text("Someone you'd want there too? Spots are going.", style: text.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
            const SizedBox(height: 10),
            if (a.invitesEnabled && a.spotsLeft > 0)
              Cta(label: 'Bring a friend', onPressed: () => showInviteSheet(context, ref, activity: a, guest: true)),
            if (a.invitesEnabled && a.spotsLeft > 0) const SizedBox(height: 10),
            OutlinedButton(
              onPressed: () => Navigator.of(context).pushAndRemoveUntil(MaterialPageRoute<void>(builder: (_) => ActivityScreen(activityId: a.id)), (r) => r.isFirst),
              child: const Text('See the activity'),
            ),
          ],
        ),
      ),
    );
  }
}

class _Choice extends StatelessWidget {
  const _Choice({required this.label, required this.value, required this.onChanged});

  final String label;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => onChanged(!value),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(children: [
          Checkbox(value: value, onChanged: (v) => onChanged(v ?? false)),
          const SizedBox(width: 4),
          Expanded(child: Text(label, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600))),
        ]),
      ),
    );
  }
}
