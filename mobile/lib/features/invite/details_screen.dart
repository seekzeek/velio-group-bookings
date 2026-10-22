import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/errors.dart';
import '../../core/format.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../../widgets/bits.dart';
import '../booking/activity_controller.dart';
import 'claimed_screen.dart';
import 'invite_controller.dart';
import 'invite_screen.dart';

/// "Almost there": name and contact, then claim. Keeps the typed values and the idempotency key if the phone is offline.
class DetailsScreen extends ConsumerStatefulWidget {
  const DetailsScreen({super.key, required this.code});

  final String code;

  @override
  ConsumerState<DetailsScreen> createState() => _DetailsScreenState();
}

class _DetailsScreenState extends ConsumerState<DetailsScreen> {
  late final TextEditingController _name;
  late final TextEditingController _contact;
  late final String _idempotencyKey;
  ApiException? _error;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    final pending = pendingClaimFor(ref, widget.code);
    _idempotencyKey = pending?.idempotencyKey ?? newIdempotencyKey();
    _name = TextEditingController(text: pending?.displayName ?? '');
    _contact = TextEditingController(text: pending?.contact ?? '');
    WidgetsBinding.instance.addPostFrameCallback((_) => track(ref, 'claim_started', inviteCode: widget.code));
  }

  @override
  void dispose() {
    _name.dispose();
    _contact.dispose();
    super.dispose();
  }

  Future<void> _claim() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final result = await ref.read(inviteProvider(widget.code).notifier).claim(idempotencyKey: _idempotencyKey, displayName: _name.text.trim(), contact: _contact.text.trim());
      if (!mounted) return;
      final view = ref.read(inviteProvider(widget.code)).value!;
      Navigator.of(context).pushReplacement(MaterialPageRoute<void>(builder: (_) => ClaimedScreen(invite: view.invite, result: result)));
    } on ApiException catch (e) {
      if (!mounted) return;
      if (e.code == ApiErrorCode.soldOut) {
        final view = ref.read(inviteProvider(widget.code)).value;
        if (view != null) {
          Navigator.of(context).pushReplacement(MaterialPageRoute<void>(builder: (_) => Scaffold(body: SafeArea(child: FilledUpScreen(view: view.copyWith(spotsLeft: 0))))));
          return;
        }
      }
      setState(() => _error = e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(inviteProvider(widget.code)).value;
    final online = isOnline(ref);
    final text = Theme.of(context).textTheme;
    final invite = state?.invite;
    final inviter = invite?.inviter.displayName ?? 'your friend';
    final isVouch = invite?.isVouch ?? true;
    final isHost = invite?.isHostInvite ?? false;
    final contactError = _error != null && (_error!.code == ApiErrorCode.inviteNotForYou || _error!.code == ApiErrorCode.validation);
    final offlineError = _error != null && _error!.code == ApiErrorCode.offline;

    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(VelioSpace.page),
          children: [
            Semantics(
              label: 'Back to the invite',
              button: true,
              child: Align(
                alignment: Alignment.centerLeft,
                child: InkWell(
                  onTap: () => Navigator.of(context).pop(),
                  borderRadius: BorderRadius.circular(22),
                  child: Container(width: 44, height: 44, decoration: const BoxDecoration(color: VelioColors.surface, shape: BoxShape.circle, boxShadow: VelioShadows.card), child: const Icon(Icons.chevron_left, size: 22)),
                ),
              ),
            ),
            const SizedBox(height: 24),
            Text('Almost there', style: text.displaySmall),
            const SizedBox(height: 8),
            Text(
              isHost
                  ? "Tell us who you are so $inviter knows who's coming. This also sets up your Velio account, so your plans are here next time. No password."
                  : "Tell us who you are so $inviter and the host know who's coming. This also sets up your Velio account, so your plans are here next time. No password.",
              style: text.bodyLarge,
            ),
            const SizedBox(height: 20),
            if (invite != null)
              VelioCard(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Row(children: [
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(invite.activity.title, style: const TextStyle(fontWeight: FontWeight.w700)),
                      Text(formatWhen(invite.activity.startsAt, invite.activity.timezone), style: text.bodyMedium),
                    ]),
                  ),
                  Text('${state!.spotsLeft} left', style: TextStyle(fontWeight: FontWeight.w700, color: spotColour(state.spotsLeft))),
                ]),
              ),
            const SizedBox(height: 24),
            Text('Your name', style: text.labelMedium),
            const SizedBox(height: 8),
            TextField(controller: _name, autofillHints: const [AutofillHints.givenName], textCapitalization: TextCapitalization.words, decoration: const InputDecoration(hintText: 'Chioma')),
            const SizedBox(height: 16),
            Text('Phone number or email', style: text.labelMedium),
            const SizedBox(height: 8),
            TextField(
              controller: _contact,
              keyboardType: TextInputType.emailAddress,
              autocorrect: false,
              decoration: InputDecoration(
                hintText: isVouch ? 'The one $inviter sent this to' : 'Phone number or email',
                errorText: contactError
                    ? (_error!.code == ApiErrorCode.inviteNotForYou ? 'This invite was sent to a different number or email. Check with $inviter which one they used.' : (_error!.details?['fields'] as Map?)?.values.first?.toString() ?? _error!.message)
                    : null,
                helperText: contactError
                    ? null
                    : isVouch
                        ? "$inviter's vouch is tied to this, so use the same number or email they have for you. We only keep a scrambled version of it."
                        : "We'll use this to find your plans next time. We only keep a scrambled version of it.",
                helperMaxLines: 3,
                errorMaxLines: 3,
              ),
            ),
            const SizedBox(height: 20),
            if (_error != null && !contactError)
              Notice(
                title: ErrorCopy.of(_error!.code, inviter: inviter).title,
                body: offlineError ? "Your name and number are saved. When you're back online, it's one tap to claim, and tapping twice can never book you twice." : ErrorCopy.of(_error!.code, inviter: inviter).body,
              ),
            if (_error != null && !contactError) const SizedBox(height: 16),
            Cta(
              label: !online || offlineError ? "Claim when you're back online" : 'Claim my spot',
              busy: _busy,
              onPressed: online && _name.text.isNotEmpty || online && _contact.text.isNotEmpty ? _claim : (online ? _claim : null),
            ),
            if (!online) ...[
              const SizedBox(height: 8),
              Text('We need a connection to make sure the spot is still yours.', style: text.bodySmall, textAlign: TextAlign.center),
            ],
          ],
        ),
      ),
    );
  }
}
