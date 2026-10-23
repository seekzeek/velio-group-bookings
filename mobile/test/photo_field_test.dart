import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:velio/features/host/photo_field.dart';

// A 1x1 PNG, enough for Image.memory to decode.
final _png = Uint8List.fromList([
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, //
  0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00, 0x00, 0x03, 0x01, 0x01, 0x00, 0x18, 0xDD, 0x8D, 0xB0, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, //
  0xAE, 0x42, 0x60, 0x82,
]);

Widget _host(List<StagedPhoto> photos, ValueChanged<List<StagedPhoto>> onChanged, {UploadProgress? uploading}) =>
    MaterialApp(home: Scaffold(body: Padding(padding: const EdgeInsets.all(16), child: PhotoField(photos: photos, onChanged: onChanged, uploading: uploading))));

void main() {
  testWidgets('the first photo is the cover and removing it promotes the next one', (tester) async {
    final semantics = tester.ensureSemantics();
    var photos = [StagedPhoto(name: 'a.png', bytes: _png), StagedPhoto(name: 'b.png', bytes: _png)];
    late StateSetter rebuild;
    await tester.pumpWidget(StatefulBuilder(builder: (context, setState) {
      rebuild = setState;
      return _host(photos, (next) => setState(() => photos = next));
    }));
    await tester.pump();

    expect(find.text('Cover'), findsOneWidget);
    expect(find.bySemanticsLabel('Add photo'), findsOneWidget);

    await tester.tap(find.bySemanticsLabel('Remove cover photo'));
    await tester.pump();
    rebuild(() {});
    await tester.pump();

    expect(photos.map((p) => p.name), ['b.png']);
    expect(find.text('Cover'), findsOneWidget);
    semantics.dispose();
  });

  testWidgets('six photos hide the add tile and an upload in progress shows its percentage', (tester) async {
    final semantics = tester.ensureSemantics();
    final photos = List.generate(6, (i) => StagedPhoto(name: '$i.png', bytes: _png));
    await tester.pumpWidget(_host(photos, (_) {}, uploading: const UploadProgress(2, 0.62)));
    await tester.pump();

    expect(find.bySemanticsLabel('Add photo'), findsNothing);
    expect(find.text('Uploading'), findsOneWidget);
    expect(find.text('62%'), findsOneWidget);
    expect(find.bySemanticsLabel('Remove photo'), findsNothing);
    semantics.dispose();
  });
}
