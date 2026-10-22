import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api.dart';
import 'api_client.dart';
import 'models.dart';
import 'storage.dart';

/// Opened in main() before the app runs, then overridden into the ProviderScope.
final localStoreProvider = Provider<LocalStore>((ref) => throw UnimplementedError('localStoreProvider is overridden in main'));

/// The picked or claimed user id. Everything that needs identity watches this.
class SessionNotifier extends Notifier<String?> {
  @override
  String? build() => ref.watch(localStoreProvider).userId;

  Future<void> set(String? id) async {
    state = id;
    await ref.read(localStoreProvider).setUserId(id);
  }
}

final sessionProvider = NotifierProvider<SessionNotifier, String?>(SessionNotifier.new);

final anonIdProvider = Provider<String>((ref) => ref.watch(localStoreProvider).anonId);

final apiClientProvider = Provider<ApiClient>((ref) {
  final client = ApiClient(userIdProvider: () => ref.read(sessionProvider));
  ref.onDispose(client.close);
  return client;
});

final apiProvider = Provider<VelioApi>((ref) => VelioApi(ref.watch(apiClientProvider)));

/// True when the phone has some network. Screens show the offline banner and cached data from this.
final onlineProvider = StreamProvider<bool>((ref) async* {
  final connectivity = Connectivity();
  bool online(List<ConnectivityResult> results) => results.any((r) => r != ConnectivityResult.none);
  yield online(await connectivity.checkConnectivity());
  await for (final results in connectivity.onConnectivityChanged) {
    yield online(results);
  }
});

bool isOnline(WidgetRef ref) => ref.watch(onlineProvider).value ?? true;

/// Reads a provider from either a widget's ref or a provider's ref, so helpers work in both places.
T readFrom<T>(Object ref, ProviderListenable<T> provider) => ref is WidgetRef ? ref.read(provider) : (ref as Ref).read(provider);

/// Fire and forget. Analytics never block a screen.
void track(Object ref, String name, {String? activityId, String? inviteCode, Map<String, dynamic>? props}) {
  final api = readFrom(ref, apiProvider);
  final anonId = readFrom(ref, anonIdProvider);
  unawaited(api.event(name, anonId: anonId, activityId: activityId, inviteCode: inviteCode, props: props).catchError((_) {}));
}

final usersProvider = FutureProvider<List<PickerUser>>((ref) => ref.watch(apiProvider).users());

final meProvider = FutureProvider<PickerUser?>((ref) async {
  final id = ref.watch(sessionProvider);
  if (id == null) return null;
  final users = await ref.watch(usersProvider.future);
  for (final u in users) {
    if (u.id == id) return u;
  }
  return PickerUser(id: id, displayName: 'You', isHost: false);
});
