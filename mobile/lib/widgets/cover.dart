import 'package:flutter/material.dart';

import '../core/models.dart';

/// The illustrated cover for an activity without photos. Same flat shapes as the design, drawn on a 400 by 240 canvas.
class Cover extends StatelessWidget {
  const Cover({super.key, required this.illustration, this.photos = const [], this.height});

  final String illustration;
  final List<Photo> photos;
  final double? height;

  @override
  Widget build(BuildContext context) {
    final child = photos.isNotEmpty
        ? Image.network(photos.first.url, fit: BoxFit.cover, errorBuilder: (_, __, ___) => CustomPaint(painter: _CoverPainter(illustration)))
        : CustomPaint(painter: _CoverPainter(illustration));
    return SizedBox(height: height, width: double.infinity, child: ClipRect(child: child));
  }
}

/// Every photo, swiped one at a time with dots, for the screens that have room. One or none falls back to [Cover].
class CoverCarousel extends StatefulWidget {
  const CoverCarousel({super.key, required this.illustration, this.photos = const [], required this.height});

  final String illustration;
  final List<Photo> photos;
  final double height;

  @override
  State<CoverCarousel> createState() => _CoverCarouselState();
}

class _CoverCarouselState extends State<CoverCarousel> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final photos = widget.photos;
    if (photos.length <= 1) return Cover(illustration: widget.illustration, photos: photos, height: widget.height);
    return SizedBox(
      height: widget.height,
      width: double.infinity,
      child: Stack(fit: StackFit.expand, children: [
        PageView.builder(
          itemCount: photos.length,
          onPageChanged: (i) => setState(() => _index = i),
          itemBuilder: (context, i) => Semantics(
            label: 'Photo ${i + 1} of ${photos.length}',
            image: true,
            child: Image.network(photos[i].url, fit: BoxFit.cover, errorBuilder: (_, __, ___) => CustomPaint(painter: _CoverPainter(widget.illustration))),
          ),
        ),
        Positioned(
          left: 0,
          right: 0,
          bottom: 12,
          child: IgnorePointer(
            child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              for (var i = 0; i < photos.length; i++)
                AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  margin: const EdgeInsets.symmetric(horizontal: 3),
                  width: i == _index ? 16 : 6,
                  height: 6,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: i == _index ? 1 : 0.6),
                    borderRadius: BorderRadius.circular(3),
                    boxShadow: const [BoxShadow(color: Color(0x4D15171A), blurRadius: 2, offset: Offset(0, 1))],
                  ),
                ),
            ]),
          ),
        ),
      ]),
    );
  }
}

class _CoverPainter extends CustomPainter {
  _CoverPainter(this.kind);

  final String kind;

  @override
  void paint(Canvas canvas, Size size) {
    // Scale the 400x240 design canvas to cover the box, like preserveAspectRatio slice.
    final scale = size.width / 400 > size.height / 240 ? size.width / 400 : size.height / 240;
    canvas.save();
    canvas.translate((size.width - 400 * scale) / 2, (size.height - 240 * scale) / 2);
    canvas.scale(scale);
    switch (kind) {
      case 'kayak':
        _kayak(canvas);
      case 'speakeasy':
        _speakeasy(canvas);
      case 'hike':
        _hike(canvas);
      case 'pottery':
        _pottery(canvas);
      case 'salsa':
        _salsa(canvas);
      case 'market':
        _market(canvas);
      default:
        _other(canvas);
    }
    canvas.restore();
  }

  Paint _fill(int colour, [double opacity = 1]) => Paint()..color = Color(colour).withValues(alpha: opacity);
  Paint _stroke(int colour, double width, [double opacity = 1]) => Paint()
    ..color = Color(colour).withValues(alpha: opacity)
    ..style = PaintingStyle.stroke
    ..strokeWidth = width
    ..strokeCap = StrokeCap.round;

