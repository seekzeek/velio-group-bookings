import 'package:flutter/material.dart';

import '../core/theme.dart';

const _bar = 56.0;

/// A large page title that shrinks into a compact bar as the list scrolls, with an optional row
/// (chips, tabs) that stays pinned underneath. Goes first in a CustomScrollView.
class CollapsingHeader extends StatelessWidget {
  const CollapsingHeader({super.key, required this.title, this.compactTitle, this.leading, this.action, this.pinned, this.pinnedHeight = 0, this.titleLines = 1});

  final String title;
  final String? compactTitle;
  final Widget? leading;
  final Widget? action;
  final Widget? pinned;
  final double pinnedHeight;
  final int titleLines;

  @override
  Widget build(BuildContext context) {
    return SliverPersistentHeader(
      pinned: true,
      delegate: _TitleDelegate(
        title: title,
        compactTitle: compactTitle,
        leading: leading,
        action: action,
        pinned: pinned,
        pinnedHeight: pinnedHeight,
        titleHeight: titleLines * 32.0 + 16,
        titleLines: titleLines,
        topPadding: MediaQuery.paddingOf(context).top,
        textTheme: Theme.of(context).textTheme,
      ),
    );
  }
}

class _TitleDelegate extends SliverPersistentHeaderDelegate {
  _TitleDelegate({
    required this.title,
    required this.compactTitle,
    required this.leading,
    required this.action,
    required this.pinned,
    required this.pinnedHeight,
    required this.titleHeight,
    required this.titleLines,
    required this.topPadding,
    required this.textTheme,
  });

  final String title;
  final String? compactTitle;
  final Widget? leading;
  final Widget? action;
  final Widget? pinned;
  final double pinnedHeight;
  final double titleHeight;
  final int titleLines;
  final double topPadding;
  final TextTheme textTheme;

  @override
  double get maxExtent => topPadding + _bar + titleHeight + pinnedHeight;

  @override
  double get minExtent => topPadding + _bar + pinnedHeight;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    final range = maxExtent - minExtent;
    final t = range <= 0 ? 1.0 : (shrinkOffset / range).clamp(0.0, 1.0);
    final eased = Curves.easeOutCubic.transform(t);
    final titleOpacity = (1 - t * 1.8).clamp(0.0, 1.0);
    final compactOpacity = ((t - 0.55) / 0.45).clamp(0.0, 1.0);

    return Container(
      color: VelioColors.ground,
      child: Stack(
        clipBehavior: Clip.hardEdge,
        children: [
          Positioned(
            top: topPadding + _bar - shrinkOffset,
            left: VelioSpace.page,
            right: VelioSpace.page,
            height: titleHeight,
            child: Padding(
              padding: const EdgeInsets.only(top: 4, bottom: 12),
              child: Opacity(
                opacity: titleOpacity,
                child: Transform.scale(
                  scale: 1 - 0.08 * eased,
                  alignment: Alignment.topLeft,
                  child: Align(alignment: Alignment.topLeft, child: Text(title, style: textTheme.displaySmall, maxLines: titleLines, overflow: TextOverflow.ellipsis)),
                ),
              ),
            ),
          ),
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            height: topPadding + _bar,
            child: Container(
              color: VelioColors.ground,
              padding: EdgeInsets.fromLTRB(VelioSpace.page, topPadding + 12, VelioSpace.page, 0),
              child: SizedBox(
                height: 44,
                child: Row(children: [
                  Expanded(
                    child: Stack(alignment: Alignment.centerLeft, children: [
                      if (leading != null) Opacity(opacity: compactTitle == null ? 1 : 1 - compactOpacity, child: leading),
                      if (compactTitle != null)
                        IgnorePointer(
                          child: Opacity(
                            opacity: compactOpacity,
                            child: Transform.translate(
                                offset: Offset(0, 6 * (1 - compactOpacity)), child: Text(compactTitle!, style: textTheme.titleMedium, maxLines: 1, overflow: TextOverflow.ellipsis)),
                          ),
                        ),
                    ]),
                  ),
                  if (action != null) action!,
                ]),
              ),
            ),
          ),
          if (pinned != null) Positioned(bottom: 0, left: 0, right: 0, height: pinnedHeight, child: Container(color: VelioColors.ground, child: pinned)),
          Positioned(bottom: 0, left: 0, right: 0, child: Opacity(opacity: t, child: Container(height: 1, color: VelioColors.border))),
        ],
      ),
    );
  }

  @override
  bool shouldRebuild(covariant _TitleDelegate old) => true;
}

