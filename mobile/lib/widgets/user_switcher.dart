import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/models.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import 'bits.dart';

/// Stands in for sign-in, like the "Viewing as" picker on the web. A 36px initial in the page header that opens
/// a sheet of the seeded users. Not on the canvas, which has no sign-in; without it nobody can switch who they are.
class UserSwitcherButton extends ConsumerWidget {
  const UserSwitcherButton({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final current = ref.watch(sessionProvider);
    final users = ref.watch(usersProvider).value ?? const [];
    final picked = users.where((u) => u.id == current).firstOrNull;
    final name = picked?.displayName ?? (current != null ? 'Guest' : null);
    return Semantics(
      button: true,
      label: name == null ? 'Pick who you are' : 'Viewing as $name',
      child: InkWell(
        onTap: () => showUserSwitcher(context),
        customBorder: const CircleBorder(),
        child: SizedBox(
          width: 44,
          height: 44,
          child: Center(
            child: name == null
                ? Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: VelioColors.inputBorder, width: 1.5)),
                    child: const Center(child: Text('?', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: VelioColors.muted))),
                  )
                : Avatar(name: name, size: 36),
          ),
        ),
      ),
    );
  }
}

Future<void> showUserSwitcher(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    backgroundColor: VelioColors.ground,
    builder: (context) => const SafeArea(child: _UserSheet()),
  );
}

class _UserSheet extends ConsumerWidget {
  const _UserSheet();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = Theme.of(context).textTheme;
    final current = ref.watch(sessionProvider);
    final users = ref.watch(usersProvider);
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Try the app as', style: text.titleLarge),
            const SizedBox(height: 4),
            Text("There's no sign-in in the prototype. Pick who you are and every screen follows.", style: text.bodySmall),
          ]),
        ),
        Flexible(
          child: users.when(
            loading: () => const Padding(padding: EdgeInsets.all(20), child: Skeleton(height: 44)),
            error: (_, __) => const Padding(padding: EdgeInsets.all(20), child: Text("Couldn't load the users. Check the backend is running.")),
            data: (list) => _UserList(list: list, current: current),
          ),
        ),
      ],
    );
  }
}

class _UserList extends ConsumerWidget {
  const _UserList({required this.list, required this.current});

  final List<PickerUser> list;
  final String? current;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = Theme.of(context).textTheme;
    final host = list.where((u) => u.role == 'host').firstOrNull;
    final booker = list.where((u) => u.role == 'booker').firstOrNull;

    Future<void> choose(String? id) async {
      await ref.read(sessionProvider.notifier).set(id);
      if (context.mounted) Navigator.pop(context);
    }

    Widget heading(String label) => Padding(
          padding: const EdgeInsets.fromLTRB(20, 14, 20, 2),
          child: Text(label.toUpperCase(), style: text.labelSmall?.copyWith(color: VelioColors.muted, letterSpacing: 0.6, fontWeight: FontWeight.w700)),
        );

    Widget nobody() => Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: VelioColors.inputBorder, width: 1.5)),
          child: const Center(child: Text('?', style: TextStyle(fontWeight: FontWeight.w700, color: VelioColors.muted))),
        );

    Widget tile({required Widget leading, required String title, String? subtitle, required bool selected, required VoidCallback onTap}) => ListTile(
          leading: leading,
          title: Text(title),
          subtitle: subtitle == null ? null : Text(subtitle),
          trailing: selected ? const Icon(Icons.check, color: VelioColors.primary) : null,
          onTap: onTap,
        );

    return ListView(
      shrinkWrap: true,
      padding: const EdgeInsets.only(bottom: 12),
      children: [
        heading('Start here'),
        if (host != null)
          tile(
              leading: Avatar(name: host.displayName, size: 36),
              title: 'Host · ${host.displayName}',
              subtitle: 'Create activities and watch who is coming',
              selected: current == host.id,
              onTap: () => choose(host.id)),
        if (booker != null)
          tile(
              leading: Avatar(name: booker.displayName, size: 36),
              title: 'Booker · ${booker.displayName}',
              subtitle: 'Book a spot and bring friends',
              selected: current == booker.id,
              onTap: () => choose(booker.id)),
        tile(leading: nobody(), title: 'Guest · nobody yet', subtitle: 'Open an invite code the way a friend would', selected: current == null, onTap: () => choose(null)),
        for (final role in const ['host', 'booker', 'guest'])
          if (list.any((u) => u.role == role)) ...[
            heading(switch (role) { 'host' => 'Hosts', 'booker' => 'Bookers', _ => 'Guests' }),
            for (final u in list.where((u) => u.role == role))
              tile(leading: Avatar(name: u.displayName, size: 36), title: u.displayName, subtitle: u.detail, selected: u.id == current, onTap: () => choose(u.id)),
          ],
      ],
    );
  }
}
