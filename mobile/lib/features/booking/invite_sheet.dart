import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/errors.dart';
import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../../widgets/bits.dart';

/// "You're going" with the invite sheet: vouch for one friend, or share a link through the phone's share sheet.
Future<void> showInviteSheet(BuildContext context, WidgetRef ref, {required Activity activity, bool guest = false}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: VelioColors.surface,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
    builder: (_) => Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: _InviteSheet(activity: activity, guest: guest),
    ),
  );
}

class _InviteSheet extends ConsumerStatefulWidget {
  const _InviteSheet({required this.activity, required this.guest});

  final Activity activity;
  final bool guest;

  @override
  ConsumerState<_InviteSheet> createState() => _InviteSheetState();
}

class _InviteSheetState extends ConsumerState<_InviteSheet> {
  final _label = TextEditingController();
  final _contact = TextEditingController();
  Invite? _sent;
  String? _error;
  bool _busy = false;
  bool _copied = false;

  @override
  void dispose() {
    _label.dispose();
    _contact.dispose();
    super.dispose();
  }

  Future<void> _sendVouch() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final invite = await ref.read(apiProvider).createInvite(rail: 'vouch', activityId: widget.activity.id, recipientContact: _contact.text.trim(), recipientLabel: _label.text.trim());
      HapticFeedback.lightImpact();
      setState(() => _sent = invite);
    } on ApiException catch (e) {
      setState(() => _error = e.code == ApiErrorCode.validation ? 'Enter a phone number or email.' : ErrorCopy.of(e.code).title);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _share(Invite? existing) async {
    setState(() => _busy = true);
    try {
      final invite = existing ?? await ref.read(apiProvider).createInvite(rail: 'public', activityId: widget.activity.id);
      track(ref, 'invite_link_shared', inviteCode: invite.code, activityId: widget.activity.id);
      await Share.share('Come to ${widget.activity.title} with me: ${invite.url}', subject: widget.activity.title);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = ErrorCopy.of(e.code).title);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _copy(Invite invite) async {
    await Clipboard.setData(ClipboardData(text: invite.url));
    track(ref, 'invite_link_copied', inviteCode: invite.code, activityId: widget.activity.id);
    setState(() => _copied = true);
  }

  @override
  Widget build(BuildContext context) {
    final a = widget.activity;
    final text = Theme.of(context).textTheme;
    final sent = _sent;
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(VelioSpace.page, 12, VelioSpace.page, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: VelioColors.border, borderRadius: BorderRadius.circular(2)))),
          const SizedBox(height: 16),
          Text(widget.guest ? "You're in. Bring a friend?" : "Who's coming with you?", style: text.headlineSmall),
          const SizedBox(height: 4),
          Text('${spotsText(a.spotsLeft, a.capacity)}, first come first served.', style: text.bodyMedium),
          const SizedBox(height: 20),
          if (sent == null) ...[
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), border: Border.all(color: VelioColors.border)),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(children: [Icon(Icons.verified_user_outlined, size: 20, color: VelioColors.primaryDeep), SizedBox(width: 8), Text('Vouch for a friend', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15))]),
                  const SizedBox(height: 4),
                  Text('For one person. It shows your name, and only they can claim it.', style: text.bodySmall),
                  const SizedBox(height: 14),
                  Text.rich(TextSpan(text: "Who's it for? ", children: [TextSpan(text: 'Only you see this', style: text.bodySmall)]), style: text.labelMedium),
                  const SizedBox(height: 6),
                  TextField(controller: _label, decoration: const InputDecoration(hintText: 'Tunde'), textCapitalization: TextCapitalization.words),
                  const SizedBox(height: 12),
                  Text('Their phone number or email', style: text.labelMedium),
                  const SizedBox(height: 6),
                  TextField(controller: _contact, keyboardType: TextInputType.emailAddress, autocorrect: false, decoration: InputDecoration(hintText: '+1 555 0100', errorText: _error)),
                  const SizedBox(height: 14),
                  Cta(label: 'Send vouch', busy: _busy, onPressed: _contact.text.trim().isEmpty && _busy ? null : _sendVouch),
                ],
              ),
            ),
          ] else ...[
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: VelioColors.primaryTint, borderRadius: BorderRadius.circular(16)),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Vouch sent${sent.recipientLabel != null ? ' to ${sent.recipientLabel}' : ''}', style: const TextStyle(fontWeight: FontWeight.w700, color: VelioColors.primaryDeep)),
                  const SizedBox(height: 4),
                  const Text('Only the number or email you entered can claim it, so send them the link however you like.', style: TextStyle(fontSize: 13, color: VelioColors.primaryDeep)),
                  const SizedBox(height: 12),
                  Text("${sent.recipientLabel ?? 'Their'} link · code ${sent.codeDisplay}", style: text.labelMedium),
                  const SizedBox(height: 6),
                  Row(children: [
                    Expanded(child: TextField(controller: TextEditingController(text: sent.url), readOnly: true)),
                    const SizedBox(width: 8),
                    FilledButton(onPressed: () => _copy(sent), style: FilledButton.styleFrom(minimumSize: const Size(72, 48)), child: Text(_copied ? 'Copied' : 'Copy')),
                  ]),
                  const SizedBox(height: 12),
                  Row(children: [
                    Expanded(child: OutlinedButton(onPressed: () => Share.share('Come to ${a.title} with me: ${sent.url}'), child: const Text('Share link'))),
                    const SizedBox(width: 8),
                    Expanded(child: OutlinedButton(onPressed: () => setState(() { _sent = null; _copied = false; _contact.clear(); _label.clear(); }), child: const Text('Vouch for someone else'))),
                  ]),
                ],
              ),
            ),
          ],
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), border: Border.all(color: VelioColors.border)),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(children: [Icon(Icons.link, size: 20, color: VelioColors.primaryDeep), SizedBox(width: 8), Text('Share a link', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15))]),
                const SizedBox(height: 4),
                Text('Post it in a group chat. Anyone with it can join your plan while spots last.', style: text.bodySmall),
                const SizedBox(height: 14),
                OutlinedButton.icon(onPressed: _busy ? null : () => _share(null), icon: const Icon(Icons.ios_share, size: 18), label: const Text('Share')),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Center(child: TextButton(onPressed: () => Navigator.of(context).pop(), child: Text(widget.guest ? 'Maybe later' : "Maybe later, it'll be in My plans"))),
        ],
      ),
    );
  }
}
