import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:velio/core/api_client.dart';
import 'package:velio/core/providers.dart';
import 'package:velio/core/storage.dart';
import 'package:velio/core/theme.dart';
import 'package:velio/features/invite/invite_screen.dart';

Map<String, dynamic> activityJson({int spotsLeft = 3, int capacity = 12}) => {
      'id': '11111111-1111-4111-8111-111111111111',
      'title': 'Sunset Kayaking',
      'description': 'Two hours on calm water.',
      'category': 'outdoors',
      'illustration': 'kayak',
      'location': 'Harbour jetty, pier 3',
      'startsAt': DateTime.now().add(const Duration(days: 7)).toUtc().toIso8601String(),
      'timezone': 'Africa/Lagos',
      'price': {'amountMinor': 4500, 'currency': 'USD'},
      'capacity': capacity,
      'spotsTaken': capacity - spotsLeft,
      'spotsLeft': spotsLeft,
      'version': 5,
      'status': spotsLeft == 0 ? 'full' : 'open',
      'host': {'id': 'h', 'displayName': 'Kemi'},
      'photos': const [],
      'plansCount': 5,
      'invitesEnabled': true,
      'viewer': null,
    };

Map<String, dynamic> inviteJson({String status = 'open', int spotsLeft = 3}) => {
      'code': 'AX7K29QM',
      'codeDisplay': 'AX7K-29QM',
      'rail': 'vouch',
      'isHostInvite': false,
      'status': status,
      'inviter': {'id': 'a', 'displayName': 'Ada'},
      'activity': activityJson(spotsLeft: spotsLeft),
      'plan': {
        'id': 'p',
        'activityId': '11111111-1111-4111-8111-111111111111',
        'owner': {'id': 'a', 'displayName': 'Ada'},
        'members': [
          {'userId': 'a', 'displayName': 'Ada', 'role': 'owner', 'joinedVia': 'direct', 'invitedBy': null, 'joinedAt': '2026-10-01T10:00:00.000Z'},
        ],
      },
      'expiresAt': '2026-12-01T10:00:00.000Z',
      'viewer': null,
    };

Future<Widget> app(Map<String, dynamic> invite) async {
  SharedPreferences.setMockInitialValues({});
  final store = await LocalStore.open();
  final client = MockClient((request) async {
    if (request.url.path.startsWith('/invites/')) return http.Response(jsonEncode(invite), 200, headers: {'content-type': 'application/json'});
    if (request.url.path.endsWith('/stream')) return http.Response('', 404);
    return http.Response('{}', 202);
  });
  return ProviderScope(
    overrides: [
      localStoreProvider.overrideWithValue(store),
      apiClientProvider.overrideWithValue(ApiClient(httpClient: client, baseUrl: 'http://test')),
      onlineProvider.overrideWith((ref) => Stream.value(true)),
    ],
    child: MaterialApp(theme: velioTheme(), home: const InviteScreen(code: 'AX7K29QM')),
  );
}

void main() {
  testWidgets('a full activity shows the filled-up state with a way forward', (tester) async {
    await tester.pumpWidget(await app(inviteJson(spotsLeft: 0)));
    await tester.pumpAndSettle();
    expect(find.text('This one filled up before you got here'), findsOneWidget);
    expect(find.text('Tell me if a spot opens'), findsOneWidget);
    expect(find.textContaining('Let Ada know you missed it'), findsOneWidget);
    expect(find.text('Claim your spot'), findsNothing);
  });

  testWidgets('an expired invite explains itself and never dead-ends', (tester) async {
    await tester.pumpWidget(await app(inviteJson(status: 'expired')));
    await tester.pumpAndSettle();
    expect(find.text('This invite has expired'), findsOneWidget);
    expect(find.text('Ada vouched for you'), findsOneWidget);
    expect(find.text("See what's coming up"), findsOneWidget);
    expect(find.text('Claim your spot'), findsNothing);
  });

  testWidgets('an open vouch shows the inviter, the live spots and the claim button', (tester) async {
    await tester.pumpWidget(await app(inviteJson()));
    await tester.pumpAndSettle();
    expect(find.text('Ada vouched for you'), findsOneWidget);
    expect(find.text('Vouch · only you can claim this'), findsOneWidget);
    expect(find.text('3 of 12 spots left'), findsOneWidget);
    expect(find.text('Claim your spot'), findsOneWidget);
  });
}
