// Runs the guest journey on a real device or simulator against a running backend with the seed loaded:
//   flutter drive --driver=test_driver/integration_test.dart --target=integration_test/guest_flow_test.dart \
//     -d "iPhone 15 Pro" --dart-define=API_BASE_URL=http://localhost:4000
// Screenshots land in build/screenshots. Codes come from `npm run seed` in the backend.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:velio/core/providers.dart';
import 'package:velio/core/storage.dart';
import 'package:velio/core/theme.dart';
import 'package:velio/features/invite/invite_screen.dart';
import 'package:velio/main.dart';

const publicLinkWithRoom = 'SF7W2MDK';
const vouchOnFullActivity = 'BG5K2YNP';
const expiredVouch = 'QR4T82NP';

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  Future<void> pumpApp(WidgetTester tester, Widget home) async {
    SharedPreferences.setMockInitialValues({});
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
    await tester.enterText(find.widgetWithText(TextField, 'Phone number or email'), 'wrong@example.com');
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
}
