import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/errors.dart';
import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../../widgets/bits.dart';
import '../../widgets/cover.dart';
import '../booking/activity_controller.dart';
import '../booking/activity_screen.dart';
import 'details_screen.dart';
import 'invite_controller.dart';

/// The invite landing: who invited you, the activity, live spots, who's already in, and the claim button.
/// Also every state that isn't "open": filled up, expired, used, turned off, already going, offline.
class InviteScreen extends ConsumerWidget {
  const InviteScreen({super.key, required this.code});

  final String code;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(inviteProvider(code));
    final online = isOnline(ref);
    return Scaffold(
      body: SafeArea(
        child: state.when(
          loading: () => const _InviteSkeleton(),
          error: (err, _) => _InviteError(code: code, error: err),
          data: (view) {
            if (view.invite.status != 'open') return _StatusScreen(view: view);
            if (view.invite.alreadyInPlan) return _AlreadyGoing(view: view);
            if (view.fromCache || !online) return _Offline(view: view);
            if (view.spotsLeft <= 0) return FilledUpScreen(view: view);
            return _Open(view: view);
          },
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.codeDisplay});

  final String codeDisplay;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(VelioSpace.page, 12, VelioSpace.page, 0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [const Wordmark(), Text('Invite $codeDisplay', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: VelioColors.muted))],
      ),
    );
  }
}

class InviterRow extends StatelessWidget {
  const InviterRow({super.key, required this.invite});

  final ResolvedInvite invite;

  @override
  Widget build(BuildContext context) {
    final name = invite.inviter.displayName;
    final headline = invite.isHostInvite
        ? (invite.isVouch ? '$name, the host, vouched for you' : '$name, the host, shared this with you')
        : (invite.isVouch ? '$name vouched for you' : '$name shared this with you');
    final sub = invite.isHostInvite
        ? "$name is running this and wants you there. You'll start your own group."
        : (invite.isVouch ? '$name is going and saved this invite just for you.' : '$name is going. Anyone with this link can join while spots last.');
    return Row(
      children: [
        Avatar(name: name, size: 48, colour: invite.isHostInvite ? const Color(0xFF2F6D3A) : null),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(headline, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700, height: 1.25)),
              const SizedBox(height: 2),
              Text(sub, style: const TextStyle(fontSize: 14, height: 1.4, color: VelioColors.muted)),
            ],
          ),
        ),
      ],
    );
  }
}

class _Open extends ConsumerWidget {
  const _Open({required this.view});

  final InviteView view;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final invite = view.invite;
    final a = invite.activity;
    final text = Theme.of(context).textTheme;
    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.only(bottom: 16),
            children: [
              _Header(codeDisplay: invite.codeDisplay),
              const SizedBox(height: 24),
              Padding(padding: const EdgeInsets.symmetric(horizontal: VelioSpace.page), child: InviterRow(invite: invite)),
              if (invite.isVouch) ...[
                const SizedBox(height: 16),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: VelioSpace.page),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(color: VelioColors.primaryTint, borderRadius: BorderRadius.circular(999)),
                      child: const Row(mainAxisSize: MainAxisSize.min, children: [
                        Icon(Icons.verified_user_outlined, size: 16, color: VelioColors.primaryDeep),
                        SizedBox(width: 6),
                        Text('Vouch · only you can claim this', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: VelioColors.primaryDeep)),
                      ]),
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 16),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: VelioSpace.page),
                child: VelioCard(
                  clip: true,
                  padding: EdgeInsets.zero,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Cover(illustration: a.illustration, photos: a.photos, height: 160),
                      Padding(
                        padding: const EdgeInsets.all(20),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Expanded(child: Text(a.title, style: text.headlineMedium)),
                                const SizedBox(width: 12),
                                Padding(padding: const EdgeInsets.only(top: 4), child: Text(formatMoney(a.price), style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700))),
                              ],
                            ),
                            const SizedBox(height: 16),
                            _Fact(icon: Icons.calendar_today_outlined, text: '${formatWhen(a.startsAt, a.timezone)} local time'),
                            const SizedBox(height: 8),
                            _Fact(icon: Icons.location_on_outlined, text: a.location),
                            const SizedBox(height: 14),
                            const Divider(height: 1),
                            const SizedBox(height: 14),
                            SpotsLine(spotsLeft: view.spotsLeft, capacity: a.capacity, live: view.live),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Padding(padding: const EdgeInsets.symmetric(horizontal: VelioSpace.page), child: _PlanRow(invite: invite)),
            ],
          ),
        ),
        Container(
          padding: const EdgeInsets.fromLTRB(VelioSpace.page, 12, VelioSpace.page, 16),
          decoration: const BoxDecoration(color: VelioColors.surface, boxShadow: [BoxShadow(color: VelioColors.border, offset: Offset(0, -1))]),
          child: Column(
            children: [
              Cta(label: 'Claim your spot', onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => DetailsScreen(code: invite.code)))),
              const SizedBox(height: 10),
              Text('Nothing is charged in the app. You pay the host on the day.', style: text.bodySmall, textAlign: TextAlign.center),
            ],
          ),
        ),
      ],
    );
  }
}

