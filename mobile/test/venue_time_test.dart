import 'package:flutter_test/flutter_test.dart';
import 'package:velio/core/format.dart';

void main() {
  test('venue time follows daylight saving on both sides of each switch', () {
    // Europe: last Sunday of October 2026 is the 25th, switch at 01:00 UTC.
    expect(venueLocal(DateTime.utc(2026, 10, 24, 4, 30), 'Europe/Zurich').hour, 6);
    expect(venueLocal(DateTime.utc(2026, 10, 26, 5, 30), 'Europe/Zurich').hour, 6);
    expect(venueLocal(DateTime.utc(2026, 7, 1, 12), 'Europe/London').hour, 13);
    expect(venueLocal(DateTime.utc(2026, 12, 1, 12), 'Europe/London').hour, 12);
    // US: first Sunday of November 2026 is the 1st, switch at 02:00 local.
    expect(venueLocal(DateTime.utc(2026, 10, 25, 0, 0), 'America/New_York').hour, 20);
    expect(venueLocal(DateTime.utc(2026, 11, 2, 1, 0), 'America/New_York').hour, 20);
    // Southern hemisphere runs the other way.
    expect(venueLocal(DateTime.utc(2026, 1, 10, 0), 'Australia/Sydney').hour, 11);
    expect(venueLocal(DateTime.utc(2026, 6, 10, 0), 'Australia/Sydney').hour, 10);
    // Zones without daylight saving never shift.
    expect(venueLocal(DateTime.utc(2026, 7, 1, 12), 'Africa/Lagos').hour, 13);
    expect(venueLocal(DateTime.utc(2026, 7, 1, 12), 'America/Sao_Paulo').hour, 9);
  });
}