  void _rect(Canvas c, double x, double y, double w, double h, int colour, {double radius = 0, double opacity = 1}) =>
      c.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(x, y, w, h), Radius.circular(radius)), _fill(colour, opacity));

  void _kayak(Canvas c) {
    _rect(c, 0, 0, 400, 240, 0xFFDCEBE8);
    c.drawCircle(const Offset(292, 92), 38, _fill(0xFFF5B48B));
    _rect(c, 0, 134, 400, 106, 0xFFB9D7D2);
    final wave = Path()..moveTo(0, 156);
    for (var x = 0; x < 400; x += 75) {
      wave.relativeCubicTo(25, -6, 50, -6, 75, 0);
    }
    c.drawPath(wave, _stroke(0xFF0F5F5C, 2));
    final wave2 = Path()..moveTo(50, 190);
    for (var x = 0; x < 300; x += 75) {
      wave2.relativeCubicTo(25, -6, 50, -6, 75, 0);
    }
    c.drawPath(wave2, _stroke(0xFF0F5F5C, 2, 0.5));
    final boat = Path()
      ..moveTo(150, 150)
      ..cubicTo(168, 143, 236, 143, 254, 150)
      ..cubicTo(236, 161, 168, 161, 150, 150)
      ..close();
    c.drawPath(boat, _fill(0xFF15171A));
    c.drawLine(const Offset(188, 128), const Offset(218, 156), _stroke(0xFF15171A, 3));
    c.drawCircle(const Offset(200, 140), 6, _fill(0xFFF3F4F2));
  }

  void _speakeasy(Canvas c) {
    _rect(c, 0, 0, 400, 240, 0xFF2B2430);
    _rect(c, 60, 60, 280, 110, 0xFF3A3040);
    _rect(c, 60, 100, 280, 4, 0xFF5A4A5E);
    _rect(c, 60, 140, 280, 4, 0xFF5A4A5E);
    for (final b in [
      [90.0, 74.0, 14.0, 26.0, 0xFFC9A24A],
      [120.0, 70.0, 12.0, 30.0, 0xFF7A9E8E],
      [150.0, 78.0, 16.0, 22.0, 0xFFB86B5A],
      [230.0, 72.0, 12.0, 28.0, 0xFF7A9E8E],
      [260.0, 76.0, 16.0, 24.0, 0xFFC9A24A],
      [296.0, 70.0, 12.0, 30.0, 0xFFB86B5A],
      [100.0, 114.0, 14.0, 26.0, 0xFFB86B5A],
      [140.0, 112.0, 12.0, 28.0, 0xFFC9A24A],
      [250.0, 116.0, 16.0, 24.0, 0xFF7A9E8E],
      [290.0, 112.0, 12.0, 28.0, 0xFFC9A24A],
    ]) {
      _rect(c, b[0] as double, b[1] as double, b[2] as double, b[3] as double, b[4] as int);
    }
    _rect(c, 0, 176, 400, 64, 0xFF1C171F);
    c.drawLine(const Offset(130, 0), const Offset(130, 34), _stroke(0xFF8A7A8E, 2));
    c.drawLine(const Offset(270, 0), const Offset(270, 34), _stroke(0xFF8A7A8E, 2));
    for (final x in [130.0, 270.0]) {
      c.drawCircle(Offset(x, 44), 18, _fill(0xFFF0C98A, 0.18));
      c.drawCircle(Offset(x, 42), 8, _fill(0xFFF0C98A));
    }
  }

  void _hike(Canvas c) {
    _rect(c, 0, 0, 400, 240, 0xFFE4EBD6);
    c.drawCircle(const Offset(110, 96), 34, _fill(0xFFF5B48B));
    c.drawPath(
      Path()
        ..moveTo(0, 190)
        ..cubicTo(60, 120, 120, 110, 180, 150)
        ..cubicTo(220, 120, 260, 110, 320, 130)
        ..cubicTo(350, 140, 380, 160, 400, 190)
        ..lineTo(400, 240)
        ..lineTo(0, 240)
        ..close(),
      _fill(0xFF9DBA8C),
    );
    c.drawPath(
      Path()
        ..moveTo(0, 240)
        ..lineTo(0, 200)
        ..cubicTo(50, 160, 100, 150, 160, 180)
        ..cubicTo(210, 155, 270, 155, 320, 190)
        ..cubicTo(350, 210, 380, 220, 400, 240)
        ..close(),
      _fill(0xFF6F9468),
    );
    c.drawPath(
      Path()
        ..moveTo(0, 240)
        ..lineTo(0, 222)
        ..cubicTo(70, 192, 140, 192, 210, 222)
        ..cubicTo(270, 202, 340, 208, 400, 240)
        ..close(),
      _fill(0xFF4E7047),
    );
  }

  void _pottery(Canvas c) {
    _rect(c, 0, 0, 400, 240, 0xFFF4E1D2);
    _rect(c, 150, 196, 100, 14, 0xFF8A5A44, radius: 4);
    c.drawPath(
        Path()
          ..moveTo(140, 190)
          ..lineTo(260, 190)
          ..lineTo(250, 176)
          ..lineTo(150, 176)
          ..close(),
        _fill(0xFF6E4635));
    c.drawPath(
      Path()
        ..moveTo(170, 176)
        ..cubicTo(156, 146, 154, 106, 176, 80)
        ..lineTo(224, 80)
        ..cubicTo(246, 106, 244, 146, 230, 176)
        ..close(),
      _fill(0xFFC97B5A),
    );
    _rect(c, 166, 72, 68, 12, 0xFFB86B4C, radius: 6);
    c.drawPath(
        Path()
          ..moveTo(184, 100)
          ..cubicTo(178, 120, 178, 144, 184, 164),
        _stroke(0xFFE6A784, 4));
    c.drawLine(const Offset(254, 176), const Offset(240, 176), _stroke(0xFF8A5A44, 3));
    c.drawLine(const Offset(146, 176), const Offset(132, 176), _stroke(0xFF8A5A44, 3));
  }

  void _salsa(Canvas c) {
    _rect(c, 0, 0, 400, 240, 0xFF2B2F36);
    c.drawPath(
        Path()
          ..moveTo(0, 40)
          ..cubicTo(100, 100, 300, 100, 400, 40),
        _stroke(0xFF6B707A, 2));
    c.drawPath(
        Path()
          ..moveTo(0, 90)
          ..cubicTo(100, 150, 300, 150, 400, 90),
        _stroke(0xFF6B707A, 2));
    const row1 = [Offset(60, 62), Offset(130, 78), Offset(200, 84), Offset(270, 78), Offset(340, 62)];
    const row2 = [Offset(40, 106), Offset(110, 126), Offset(200, 134), Offset(290, 126), Offset(360, 106)];
    for (final p in [...row1, ...row2]) {
      c.drawCircle(p, 6, _fill(0xFFF5D58A));
    }
    for (final p in [row1[0], row1[2], row1[4], row2[1], row2[3]]) {
      c.drawCircle(p, 14, _fill(0xFFF5D58A, 0.14));
    }
    _rect(c, 0, 196, 400, 44, 0xFF3D424A);
    _rect(c, 0, 190, 400, 6, 0xFF4E545D);
  }

  void _market(Canvas c) {
    _rect(c, 0, 0, 400, 240, 0xFFF3EAC9);
    _rect(c, 40, 60, 320, 40, 0xFFC0504A);
    for (final x in [80.0, 160.0, 240.0, 320.0]) {
      _rect(c, x, 60, 40, 40, 0xFFFFFFFF);
    }
    c.drawPath(
        Path()
          ..moveTo(40, 100)
          ..lineTo(360, 100)
          ..lineTo(350, 114)
          ..lineTo(50, 114)
          ..close(),
        _fill(0xFF9E3E3A));
    _rect(c, 70, 150, 260, 60, 0xFF8A5A44);
    _rect(c, 60, 140, 280, 14, 0xFF6E4635, radius: 3);
    for (final p in [
      [110.0, 0xFF6F9468],
      [136.0, 0xFF6F9468],
      [200.0, 0xFFD9A441],
      [226.0, 0xFFD9A441],
      [290.0, 0xFFC0504A],
      [316.0, 0xFFC0504A]
    ]) {
      c.drawCircle(Offset(p[0] as double, 130), 12, _fill(p[1] as int));
    }
    _rect(c, 0, 210, 400, 30, 0xFFD9CFA8);
  }

  void _other(Canvas c) {
    _rect(c, 0, 0, 400, 240, 0xFFE3F1EF);
    c.drawCircle(const Offset(120, 110), 44, _fill(0xFF0F5F5C, 0.18));
    c.drawCircle(const Offset(250, 130), 64, _fill(0xFF0F5F5C, 0.12));
    _rect(c, 60, 180, 280, 12, 0xFF0F5F5C, radius: 6, opacity: 0.3);
  }

  @override
  bool shouldRepaint(covariant _CoverPainter old) => old.kind != kind;
}