class _Fact extends StatelessWidget {
  const _Fact({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(children: [Icon(icon, size: 16, color: VelioColors.body), const SizedBox(width: 10), Expanded(child: Text(text, style: const TextStyle(fontSize: 14, color: VelioColors.body)))]);
  }
}

class _PlanRow extends StatelessWidget {
  const _PlanRow({required this.invite});

  final ResolvedInvite invite;

  @override
  Widget build(BuildContext context) {
    final plan = invite.plan;
    final names = plan == null ? [invite.inviter.displayName] : plan.members.map((m) => m.displayName).toList();
    final n = invite.activity.plansCount;
    final label = plan == null
        ? '${invite.inviter.displayName} is hosting · $n ${n == 1 ? 'group' : 'groups'} going so far'
        : '${listNames(names)} ${names.length == 1 ? 'is' : 'are'} in this plan';
    return Row(children: [AvatarStack(names: names), const SizedBox(width: 10), Expanded(child: Text(label, style: const TextStyle(fontSize: 14, color: VelioColors.body)))]);
  }
}

class _InviteSkeleton extends StatelessWidget {
  const _InviteSkeleton();

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Loading your invite',
      child: ListView(
        padding: const EdgeInsets.all(VelioSpace.page),
        children: const [
          SizedBox(height: 44),
          Row(children: [Skeleton(height: 48, width: 48, radius: 24), SizedBox(width: 12), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Skeleton(height: 16, width: 180), SizedBox(height: 8), Skeleton(height: 12, width: 240)]))]),
          SizedBox(height: 16),
          Skeleton(height: 30, width: 200, radius: 999),
          SizedBox(height: 16),
          Skeleton(height: 160, radius: 20),
          SizedBox(height: 16),
          Skeleton(height: 24, width: 220),
          SizedBox(height: 12),
          Skeleton(height: 12, width: 160),
        ],
      ),
    );
  }
}

class _InviteError extends ConsumerWidget {
  const _InviteError({required this.code, required this.error});

  final String code;
  final Object error;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final apiError = error is ApiException ? error as ApiException : null;
    final errorCode = apiError?.code ?? ApiErrorCode.tryAgain;
    return Padding(
      padding: const EdgeInsets.all(VelioSpace.page),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 24),
          ErrorView(
            code: errorCode,
            action: apiError?.isRetryable == true
                ? TextButton(onPressed: () => ref.invalidate(inviteProvider(code)), child: const Text('Try again'))
                : TextButton(onPressed: () => Navigator.of(context).popUntil((r) => r.isFirst), child: const Text("See what's coming up")),
          ),
        ],
      ),
    );
  }
}

class _StatusScreen extends StatelessWidget {
  const _StatusScreen({required this.view});

  final InviteView view;

  @override
  Widget build(BuildContext context) {
    final invite = view.invite;
    final code = statusError(invite.status);
    return ListView(
      padding: const EdgeInsets.all(VelioSpace.page),
      children: [
        _Header(codeDisplay: invite.codeDisplay),
        const SizedBox(height: 24),
        InviterRow(invite: invite),
        const SizedBox(height: 20),
        ErrorView(
          code: code,
          inviter: invite.inviter.displayName,
          action: invite.status == 'off'
              ? TextButton(onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => ActivityScreen(activityId: invite.activity.id))), child: const Text('Book a spot directly'))
              : TextButton(onPressed: () => Navigator.of(context).popUntil((r) => r.isFirst), child: const Text("See what's coming up")),
        ),
      ],
    );
  }
}

class _AlreadyGoing extends StatelessWidget {
  const _AlreadyGoing({required this.view});

  final InviteView view;

  @override
  Widget build(BuildContext context) {
    final invite = view.invite;
    return ListView(
      padding: const EdgeInsets.all(VelioSpace.page),
      children: [
        _Header(codeDisplay: invite.codeDisplay),
        const SizedBox(height: 24),
        InviterRow(invite: invite),
        const SizedBox(height: 20),
        ErrorView(
          code: ApiErrorCode.alreadyBooked,
          action: TextButton(onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => ActivityScreen(activityId: invite.activity.id))), child: const Text('See your plan')),
        ),
      ],
    );
  }
}

class _Offline extends ConsumerWidget {
  const _Offline({required this.view});

