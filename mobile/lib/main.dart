import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/api_client.dart';
import 'core/theme.dart';

void main() {
  runApp(const ProviderScope(child: VelioApp()));
}

final apiClientProvider = Provider<ApiClient>((ref) {
  final client = ApiClient();
  ref.onDispose(client.close);
  return client;
});

final healthProvider = FutureProvider<bool>((ref) async {
  final body = await ref.watch(apiClientProvider).get('/health');
  return body['ok'] == true;
});

class VelioApp extends StatelessWidget {
  const VelioApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Velio',
      debugShowCheckedModeBanner: false,
      theme: velioTheme(),
      home: const _ScaffoldHome(),
    );
  }
}

/// Placeholder until the guest flow lands. Proves the theme, fonts and backend connection.
class _ScaffoldHome extends ConsumerWidget {
  const _ScaffoldHome();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final textTheme = Theme.of(context).textTheme;
    final health = ref.watch(healthProvider);
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(VelioSpace.page),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('velio', style: textTheme.titleLarge),
              const SizedBox(height: 40),
              Text('What are you doing this week?', style: textTheme.displaySmall),
              const SizedBox(height: 12),
              Text('Book a spot, then bring your people. Spots update live.', style: textTheme.bodyLarge),
              const Spacer(),
              health.when(
                data: (ok) => _Status(ok ? 'Backend connected' : 'Backend degraded', ok),
                loading: () => const _Status('Checking backend', null),
                error: (_, __) => const _Status('Backend unreachable', false),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Status extends StatelessWidget {
  const _Status(this.label, this.ok);

  final String label;
  final bool? ok;

  @override
  Widget build(BuildContext context) {
    final color = ok == null ? VelioColors.muted : (ok! ? VelioColors.primaryDeep : VelioColors.warningText);
    final background = ok == null ? VelioColors.border : (ok! ? VelioColors.primaryTint : VelioColors.warningBackground);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(VelioRadius.chip)),
      child: Text(label, style: Theme.of(context).textTheme.labelMedium?.copyWith(color: color)),
    );
  }
}
