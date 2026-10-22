import 'package:flutter/material.dart';

import '../core/errors.dart';
import '../core/format.dart';
import '../core/theme.dart';

/// The dot, text, bar and "Live" tag every spot count on the canvas uses.
class SpotsLine extends StatelessWidget {
  const SpotsLine({super.key, required this.spotsLeft, required this.capacity, this.live = true, this.short = false, this.bar = true, this.liveLabel});

  final int spotsLeft;
  final int capacity;
  final bool live;
  final bool short;
  final bool bar;
  final String? liveLabel;

  @override
  Widget build(BuildContext context) {
    final dot = dotColour(spotsLeft);
    final taken = capacity > 0 ? (capacity - spotsLeft).clamp(0, capacity) / capacity : 0.0;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Container(width: 8, height: 8, decoration: BoxDecoration(color: dot, shape: BoxShape.circle, boxShadow: [BoxShadow(color: dot.withValues(alpha: 0.18), spreadRadius: 4)])),
            const SizedBox(width: 10),
            Expanded(
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 250),
                child: Text(spotsText(spotsLeft, capacity, short: short), key: ValueKey(spotsLeft), style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: spotColour(spotsLeft))),
              ),
            ),
            Text(liveLabel ?? (live ? 'LIVE' : 'NOT LIVE'), style: Theme.of(context).textTheme.labelSmall),
          ],
        ),
        if (bar) ...[
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(2),
            child: SizedBox(
              height: 4,
              child: Stack(children: [
                Container(color: VelioColors.border),
                AnimatedFractionallySizedBox(duration: const Duration(milliseconds: 350), widthFactor: taken.toDouble(), child: Container(color: dot)),
              ]),
            ),
          ),
        ],
      ],
    );
  }
}

class Avatar extends StatelessWidget {
  const Avatar({super.key, required this.name, this.size = 32, this.colour});

  final String name;
  final double size;
  final Color? colour;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(color: colour ?? avatarColour(name), shape: BoxShape.circle),
      child: Text(initial(name), style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: size * 0.42)),
    );
  }
}

class AvatarStack extends StatelessWidget {
  const AvatarStack({super.key, required this.names, this.size = 32});

  final List<String> names;
  final double size;

  @override
  Widget build(BuildContext context) {
    final shown = names.take(4).toList();
    return SizedBox(
      height: size,
      width: size + (shown.length - 1) * (size - 8),
      child: Stack(
        children: [
          for (var i = 0; i < shown.length; i++)
            Positioned(
              left: i * (size - 8),
              child: Container(
                decoration: const BoxDecoration(shape: BoxShape.circle, border: Border.fromBorderSide(BorderSide(color: VelioColors.ground, width: 2))),
                child: Avatar(name: shown[i], size: size - 4),
              ),
            ),
        ],
      ),
    );
  }
}

class VelioCard extends StatelessWidget {
  const VelioCard({super.key, required this.child, this.padding = const EdgeInsets.all(20), this.clip = false});

  final Widget child;
  final EdgeInsets padding;
  final bool clip;

  @override
  Widget build(BuildContext context) {
    return Container(
      clipBehavior: clip ? Clip.antiAlias : Clip.none,
      decoration: BoxDecoration(color: VelioColors.surface, borderRadius: BorderRadius.circular(VelioRadius.card), boxShadow: VelioShadows.card),
      padding: padding,
      child: child,
    );
  }
}

class Cta extends StatelessWidget {
  const Cta({super.key, required this.label, this.onPressed, this.busy = false, this.tint = false});

  final String label;
  final VoidCallback? onPressed;
  final bool busy;
  final bool tint;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(VelioRadius.button), boxShadow: onPressed != null && !tint ? VelioShadows.cta : null),
      child: FilledButton(
        onPressed: busy ? null : onPressed,
        style: tint ? FilledButton.styleFrom(backgroundColor: VelioColors.primaryTint, foregroundColor: VelioColors.primaryDeep) : null,
        child: busy
            ? Row(mainAxisSize: MainAxisSize.min, children: [
                const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white)),
                const SizedBox(width: 10),
                Text(label),
              ])
            : Text(label),
      ),
    );
  }
}

