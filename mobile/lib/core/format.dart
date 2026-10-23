import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import 'models.dart';
import 'theme.dart';

/// Standard offsets for the zones the prototype uses, plus which daylight saving rule each follows. The API sends UTC
/// instants and an IANA name; without a tz database on the phone, these are enough to show venue local time correctly.
enum _Dst { none, eu, us, au }

class _Zone {
  const _Zone(this.standard, [this.dst = _Dst.none]);
  final Duration standard;
  final _Dst dst;
}

const _zones = <String, _Zone>{
  'Africa/Lagos': _Zone(Duration(hours: 1)),
  'Africa/Nairobi': _Zone(Duration(hours: 3)),
  'Africa/Johannesburg': _Zone(Duration(hours: 2)),
  'Europe/London': _Zone(Duration(hours: 0), _Dst.eu),
  'Europe/Lisbon': _Zone(Duration(hours: 0), _Dst.eu),
  'Europe/Paris': _Zone(Duration(hours: 1), _Dst.eu),
  'Europe/Madrid': _Zone(Duration(hours: 1), _Dst.eu),
  'Europe/Berlin': _Zone(Duration(hours: 1), _Dst.eu),
  'Europe/Zurich': _Zone(Duration(hours: 1), _Dst.eu),
  'Europe/Rome': _Zone(Duration(hours: 1), _Dst.eu),
  'Europe/Amsterdam': _Zone(Duration(hours: 1), _Dst.eu),
  'America/New_York': _Zone(Duration(hours: -5), _Dst.us),
  'America/Toronto': _Zone(Duration(hours: -5), _Dst.us),
  'America/Chicago': _Zone(Duration(hours: -6), _Dst.us),
  'America/Mexico_City': _Zone(Duration(hours: -6)),
  'America/Los_Angeles': _Zone(Duration(hours: -8), _Dst.us),
  'America/Sao_Paulo': _Zone(Duration(hours: -3)),
  'America/Argentina/Buenos_Aires': _Zone(Duration(hours: -3)),
  'Asia/Dubai': _Zone(Duration(hours: 4)),
  'Asia/Kolkata': _Zone(Duration(hours: 5, minutes: 30)),
  'Asia/Bangkok': _Zone(Duration(hours: 7)),
  'Asia/Singapore': _Zone(Duration(hours: 8)),
  'Asia/Hong_Kong': _Zone(Duration(hours: 8)),
  'Asia/Tokyo': _Zone(Duration(hours: 9)),
  'Australia/Sydney': _Zone(Duration(hours: 10), _Dst.au),
  'UTC': _Zone(Duration.zero),
};

final _zoneOffsets = {for (final e in _zones.entries) e.key: e.value.standard};

DateTime _nthSunday(int year, int month, int n) {
  final first = DateTime.utc(year, month, 1);
  final firstSunday = first.add(Duration(days: (7 - first.weekday) % 7));
  return firstSunday.add(Duration(days: 7 * (n - 1)));
}

DateTime _lastSunday(int year, int month) {
  final last = DateTime.utc(year, month + 1, 0);
  return last.subtract(Duration(days: last.weekday % 7));
}

// The three rules the table needs. Europe switches at 01:00 UTC on the last Sundays of March and October; the US at 02:00
// local on the second Sunday of March and the first of November; Australia the other way round, first Sundays of October and April.
bool _inDst(DateTime utc, _Zone zone) {
  final y = utc.year;
  switch (zone.dst) {
    case _Dst.none:
      return false;
    case _Dst.eu:
      final start = _lastSunday(y, 3).add(const Duration(hours: 1));
      final end = _lastSunday(y, 10).add(const Duration(hours: 1));
      return !utc.isBefore(start) && utc.isBefore(end);
    case _Dst.us:
      final start = _nthSunday(y, 3, 2).add(const Duration(hours: 2)).subtract(zone.standard);
      final end = _nthSunday(y, 11, 1).add(const Duration(hours: 2)).subtract(zone.standard + const Duration(hours: 1));
      return !utc.isBefore(start) && utc.isBefore(end);
    case _Dst.au:
      final start = _nthSunday(y, 10, 1).add(const Duration(hours: 2)).subtract(zone.standard);
      final end = _nthSunday(y, 4, 1).add(const Duration(hours: 3)).subtract(zone.standard + const Duration(hours: 1));
      return utc.isBefore(end) || !utc.isBefore(start);
  }
}

DateTime venueLocal(DateTime utc, String timezone) {
  final zone = _zones[timezone];
  if (zone == null) return utc.toUtc();
  final instant = utc.toUtc();
  return instant.add(zone.standard + (_inDst(instant, zone) ? const Duration(hours: 1) : Duration.zero));
}

/// Every zone the app can show venue time for, so the host's picker and the display agree.
final knownTimezones = _zoneOffsets.keys.where((z) => z != 'UTC').toList();

