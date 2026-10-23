import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:velio/widgets/collapsing_header.dart';

double _opacityOf(WidgetTester tester, Finder finder) => tester.widget<Opacity>(find.ancestor(of: finder, matching: find.byType(Opacity)).first).opacity;

void main() {
  testWidgets('the large title gives way to the compact one as the list scrolls', (tester) async {
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: CustomScrollView(slivers: [
          const CollapsingHeader(title: 'What are you doing this week?', compactTitle: 'This week', titleLines: 2, pinned: SizedBox(height: 40), pinnedHeight: 40),
          SliverList.list(children: List.generate(30, (i) => SizedBox(height: 80, child: Text('row $i')))),
        ]),
      ),
    ));

    expect(_opacityOf(tester, find.text('What are you doing this week?')), 1);
    expect(_opacityOf(tester, find.text('This week')), 0);

    await tester.drag(find.text('row 3'), const Offset(0, -300));
    await tester.pumpAndSettle();

    expect(_opacityOf(tester, find.text('What are you doing this week?')), closeTo(0, 0.001));
    expect(_opacityOf(tester, find.text('This week')), closeTo(1, 0.001));
    expect(find.text('This week'), findsOneWidget);
  });

  testWidgets('the cover header keeps the back button and fades the title in', (tester) async {
    var popped = false;
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: CustomScrollView(slivers: [
          CoverHeader(title: 'Sunset Kayaking', cover: Container(color: Colors.teal), onBack: () => popped = true, backLabel: 'Back to Explore'),
          SliverList.list(children: List.generate(30, (i) => SizedBox(height: 80, child: Text('row $i')))),
        ]),
      ),
    ));

    expect(_opacityOf(tester, find.text('Sunset Kayaking')), 0);
    await tester.drag(find.text('row 3'), const Offset(0, -400));
    await tester.pumpAndSettle();
    expect(_opacityOf(tester, find.text('Sunset Kayaking')), closeTo(1, 0.001));

    await tester.tap(find.bySemanticsLabel('Back to Explore'));
    expect(popped, isTrue);
  });
}
