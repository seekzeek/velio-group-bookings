import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';

/// One setting for where the backend lives. Override with
/// `flutter run --dart-define=API_BASE_URL=http://192.168.1.20:4000` for a real phone.
abstract final class AppConfig {
  static const _defined = String.fromEnvironment('API_BASE_URL');

  static String get apiBaseUrl {
    if (_defined.isNotEmpty) return _defined;
    // The Android emulator reaches the host machine through 10.0.2.2.
    if (!kIsWeb && Platform.isAndroid) return 'http://10.0.2.2:4000';
    return 'http://localhost:4000';
  }

  static const platform = 'mobile';
}
