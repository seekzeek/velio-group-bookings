import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Design tokens. Every colour, radius and text style in the app comes from here.
abstract final class VelioColors {
  static const ground = Color(0xFFF3F4F2);
  static const surface = Color(0xFFFFFFFF);
  static const border = Color(0xFFE3E5E8);
  static const inputBorder = Color(0xFFC9CDD3);
  static const ink = Color(0xFF15171A);
  static const body = Color(0xFF3D424A);
  static const muted = Color(0xFF5B616B);
  static const primary = Color(0xFF0F5F5C);
  static const primaryDeep = Color(0xFF0B4745);
  static const primaryTint = Color(0xFFE3F1EF);
  static const scarcityDot = Color(0xFFE8642C);
  static const scarcityText = Color(0xFFB23A0A);
  static const warningBackground = Color(0xFFFFF1E8);
  static const warningText = Color(0xFF8A2C07);
  static const disabled = Color(0xFFDADDE1);
}

abstract final class VelioRadius {
  static const card = 20.0;
  static const input = 14.0;
  static const button = 16.0;
  static const chip = 999.0;
}

abstract final class VelioSpace {
  static const page = 20.0;
  static const touchTarget = 44.0;
}

abstract final class VelioShadows {
  static const card = [
    BoxShadow(color: Color(0x0D15171A), offset: Offset(0, 1)),
    BoxShadow(color: Color(0x0D15171A), offset: Offset(0, 6), blurRadius: 18),
  ];
  static const cta = [BoxShadow(color: Color(0x470F5F5C), offset: Offset(0, 6), blurRadius: 16)];
}

const _heading = 'Bricolage Grotesque';
const _bodyFont = 'Manrope';

TextTheme velioTextTheme() {
  const ink = VelioColors.ink;
  return const TextTheme(
    displaySmall: TextStyle(fontFamily: _heading, fontWeight: FontWeight.w700, fontSize: 30, height: 1.05, letterSpacing: -0.75, color: ink),
    headlineMedium: TextStyle(fontFamily: _heading, fontWeight: FontWeight.w700, fontSize: 28, height: 1.05, letterSpacing: -0.7, color: ink),
    headlineSmall: TextStyle(fontFamily: _heading, fontWeight: FontWeight.w700, fontSize: 22, height: 1.1, letterSpacing: -0.4, color: ink),
    titleLarge: TextStyle(fontFamily: _heading, fontWeight: FontWeight.w700, fontSize: 20, height: 1.15, letterSpacing: -0.4, color: ink),
    titleMedium: TextStyle(fontFamily: _bodyFont, fontWeight: FontWeight.w700, fontSize: 17, height: 1.25, color: ink),
    titleSmall: TextStyle(fontFamily: _bodyFont, fontWeight: FontWeight.w700, fontSize: 15, height: 1.3, color: ink),
    bodyLarge: TextStyle(fontFamily: _bodyFont, fontWeight: FontWeight.w400, fontSize: 16, height: 1.45, color: VelioColors.body),
    bodyMedium: TextStyle(fontFamily: _bodyFont, fontWeight: FontWeight.w400, fontSize: 14, height: 1.4, color: VelioColors.body),
    bodySmall: TextStyle(fontFamily: _bodyFont, fontWeight: FontWeight.w500, fontSize: 12, height: 1.4, color: VelioColors.muted),
    labelLarge: TextStyle(fontFamily: _bodyFont, fontWeight: FontWeight.w700, fontSize: 17, height: 1.2, color: ink),
    labelMedium: TextStyle(fontFamily: _bodyFont, fontWeight: FontWeight.w600, fontSize: 14, height: 1.2, color: ink),
    labelSmall: TextStyle(fontFamily: _bodyFont, fontWeight: FontWeight.w700, fontSize: 12, height: 1.2, letterSpacing: 0.72, color: VelioColors.muted),
  );
}

