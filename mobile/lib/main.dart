import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/providers.dart';
import 'core/storage.dart';
import 'core/theme.dart';
import 'features/booking/explore_screen.dart';
import 'features/host/host_screen.dart';
import 'features/intro/splash_screen.dart';
import 'features/invite/invite_controller.dart';
import 'features/invite/invite_screen.dart';
import 'features/invites/invites_screen.dart';
import 'features/plans/plans_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final store = await LocalStore.open();
  runApp(ProviderScope(overrides: [localStoreProvider.overrideWithValue(store)], child: const VelioApp()));
}

final navigatorKey = GlobalKey<NavigatorState>();

class VelioApp extends ConsumerStatefulWidget {
  const VelioApp({super.key});

  @override
  ConsumerState<VelioApp> createState() => _VelioAppState();
}

class _VelioAppState extends ConsumerState<VelioApp> {
  StreamSubscription<Uri>? _links;

  @override
  void initState() {
    super.initState();
    final appLinks = AppLinks();
    appLinks.getInitialLink().then((uri) => _open(uri));
    _links = appLinks.uriLinkStream.listen(_open);
  }

  @override
  void dispose() {
    _links?.cancel();
    super.dispose();
  }

  // velio://i/AX7K29QM and https://<web>/i/AX7K29QM both land on the invite.
  void _open(Uri? uri) {
    if (uri == null) return;
    final segments = uri.pathSegments.where((s) => s.isNotEmpty).toList();
    final idx = uri.scheme == 'velio' ? (uri.host == 'i' ? 0 : -1) : segments.indexOf('i');
    final raw = uri.scheme == 'velio' ? (uri.host == 'i' ? segments.firstOrNull : null) : (idx >= 0 && idx + 1 < segments.length ? segments[idx + 1] : null);
    final code = raw == null ? '' : normalizeCode(raw);
    if (code.length != 8) return;
    navigatorKey.currentState?.push(MaterialPageRoute<void>(builder: (_) => InviteScreen(code: code)));
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Velio',
      navigatorKey: navigatorKey,
      debugShowCheckedModeBanner: false,
      theme: velioTheme(),
      // Every normal screen sits on the light ground, so dark status icons are asserted here, under the splash's light ones.
      home: const SplashScreen(next: AnnotatedRegion<SystemUiOverlayStyle>(value: SystemUiOverlayStyle.dark, child: Shell())),
    );
  }
}

/// The four tabs from the canvas: Explore, My plans, Invites, Host.
class Shell extends StatefulWidget {
  const Shell({super.key});

  @override
  State<Shell> createState() => _ShellState();
}

class _ShellState extends State<Shell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final pages = [const ExploreScreen(), const PlansScreen(), const InvitesScreen(), const HostScreen()];
    return Scaffold(
      body: IndexedStack(index: _index, children: pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.explore_outlined), selectedIcon: Icon(Icons.explore), label: 'Explore'),
          NavigationDestination(icon: Icon(Icons.event_outlined), selectedIcon: Icon(Icons.event), label: 'My plans'),
          NavigationDestination(icon: Icon(Icons.mail_outline), selectedIcon: Icon(Icons.mail), label: 'Invites'),
          NavigationDestination(icon: Icon(Icons.groups_outlined), selectedIcon: Icon(Icons.groups), label: 'Host'),
        ],
      ),
    );
  }
}