/// "Lagos · UTC+1", "Kolkata · UTC+5:30"
String timezoneLabel(String timezone) {
  final offset = _zoneOffsets[timezone] ?? Duration.zero;
  final sign = offset.isNegative ? '-' : '+';
  final hours = offset.inHours.abs();
  final minutes = offset.inMinutes.abs() % 60;
  final city = timezone.split('/').last.replaceAll('_', ' ');
  return '$city · UTC$sign$hours${minutes == 0 ? '' : ':${minutes.toString().padLeft(2, '0')}'}';
}

/// "Sat 14 Nov"
String formatDay(DateTime utc, String timezone) => DateFormat('EEE d MMM').format(venueLocal(utc, timezone));

/// "5:30 PM"
String formatTime(DateTime utc, String timezone) => DateFormat('h:mm a').format(venueLocal(utc, timezone));

/// "Sat 14 Nov · 5:30 PM"
String formatWhen(DateTime utc, String timezone) => '${formatDay(utc, timezone)} · ${formatTime(utc, timezone)}';

String formatMoney(Money money) {
  final whole = money.amountMinor % 100 == 0;
  return NumberFormat.currency(symbol: _symbol(money.currency), decimalDigits: whole ? 0 : 2).format(money.amountMinor / 100);
}

String _symbol(String currency) => switch (currency.toUpperCase()) {
      'USD' => r'$',
      'NGN' => '₦',
      'GBP' => '£',
      'EUR' => '€',
      'KES' => 'KSh ',
      'ZAR' => 'R',
      'CHF' => 'CHF ',
      'JPY' => '¥',
      'MXN' => 'MX\$',
      'BRL' => 'R\$',
      'ARS' => 'AR\$',
      _ => '${currency.toUpperCase()} ',
    };

/// Shared rule from API.md: "N of 12 spots left", "Last spot of 12", "Full · 12 of 12 booked".
String spotsText(int spotsLeft, int capacity, {bool short = false}) {
  if (spotsLeft <= 0) return 'Full · $capacity of $capacity booked';
  if (spotsLeft == 1) return 'Last spot of $capacity';
  return short ? '$spotsLeft of $capacity left' : '$spotsLeft of $capacity spots left';
}

bool isFillingFast(int spotsLeft, int capacity) => spotsLeft > 0 && spotsLeft <= (capacity / 3).ceil();
bool isScarce(int spotsLeft) => spotsLeft > 0 && spotsLeft <= 3;

const _avatarColours = [Color(0xFF0F5F5C), Color(0xFF8A5A44), Color(0xFF6B4E9B), Color(0xFF4A6B8A), Color(0xFF4E7C8A), Color(0xFF2F6D3A), Color(0xFF7A5A2F), Color(0xFF9A4A6B)];

Color avatarColour(String name) {
  var h = 0;
  for (final c in name.codeUnits) {
    h = (h * 31 + c) & 0x7fffffff;
  }
  return _avatarColours[h % _avatarColours.length];
}

String initial(String name) => name.trim().isEmpty ? '?' : name.trim()[0].toUpperCase();

/// "just now", "20 min ago", "yesterday", "Mon", "3 weeks ago"
String formatRelative(DateTime when, {DateTime? now}) {
  final diff = (now ?? DateTime.now()).difference(when);
  final minutes = diff.inMinutes;
  if (minutes < 2) return 'just now';
  if (minutes < 60) return '$minutes min ago';
  final hours = diff.inHours;
  if (hours < 24) return '$hours h ago';
  final days = diff.inDays;
  if (days == 1) return 'yesterday';
  if (days < 7) return DateFormat('EEE').format(when);
  final weeks = (days / 7).round();
  if (weeks == 1) return 'last week';
  return '$weeks weeks ago';
}

String describeJoin(Member m, String? viewerId) {
  if (m.joinedVia == 'direct') return m.role == 'owner' ? 'Started the plan' : 'Booked';
  final by = m.invitedBy == null ? 'someone' : (m.invitedBy!.id == viewerId ? 'you' : m.invitedBy!.displayName);
  if (m.joinedVia == 'vouch') return by == 'you' ? 'Claimed your vouch' : 'Vouched by $by';
  return by == 'you' ? 'Joined from your link' : "From $by's link";
}

String listNames(List<String> names) {
  if (names.isEmpty) return '';
  if (names.length == 1) return names.first;
  if (names.length == 2) return '${names[0]} and ${names[1]}';
  return '${names.sublist(0, names.length - 1).join(', ')} and ${names.last}';
}

const categoryLabels = <String, String>{
  'outdoors': 'Outdoors',
  'nights_out': 'Nights out',
  'food_and_drink': 'Food and drink',
  'classes': 'Classes',
  'other': 'Other',
};

Color spotColour(int spotsLeft) => spotsLeft <= 0 ? VelioColors.muted : (isScarce(spotsLeft) ? VelioColors.scarcityText : VelioColors.primaryDeep);
Color dotColour(int spotsLeft) => spotsLeft <= 0 ? const Color(0xFF9AA1AA) : (isScarce(spotsLeft) ? VelioColors.scarcityDot : VelioColors.primary);
