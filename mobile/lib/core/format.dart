import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import 'models.dart';
import 'theme.dart';

/// Fixed offsets for the zones the prototype uses. The API sends UTC instants and an IANA name;
/// without a tz database on the phone, these are enough to show venue local time.
const _zoneOffsets = <String, Duration>{
  'Africa/Lagos': Duration(hours: 1),
  'Africa/Nairobi': Duration(hours: 3),
  'Africa/Johannesburg': Duration(hours: 2),
  'Europe/London': Duration(hours: 0),
  'Europe/Paris': Duration(hours: 1),
  'Europe/Berlin': Duration(hours: 1),
  'America/New_York': Duration(hours: -5),
  'America/Chicago': Duration(hours: -6),
  'America/Los_Angeles': Duration(hours: -8),
  'America/Sao_Paulo': Duration(hours: -3),
  'Asia/Dubai': Duration(hours: 4),
  'Asia/Kolkata': Duration(hours: 5, minutes: 30),
  'Asia/Singapore': Duration(hours: 8),
  'Asia/Tokyo': Duration(hours: 9),
  'Australia/Sydney': Duration(hours: 10),
  'UTC': Duration.zero,
};

DateTime venueLocal(DateTime utc, String timezone) => utc.toUtc().add(_zoneOffsets[timezone] ?? Duration.zero);

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