  final InviteView view;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final invite = view.invite;
    final a = invite.activity;
    final text = Theme.of(context).textTheme;
    final savedAt = view.savedAt ?? DateTime.now();
    final pending = pendingClaimFor(ref, invite.code);
    final savedTime = TimeOfDay.fromDateTime(savedAt.toLocal()).format(context);
    return Column(
      children: [
        OfflineBanner(savedAt: savedAt),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(VelioSpace.page),
            children: [
              Row(children: [
                Avatar(name: invite.inviter.displayName, size: 40),
                const SizedBox(width: 12),
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(invite.isVouch ? '${invite.inviter.displayName} vouched for you' : '${invite.inviter.displayName} shared this with you', style: const TextStyle(fontWeight: FontWeight.w700)),
                  Text('Invite ${invite.codeDisplay}', style: text.bodySmall),
                ]),
              ]),
              const SizedBox(height: 20),
              Text(a.title, style: text.headlineMedium),
              const SizedBox(height: 12),
              Text('${formatWhen(a.startsAt, a.timezone)} local time', style: text.bodyMedium),
              const SizedBox(height: 4),
              Text(a.location, style: text.bodyMedium),
              const SizedBox(height: 4),
              Text('${formatMoney(a.price)} per spot', style: text.bodyMedium?.copyWith(fontWeight: FontWeight.w700)),
              const SizedBox(height: 16),
              SpotsLine(spotsLeft: view.spotsLeft, capacity: a.capacity, live: false, liveLabel: 'NOT LIVE'),
              const SizedBox(height: 4),
              Text('${view.spotsLeft} of ${a.capacity} left at $savedTime', style: text.bodySmall),
              const SizedBox(height: 20),
              if (pending != null)
                const Notice(ok: true, title: 'Your name and number are saved.', body: "When you're back online, it's one tap to claim, and tapping twice can never book you twice."),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(VelioSpace.page, 0, VelioSpace.page, 16),
          child: Column(children: [
            Cta(label: pending != null ? "Claim when you're back online" : 'Claim your spot', onPressed: null),
            const SizedBox(height: 8),
            Text('We need a connection to make sure the spot is still yours.', style: text.bodySmall, textAlign: TextAlign.center),
          ]),
        ),
      ],
    );
  }
}

/// "This one filled up before you got here."
class FilledUpScreen extends ConsumerStatefulWidget {
  const FilledUpScreen({super.key, required this.view});

  final InviteView view;

  @override
  ConsumerState<FilledUpScreen> createState() => _FilledUpScreenState();
}

class _FilledUpScreenState extends ConsumerState<FilledUpScreen> {
  bool _watching = false;
  bool _told = false;

  @override
  Widget build(BuildContext context) {
    final invite = widget.view.invite;
    final a = invite.activity;
    final name = invite.inviter.displayName;
    final text = Theme.of(context).textTheme;
    final others = ref.watch(otherDatesProvider((hostId: a.host.id, excludeId: a.id)));
    return ListView(
      padding: const EdgeInsets.all(VelioSpace.page),
      children: [
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [const Wordmark(), Text('Invite ${invite.codeDisplay}', style: text.bodySmall)]),
        const SizedBox(height: 20),
        Row(children: [
          Avatar(name: name, size: 40),
          const SizedBox(width: 12),
          Expanded(child: Text.rich(TextSpan(text: '$name wanted you on ', children: [TextSpan(text: a.title, style: const TextStyle(fontWeight: FontWeight.w700)), TextSpan(text: ' on ${formatDay(a.startsAt, a.timezone)}.')]), style: text.bodyMedium)),
        ]),
        const SizedBox(height: 20),
        Text('This one filled up before you got here', style: text.displaySmall),
        const SizedBox(height: 8),
        Text("Your invite is still good. If someone drops out, we'll tell you straight away and you can take their spot.", style: text.bodyLarge),
        const SizedBox(height: 20),
        SpotsLine(spotsLeft: 0, capacity: a.capacity, live: widget.view.live),
        const SizedBox(height: 20),
        Cta(
          label: _watching ? "We'll tell you if a spot opens" : 'Tell me if a spot opens',
          tint: _watching,
          onPressed: () {
            setState(() => _watching = true);
            ref.read(apiProvider).watch(a.id, anonId: ref.read(anonIdProvider)).catchError((_) {});
          },
        ),
        const SizedBox(height: 28),
        others.maybeWhen(
          data: (rows) => rows.isEmpty
              ? const SizedBox.shrink()
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Same host, other dates', style: text.titleMedium),
                    const SizedBox(height: 10),
                    for (final other in rows)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: InkWell(
                          onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => ActivityScreen(activityId: other.id))),
                          borderRadius: BorderRadius.circular(16),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                            decoration: BoxDecoration(color: VelioColors.surface, borderRadius: BorderRadius.circular(16), border: Border.all(color: VelioColors.border)),
                            child: Row(children: [
                              Expanded(
                                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                  Text(other.title, style: const TextStyle(fontWeight: FontWeight.w700)),
                                  Text('${formatWhen(other.startsAt, other.timezone)} · ${formatMoney(other.price)}', style: text.bodyMedium),
                                ]),
                              ),
                              Text('${other.spotsLeft} left', style: const TextStyle(fontWeight: FontWeight.w700, color: VelioColors.primaryDeep)),
                            ]),
                          ),
                        ),
                      ),
                  ],
                ),
          orElse: () => const SizedBox.shrink(),
        ),
        const SizedBox(height: 12),
        Center(
          child: TextButton(
            onPressed: _told
                ? null
                : () {
                    setState(() => _told = true);
                    track(ref, 'invite_missed', inviteCode: invite.code, activityId: a.id);
                  },
            child: Text(_told ? '$name knows you missed it' : 'Let $name know you missed it'),
          ),
        ),
      ],
    );
  }
}
