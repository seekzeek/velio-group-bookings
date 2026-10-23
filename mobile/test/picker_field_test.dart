import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:velio/core/format.dart';
import 'package:velio/widgets/picker_field.dart';

void main() {
  testWidgets('the time zone picker searches by city or region and says so when nothing matches', (tester) async {
    String picked = 'Africa/Lagos';
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: StatefulBuilder(
          builder: (context, setState) => PickerField<String>(
            value: picked,
            sheetTitle: 'Time zone of the venue',
            options: [for (final tz in knownTimezones) PickerOption(tz, timezoneLabel(tz), detail: tz)],
            onChanged: (v) => setState(() => picked = v),
            searchHint: 'Search a city or zone',
            emptyTitle: 'No time zone matches that',
          ),
        ),
      ),
    ));

    expect(find.text('Lagos · UTC+1'), findsOneWidget);
    await tester.tap(find.text('Lagos · UTC+1'));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField), 'zzz');
    await tester.pumpAndSettle();
    expect(find.text('No time zone matches that'), findsOneWidget);

    await tester.enterText(find.byType(TextField), 'asia');
    await tester.pumpAndSettle();
    expect(find.text('Kolkata · UTC+5:30'), findsOneWidget);
    // The field behind the sheet still shows the current value; only the list should have lost it.
    expect(find.descendant(of: find.byType(ListTile), matching: find.text('Lagos · UTC+1')), findsNothing);

    await tester.enterText(find.byType(TextField), 'tokyo');
    await tester.pumpAndSettle();
    await tester.tap(find.text('Tokyo · UTC+9'));
    await tester.pumpAndSettle();
    expect(picked, 'Asia/Tokyo');
    expect(find.text('Tokyo · UTC+9'), findsOneWidget);
  });
}
