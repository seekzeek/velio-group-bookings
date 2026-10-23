import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

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
            data: (list) => ListView(
              shrinkWrap: true,
              padding: const EdgeInsets.only(bottom: 12),
              children: [
                ListTile(
                  leading: Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: VelioColors.inputBorder, width: 1.5)),
                      child: const Center(child: Text('?', style: TextStyle(fontWeight: FontWeight.w700, color: VelioColors.muted)))),
                  title: const Text('Nobody yet'),
                  trailing: current == null ? const Icon(Icons.check, color: VelioColors.primary) : null,
                  onTap: () async {
                    await ref.read(sessionProvider.notifier).set(null);
                    if (context.mounted) Navigator.pop(context);
                  },
                ),
                for (final u in list)
                  ListTile(
                    leading: Avatar(name: u.displayName, size: 36),
                    title: Text(u.displayName),
                    subtitle: Text(u.isHost ? 'host' : 'booker'),
                    trailing: u.id == current ? const Icon(Icons.check, color: VelioColors.primary) : null,
                    onTap: () async {
                      await ref.read(sessionProvider.notifier).set(u.id);
                      if (context.mounted) Navigator.pop(context);
                    },
                  ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