/// A cover photo that scrolls away with parallax while a compact bar with the title fades in over it.
class CoverHeader extends StatelessWidget {
  const CoverHeader({super.key, required this.title, required this.cover, this.height = 260, this.onBack, this.backLabel = 'Back'});

  final String title;
  final Widget cover;
  final double height;
  final VoidCallback? onBack;
  final String backLabel;

  @override
  Widget build(BuildContext context) {
    return SliverPersistentHeader(
      pinned: true,
      delegate: _CoverDelegate(title: title, cover: cover, height: height, onBack: onBack, backLabel: backLabel, topPadding: MediaQuery.paddingOf(context).top, textTheme: Theme.of(context).textTheme),
    );
  }
}

class _CoverDelegate extends SliverPersistentHeaderDelegate {
  _CoverDelegate({required this.title, required this.cover, required this.height, required this.onBack, required this.backLabel, required this.topPadding, required this.textTheme});

  final String title;
  final Widget cover;
  final double height;
  final VoidCallback? onBack;
  final String backLabel;
  final double topPadding;
  final TextTheme textTheme;

  @override
  double get maxExtent => height;

  @override
  double get minExtent => topPadding + _bar;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    final range = maxExtent - minExtent;
    final t = range <= 0 ? 1.0 : (shrinkOffset / range).clamp(0.0, 1.0);
    final barOpacity = Curves.easeIn.transform(t);
    final titleOpacity = ((t - 0.5) * 2).clamp(0.0, 1.0);

    return ClipRect(
      child: Stack(
        fit: StackFit.expand,
        clipBehavior: Clip.hardEdge,
        children: [
          // The cover moves at half the scroll speed, so it slides under the bar instead of jumping away.
          Positioned(top: -shrinkOffset * 0.5, left: 0, right: 0, height: height, child: cover),
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            height: minExtent,
            child: IgnorePointer(
              child: Opacity(
                opacity: barOpacity,
                child: Container(
                  color: VelioColors.ground,
                  padding: EdgeInsets.fromLTRB(72, topPadding, VelioSpace.page, 0),
                  alignment: Alignment.centerLeft,
                  child: Opacity(
                    opacity: titleOpacity,
                    child: Transform.translate(offset: Offset(0, 8 * (1 - titleOpacity)), child: Text(title, style: textTheme.titleMedium, maxLines: 1, overflow: TextOverflow.ellipsis)),
                  ),
                ),
              ),
            ),
          ),
          Positioned(bottom: 0, left: 0, right: 0, child: Opacity(opacity: t, child: Container(height: 1, color: VelioColors.border))),
          if (onBack != null)
            Positioned(
              top: topPadding + 12 - 6 * t,
              left: VelioSpace.page,
              child: Semantics(
                label: backLabel,
                button: true,
                child: InkWell(
                  onTap: onBack,
                  borderRadius: BorderRadius.circular(22),
                  child: Container(
                      width: 44,
                      height: 44,
                      decoration: const BoxDecoration(color: VelioColors.surface, shape: BoxShape.circle, boxShadow: VelioShadows.card),
                      child: const Icon(Icons.chevron_left, size: 22)),
                ),
              ),
            ),
        ],
      ),
    );
  }

  @override
  bool shouldRebuild(covariant _CoverDelegate old) => true;
}