class Chip2 extends StatelessWidget {
  const Chip2(this.label, {super.key, this.tone = 'grey'});

  final String label;
  final String tone;

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = switch (tone) {
      'ok' => (VelioColors.primaryTint, VelioColors.primaryDeep),
      'warn' => (VelioColors.warningBackground, VelioColors.warningText),
      'dim' => (const Color(0xFFEEF0F2), VelioColors.muted),
      _ => (const Color(0xFFEEF0F2), VelioColors.body),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
      child: Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: fg)),
    );
  }
}

class Notice extends StatelessWidget {
  const Notice({super.key, required this.title, this.body, this.ok = false, this.child});

  final String title;
  final String? body;
  final bool ok;
  final Widget? child;

  @override
  Widget build(BuildContext context) {
    final fg = ok ? VelioColors.primaryDeep : VelioColors.warningText;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: ok ? VelioColors.primaryTint : VelioColors.warningBackground, borderRadius: BorderRadius.circular(16)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: fg)),
          if (body != null) ...[const SizedBox(height: 4), Text(body!, style: TextStyle(fontSize: 14, height: 1.4, color: fg))],
          if (child != null) ...[const SizedBox(height: 10), child!],
        ],
      ),
    );
  }
}

class ErrorView extends StatelessWidget {
  const ErrorView({super.key, required this.code, this.inviter, this.action});

  final ApiErrorCode code;
  final String? inviter;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final copy = ErrorCopy.of(code, inviter: inviter ?? 'the person who sent it');
    return VelioCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(copy.title, style: Theme.of(context).textTheme.headlineSmall),
          if (copy.body.isNotEmpty) ...[const SizedBox(height: 6), Text(copy.body, style: Theme.of(context).textTheme.bodyLarge)],
          if (action != null) ...[const SizedBox(height: 12), action!],
        ],
      ),
    );
  }
}

class EmptyView extends StatelessWidget {
  const EmptyView({super.key, required this.title, required this.body, this.children = const []});

  final String title;
  final String body;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return VelioCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 6),
          Text(body, style: Theme.of(context).textTheme.bodyLarge),
          if (children.isNotEmpty) const SizedBox(height: 14),
          ...children,
        ],
      ),
    );
  }
}

class Skeleton extends StatelessWidget {
  const Skeleton({super.key, this.height = 14, this.width, this.radius = 8});

  final double height;
  final double? width;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return Container(height: height, width: width, decoration: BoxDecoration(color: VelioColors.border, borderRadius: BorderRadius.circular(radius)));
  }
}

class OfflineBanner extends StatelessWidget {
  const OfflineBanner({super.key, this.savedAt});

  final DateTime? savedAt;

  @override
  Widget build(BuildContext context) {
    final when = savedAt == null ? '' : ' Showing what we saved at ${TimeOfDay.fromDateTime(savedAt!.toLocal()).format(context)}.';
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
      color: VelioColors.warningBackground,
      child: Text("You're offline.$when", style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: VelioColors.warningText)),
    );
  }
}

class PageTitle extends StatelessWidget {
  const PageTitle(this.title, {super.key, this.sub});

  final String title;
  final String? sub;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: Theme.of(context).textTheme.displaySmall),
        if (sub != null) ...[const SizedBox(height: 8), Text(sub!, style: Theme.of(context).textTheme.bodyLarge)],
      ],
    );
  }
}

class Wordmark extends StatelessWidget {
  const Wordmark({super.key});

  @override
  Widget build(BuildContext context) => Text('velio', style: Theme.of(context).textTheme.titleLarge);
}

void showToast(BuildContext context, String message) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(message), duration: const Duration(seconds: 3)));
}