ThemeData velioTheme() {
  final textTheme = velioTextTheme();
  final scheme = ColorScheme.fromSeed(
    seedColor: VelioColors.primary,
    primary: VelioColors.primary,
    onPrimary: Colors.white,
    primaryContainer: VelioColors.primaryTint,
    onPrimaryContainer: VelioColors.primaryDeep,
    surface: VelioColors.surface,
    onSurface: VelioColors.ink,
    onSurfaceVariant: VelioColors.muted,
    outline: VelioColors.border,
    outlineVariant: VelioColors.inputBorder,
    error: VelioColors.scarcityText,
    onError: Colors.white,
    errorContainer: VelioColors.warningBackground,
    onErrorContainer: VelioColors.warningText,
  );

  OutlineInputBorder inputBorder(Color color, [double width = 1]) => OutlineInputBorder(
        borderRadius: BorderRadius.circular(VelioRadius.input),
        borderSide: BorderSide(color: color, width: width),
      );

  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: VelioColors.ground,
    fontFamily: _bodyFont,
    textTheme: textTheme,
    dividerColor: VelioColors.border,
    splashFactory: InkSparkle.splashFactory,
    appBarTheme: const AppBarTheme(
      backgroundColor: VelioColors.ground,
      foregroundColor: VelioColors.ink,
      elevation: 0,
      scrolledUnderElevation: 3,
      shadowColor: Color(0x1F15171A),
      surfaceTintColor: Colors.transparent,
      centerTitle: false,
      systemOverlayStyle: SystemUiOverlayStyle.dark,
    ),
    cardTheme: CardThemeData(
      color: VelioColors.surface,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(VelioRadius.card)),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: VelioColors.primary,
        foregroundColor: Colors.white,
        disabledBackgroundColor: VelioColors.disabled,
        disabledForegroundColor: VelioColors.muted,
        minimumSize: const Size.fromHeight(56),
        textStyle: textTheme.labelLarge,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(VelioRadius.button)),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: VelioColors.ink,
        minimumSize: const Size.fromHeight(52),
        side: const BorderSide(color: VelioColors.inputBorder),
        textStyle: textTheme.labelMedium?.copyWith(fontSize: 15),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(VelioRadius.button)),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: VelioColors.primary,
        minimumSize: const Size(VelioSpace.touchTarget, VelioSpace.touchTarget),
        textStyle: textTheme.labelMedium?.copyWith(fontWeight: FontWeight.w700),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: VelioColors.surface,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      border: inputBorder(VelioColors.inputBorder),
      enabledBorder: inputBorder(VelioColors.inputBorder),
      focusedBorder: inputBorder(VelioColors.primary, 2),
      errorBorder: inputBorder(VelioColors.scarcityText),
      focusedErrorBorder: inputBorder(VelioColors.scarcityText, 2),
      labelStyle: textTheme.labelMedium,
      hintStyle: textTheme.bodyMedium?.copyWith(color: VelioColors.muted),
      helperStyle: textTheme.bodySmall,
      errorStyle: textTheme.bodySmall?.copyWith(color: VelioColors.scarcityText),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: VelioColors.surface,
      selectedColor: VelioColors.ink,
      side: const BorderSide(color: VelioColors.border),
      labelStyle: textTheme.labelMedium,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(VelioRadius.chip)),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
    ),
    checkboxTheme: CheckboxThemeData(
      fillColor: WidgetStateProperty.resolveWith((states) => states.contains(WidgetState.selected) ? VelioColors.primary : VelioColors.surface),
      side: const BorderSide(color: VelioColors.inputBorder, width: 1.5),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: VelioColors.surface,
      indicatorColor: Colors.transparent,
      height: 64,
      labelTextStyle: WidgetStateProperty.resolveWith(
        (states) => textTheme.bodySmall!.copyWith(
          fontWeight: FontWeight.w700,
          color: states.contains(WidgetState.selected) ? VelioColors.primary : VelioColors.muted,
        ),
      ),
      iconTheme: WidgetStateProperty.resolveWith(
        (states) => IconThemeData(color: states.contains(WidgetState.selected) ? VelioColors.primary : VelioColors.muted, size: 22),
      ),
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: VelioColors.ink,
      contentTextStyle: textTheme.bodyMedium?.copyWith(color: Colors.white, fontWeight: FontWeight.w600),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(VelioRadius.input)),
    ),
  );
}
