import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:velio/features/intro/splash_screen.dart';

void main() {
  testWidgets('the splash keeps the wordmark centred while it reveals, then hands off', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: SplashScreen(next: Scaffold(body: Text('Explore')))));
    final screen = tester.getSize(find.byType(Scaffold).first);

    for (final ms in [100, 300, 500]) {
      await tester.pump(Duration(milliseconds: ms));
      final row = tester.getRect(find.byType(Row).first);
      expect((row.center.dx - screen.width / 2).abs(), lessThan(1), reason: 'row off centre at ${ms}ms');
    }
    expect(find.text(splashTagline), findsOneWidget);
    expect(find.text('Explore'), findsNothing);

    await tester.pump(const Duration(milliseconds: 100));
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();
    expect(find.text('Explore'), findsOneWidget);
    expect(find.byType(SplashScreen), findsNothing);
  });
}
