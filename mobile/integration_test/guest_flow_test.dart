// Runs the guest journey on a real device or simulator against a running backend with the seed loaded:
//   flutter drive --driver=test_driver/integration_test.dart --target=integration_test/guest_flow_test.dart \
//     -d "iPhone 15 Pro" --dart-define=API_BASE_URL=http://localhost:4000
// Screenshots land in build/screenshots. Codes come from `npm run seed` in the backend.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:velio/core/api_client.dart';
import 'package:velio/core/providers.dart';
import 'package:velio/core/storage.dart';
import 'package:velio/core/theme.dart';
import 'package:velio/features/booking/activity_screen.dart';
import 'package:velio/features/host/host_screen.dart';
import 'package:velio/features/invite/invite_screen.dart';
import 'package:velio/main.dart';

const publicLinkWithRoom = 'SF7W2MDK';
const vouchOnFullActivity = 'SY8H4QMD';
const expiredVouch = 'QR4T82NP';

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  Future<void> pumpApp(WidgetTester tester, Widget home, {String? userId}) async {
    SharedPreferences.setMockInitialValues({if (userId != null) 'velio.userId': userId});
    final store = await LocalStore.open();
    await tester.pumpWidget(ProviderScope(
      overrides: [localStoreProvider.overrideWithValue(store)],
      child: MaterialApp(theme: velioTheme(), home: home),
    ));
  }

  Future<void> settle(WidgetTester tester, [int seconds = 2]) async {
    await tester.pump(Duration(seconds: seconds));
    await tester.pump(const Duration(milliseconds: 300));
  }

  Future<void> shot(WidgetTester tester, String name) async {
    await binding.convertFlutterSurfaceToImage();
    await tester.pump();
    await binding.takeScreenshot(name);
  }

  // Real screens load over the network, so wait for the text instead of guessing a delay. A miss leaves a screenshot behind.
  Future<void> waitFor(WidgetTester tester, Finder finder, {int seconds = 12, String name = 'missing'}) async {
    for (var i = 0; i < seconds * 4; i++) {
      await tester.pump(const Duration(milliseconds: 250));
      if (finder.evaluate().isNotEmpty) return;
    }
    await shot(tester, 'fail-$name');
    expect(finder, findsWidgets);
  }

  Future<void> reveal(WidgetTester tester, Finder finder) async {
    await tester.scrollUntilVisible(finder, 200, scrollable: find.byType(Scrollable).first);
    await tester.pump(const Duration(milliseconds: 200));
  }

  testWidgets('explore shows live activities', (tester) async {
    await pumpApp(tester, const Shell());
    await settle(tester, 3);
    expect(find.text('What are you doing this week?'), findsOneWidget);
    await shot(tester, '01-explore');
  });

  testWidgets('a guest claims a public link and lands in the plan', (tester) async {
    await pumpApp(tester, const InviteScreen(code: publicLinkWithRoom));
    await settle(tester, 3);
    expect(find.text('Claim your spot'), findsOneWidget);
    await shot(tester, '02-invite-public');

    await tester.tap(find.text('Claim your spot'));
    await settle(tester);
    expect(find.text('Almost there'), findsOneWidget);
    await shot(tester, '03-details');

    final name = 'Nkem ${DateTime.now().millisecondsSinceEpoch % 10000}';
    await tester.enterText(find.widgetWithText(TextField, 'Chioma'), name);
    // A public link accepts any contact; a fresh one each run keeps this a new guest rather than a returning one.
    await tester.enterText(find.widgetWithText(TextField, 'Phone number or email'), 'nkem.${DateTime.now().millisecondsSinceEpoch}@example.com');
    await tester.tap(find.text('Claim my spot'));
    await settle(tester, 3);
    // A public link accepts any contact, so this claims straight away.
    expect(find.textContaining("You're in"), findsOneWidget);
    expect(find.text('Remind me the day before'), findsOneWidget);
    await shot(tester, '04-youre-in');
  });

  testWidgets('a vouch on a full activity shows the filled-up state', (tester) async {
    await pumpApp(tester, const InviteScreen(code: vouchOnFullActivity));
    await settle(tester, 3);
    expect(find.text('This one filled up before you got here'), findsOneWidget);
    expect(find.text('Tell me if a spot opens'), findsOneWidget);
    await shot(tester, '05-filled-up');
  });

  testWidgets('an expired vouch explains itself', (tester) async {
    await pumpApp(tester, const InviteScreen(code: expiredVouch));
    await settle(tester, 3);
    expect(find.text('This invite has expired'), findsOneWidget);
    await shot(tester, '06-expired');
  });

  Future<String> userIdNamed(String name) async {
    final client = ApiClient();
    final users = (await client.get('/users'))['users'] as List;
    return (users.firstWhere((u) => u['displayName'] == name) as Map)['id'] as String;
  }

  // An activity with room and invites on, so the booking and the sheet both have something to do.
  Future<String> activityWithRoom() async {
    final list = (await ApiClient().get('/activities'))['activities'] as List;
    final open = list.cast<Map>().where((a) => (a['spotsLeft'] as int) > 1 && a['invitesEnabled'] == true);
    return open.first['id'] as String;
  }

  // The seed and earlier runs leave people booked, so take the first seeded booker who is not going yet.
  Future<String> someoneNotGoing(String activityId) async {
    final users = (await ApiClient().get('/users'))['users'] as List;
    for (final u in users) {
      final id = (u as Map)['id'] as String;
      final view = await ApiClient(userIdProvider: () => id).get('/activities/$activityId');
      if ((view['activity'] as Map)['viewer'] == null) return id;
    }
    throw StateError('everyone is already going to $activityId');
  }

  testWidgets('a host creates an activity, publishes it and vouches for someone', (tester) async {
    final kemi = await userIdNamed('Kemi');
    await pumpApp(tester, const CreateActivityScreen(), userId: kemi);
    await waitFor(tester, find.widgetWithText(TextField, 'Sunset Kayaking'));
    await tester.enterText(find.widgetWithText(TextField, 'Sunset Kayaking'), 'Device test paddle');
    await reveal(tester, find.text('Pick a date'));
    for (var attempt = 0; attempt < 3 && find.byType(DatePickerDialog).evaluate().isEmpty; attempt++) {
      await tester.tap(find.widgetWithText(OutlinedButton, 'Pick a date'), warnIfMissed: false);
      await settle(tester, 1);
    }
    await waitFor(tester, find.text('OK'), name: 'date-picker');
    await tester.tap(find.text('OK'));
    await settle(tester, 1);
    await reveal(tester, find.widgetWithText(TextField, 'Harbour jetty, pier 3'));
    await tester.enterText(find.widgetWithText(TextField, 'Harbour jetty, pier 3'), 'Pier 1');
    await reveal(tester, find.text('Publish activity'));
    await shot(tester, '07-create-form');
    await tester.tap(find.text('Publish activity'));
    await waitFor(tester, find.textContaining('is live'), name: 'published');
    await shot(tester, '08-published');

    await reveal(tester, find.text('Vouch for someone'));
    await tester.tap(find.text('Vouch for someone'));
    await waitFor(tester, find.widgetWithText(TextField, 'Phone number or email'));
    await tester.enterText(find.widgetWithText(TextField, 'Phone number or email'), 'device.guest.${DateTime.now().millisecondsSinceEpoch}@example.com');
    await reveal(tester, find.text('Send vouch'));
    await tester.tap(find.text('Send vouch'));
    await waitFor(tester, find.text('Vouch sent'), name: 'host-vouch');
    expect(find.text('Share link'), findsOneWidget);
    await shot(tester, '09-vouch-sent');
  });

  testWidgets('a booker books a spot and the invite sheet opens', (tester) async {
    final activityId = await activityWithRoom();
    final booker = await someoneNotGoing(activityId);
    await pumpApp(tester, ActivityScreen(activityId: activityId), userId: booker);
    await waitFor(tester, find.text('Book my spot'), name: 'book-my-spot');
    await shot(tester, '10-activity');
    await tester.tap(find.text('Book my spot'));
    await waitFor(tester, find.text("Who's coming with you?"));
    await shot(tester, '11-invite-sheet');
    await tester.enterText(find.widgetWithText(TextField, '+1 555 0100'), 'device.friend.${DateTime.now().millisecondsSinceEpoch}@example.com');
    await tester.tap(find.text('Send vouch'));
    await waitFor(tester, find.textContaining('Vouch sent'));
    await shot(tester, '12-vouch-sent-sheet');
  });
}
