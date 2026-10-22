import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/errors.dart';
import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../../widgets/bits.dart';
import 'invite_controller.dart';
import 'invite_screen.dart';

/// "Got an invite code?" Types 8 characters, previews the activity, opens the invite.
class CodeScreen extends ConsumerStatefulWidget {
  const CodeScreen({super.key});

  @override
  ConsumerState<CodeScreen> createState() => _CodeScreenState();
}

class _CodeScreenState extends ConsumerState<CodeScreen> {
  final _controller = TextEditingController();
  Timer? _debounce;
  ResolvedInvite? _preview;
  ApiErrorCode? _error;
  bool _loading = false;

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _changed(String raw) {
    _debounce?.cancel();
    final code = normalizeCode(raw);
    setState(() {
      _preview = null;
      _error = null;
    });
    if (code.length != 8) return;
    _debounce = Timer(const Duration(milliseconds: 300), () => _lookup(code));
  }

  Future<void> _lookup(String code) async {
    setState(() => _loading = true);
    try {
      final invite = await ref.read(apiProvider).invite(code);
      if (!mounted) return;
      setState(() => _preview = invite);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.code);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final preview = _preview;
    final expired = preview != null && (preview.status == 'expired' || preview.status == 'started');
    final canOpen = preview != null && !expired;
    final text = Theme.of(context).textTheme;
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: VelioSpace.page),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  if (Navigator.of(context).canPop())
                    _BackButton(onTap: () => Navigator.of(context).pop(), label: 'Back to Explore')
                  else
                    const SizedBox(width: 44),
                  const Wordmark(),
                ],
              ),
              const SizedBox(height: 40),
              Text('Got an invite code?', style: text.displaySmall),
              const SizedBox(height: 8),
              Text("Every code is for a specific activity. Type the 8 characters your friend sent you. Capitals and dashes don't matter.", style: text.bodyLarge),
              const SizedBox(height: 28),
              Text('Invite code', style: text.labelMedium),
              const SizedBox(height: 8),
              TextField(
                controller: _controller,
                onChanged: _changed,
                textCapitalization: TextCapitalization.characters,
                autocorrect: false,
                autofocus: true,
                style: text.headlineMedium?.copyWith(letterSpacing: 4),
                textAlign: TextAlign.center,
                decoration: InputDecoration(hintText: 'AX7K-29QM', hintStyle: text.headlineMedium?.copyWith(color: VelioColors.border, letterSpacing: 4), errorText: null),
              ),
              const SizedBox(height: 12),
              if (_loading) const Skeleton(height: 14, width: 220),
              if (preview != null && !expired)
                Row(children: [
                  Container(width: 8, height: 8, decoration: const BoxDecoration(color: VelioColors.primary, shape: BoxShape.circle)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text('${preview.activity.title} · ${formatDay(preview.activity.startsAt, preview.activity.timezone)} · from ${preview.inviter.displayName}',
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: VelioColors.primaryDeep)),
                  ),
                ]),
              if (expired)
                Notice(
                  title: 'This invite has expired',
                  body: 'It was for ${preview.activity.title} on ${formatDay(preview.activity.startsAt, preview.activity.timezone)}, which has already happened.',
                  child: GestureDetector(onTap: () => Navigator.of(context).popUntil((r) => r.isFirst), child: const Text("See what's coming up", style: TextStyle(fontWeight: FontWeight.w700, color: VelioColors.warningText))),
                ),
              if (_error != null) Notice(title: ErrorCopy.of(_error!).title, body: ErrorCopy.of(_error!).body),
              const Spacer(),
              Cta(
                label: 'Open invite',
                onPressed: canOpen ? () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => InviteScreen(code: preview.code))) : null,
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}

class _BackButton extends StatelessWidget {
  const _BackButton({required this.onTap, required this.label});

  final VoidCallback onTap;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: label,
      button: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(22),
        child: Container(
          width: 44,
          height: 44,
          decoration: const BoxDecoration(color: VelioColors.surface, shape: BoxShape.circle, boxShadow: VelioShadows.card),
          child: const Icon(Icons.chevron_left, size: 22, color: VelioColors.ink),
        ),
      ),
    );
  }
}
