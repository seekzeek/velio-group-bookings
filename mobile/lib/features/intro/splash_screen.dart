import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../widgets/bits.dart';

const splashGreen = Color(0xFF0B4745);
const splashYellow = Color(0xFFFBE38E);
const splashTagline = 'Plans that actually happen.';

/// The 900 ms intro from the brand board: the dot appears centred, the letters reveal to its left so the dot slides
/// right, the tagline fades up, then the app hands off to [next]. The row stays centred throughout because the dot
/// is simply the last item in it. Replaces itself in the navigator, so a deep link that arrived during the intro stays on top.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key, required this.next});

  final Widget next;

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 900));
  late final Animation<double> _dotIn = CurvedAnimation(parent: _c, curve: const Interval(0.0, 0.22, curve: Curves.easeOutBack));
  late final Animation<double> _reveal = CurvedAnimation(parent: _c, curve: const Interval(0.33, 0.72, curve: Curves.easeInOutCubic));
  late final Animation<double> _tagline = CurvedAnimation(parent: _c, curve: const Interval(0.68, 1.0, curve: Curves.easeOut));

  @override
  void initState() {
    super.initState();
    _c.forward().whenComplete(() => Future<void>.delayed(const Duration(milliseconds: 250), _handOff));
  }

  void _handOff() {
    if (!mounted) return;
    // The splash asked for light status icons over its green; the light screens behind it want dark ones back.
    SystemChrome.setSystemUIOverlayStyle(SystemUiOverlayStyle.dark);
    final navigator = Navigator.of(context);
    final me = ModalRoute.of(context)!;
    final route = PageRouteBuilder<void>(
      pageBuilder: (_, __, ___) => widget.next,
      transitionDuration: const Duration(milliseconds: 260),
      transitionsBuilder: (_, animation, __, child) => FadeTransition(opacity: animation, child: child),
    );
    if (me.isCurrent) {
      navigator.pushReplacement(route);
    } else {
      navigator.replace(oldRoute: me, newRoute: route);
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    const size = 64.0;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: splashGreen,
        body: Center(
          child: AnimatedBuilder(
            animation: _c,
            builder: (context, _) => Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    ClipRect(
                      child: Align(
                        alignment: Alignment.centerRight,
                        widthFactor: _reveal.value,
                        child: Text('velıo', style: Wordmark.style(size, Colors.white)),
                      ),
                    ),
                    Padding(
                      padding: EdgeInsets.only(left: size * 0.06 * _reveal.value, bottom: size * Wordmark.descender),
                      child: Transform.scale(
                        scale: _dotIn.value,
                        child: Container(width: size * 0.24, height: size * 0.24, decoration: const BoxDecoration(shape: BoxShape.circle, color: splashYellow)),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 18),
                Opacity(
                  opacity: _tagline.value,
                  child: Transform.translate(
                    offset: Offset(0, 8 * (1 - _tagline.value)),
                    child: Text(splashTagline, textAlign: TextAlign.center, style: TextStyle(fontFamily: 'Manrope', fontSize: 18, color: Colors.white.withValues(alpha: 0.85))),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
