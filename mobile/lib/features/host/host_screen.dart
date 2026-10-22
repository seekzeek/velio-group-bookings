import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/config.dart';
import '../../core/errors.dart';
import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/sse.dart';
import '../../core/theme.dart';
import '../../widgets/bits.dart';
import '../../widgets/cover.dart';
import '../plans/plans_screen.dart';

/// The Host tab: My plans on the hosting side, plus the way in to create.
class HostScreen extends ConsumerWidget {
  const HostScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return const PlansScreen(initialTab: 1);
  }
}

/// New activity: one form, then published with the share link and a vouch.
class CreateActivityScreen extends ConsumerStatefulWidget {
  const CreateActivityScreen({super.key});

  @override
  ConsumerState<CreateActivityScreen> createState() => _CreateActivityScreenState();
}

class _CreateActivityScreenState extends ConsumerState<CreateActivityScreen> {
  final _title = TextEditingController();
  final _description = TextEditingController();
  final _location = TextEditingController();
  final _price = TextEditingController(text: '0');
  String _category = 'outdoors';
  String _timezone = 'Africa/Lagos';
  String _currency = 'USD';
  DateTime? _date;
  TimeOfDay _time = const TimeOfDay(hour: 18, minute: 0);
  int _capacity = 12;
  bool _busy = false;
  Map<String, String> _errors = {};
  String? _rootError;
  Activity? _published;

  static const _timezones = ['Africa/Lagos', 'Africa/Nairobi', 'Africa/Johannesburg', 'Europe/London', 'Europe/Paris', 'America/New_York', 'America/Los_Angeles', 'Asia/Dubai', 'Asia/Singapore'];

  Future<void> _publish() async {
    final date = _date;
    setState(() {
      _errors = {};
      _rootError = null;
      if (date == null) _errors['date'] = 'Pick a date.';
      if (_title.text.trim().length < 3) _errors['title'] = 'Give it a name of at least 3 characters.';
      if (_location.text.trim().isEmpty) _errors['location'] = 'Say where to meet.';
    });
    if (_errors.isNotEmpty || date == null) return;
    setState(() => _busy = true);
    try {
      final local = '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}T${_time.hour.toString().padLeft(2, '0')}:${_time.minute.toString().padLeft(2, '0')}';
      final activity = await ref.read(apiProvider).createActivity({
        'title': _title.text.trim(),
        'description': _description.text.trim(),
        'category': _category,
        'location': _location.text.trim(),
        'startsAtLocal': local,
        'timezone': _timezone,
        'price': {'amountMinor': ((double.tryParse(_price.text) ?? 0) * 100).round(), 'currency': _currency},
        'capacity': _capacity,
      });
      HapticFeedback.mediumImpact();
      setState(() => _published = activity);
    } on ApiException catch (e) {
      final fields = (e.details?['fields'] as Map?)?.map((k, v) => MapEntry(k.toString(), v.toString())) ?? {};
      setState(() {
        _errors = {for (final entry in fields.entries) if (entry.key == 'startsAtLocal') 'date': entry.value else entry.key: entry.value};
        _rootError = fields.isEmpty ? ErrorCopy.of(e.code).title : null;
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final published = _published;
    if (published != null) return _Published(activity: published);
    return Scaffold(
      appBar: AppBar(title: Text('New activity', style: text.titleMedium), actions: [IconButton(icon: const Icon(Icons.close), tooltip: 'Close', onPressed: () => Navigator.of(context).pop())]),
      body: ListView(
        padding: const EdgeInsets.all(VelioSpace.page),
        children: [
          Text('People book one spot each and bring friends, so think in spots, not groups.', style: text.bodyLarge),
          const SizedBox(height: 20),
          _Field(label: 'Name', error: _errors['title'], child: TextField(controller: _title, decoration: const InputDecoration(hintText: 'Sunset Kayaking'), textCapitalization: TextCapitalization.words)),
          _Field(label: 'What happens', child: TextField(controller: _description, maxLines: 3, decoration: const InputDecoration(hintText: 'Two hours on calm water as the sun goes down.'))),
          _Field(
            label: 'Category',
            hint: 'Drives the filters on Explore and the illustrated cover when there are no photos.',
            child: DropdownButtonFormField<String>(initialValue: _category, items: [for (final e in categoryLabels.entries) DropdownMenuItem(value: e.key, child: Text(e.value))], onChanged: (v) => setState(() => _category = v ?? _category)),
          ),
          Row(children: [
            Expanded(
              child: _Field(
                label: 'Date',
                error: _errors['date'],
                child: OutlinedButton(
                  onPressed: () async {
                    final picked = await showDatePicker(context: context, firstDate: DateTime.now(), lastDate: DateTime.now().add(const Duration(days: 365)), initialDate: _date ?? DateTime.now().add(const Duration(days: 7)));
                    if (picked != null) setState(() => _date = picked);
                  },
                  child: Text(_date == null ? 'Pick a date' : '${_date!.day}/${_date!.month}/${_date!.year}'),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _Field(
                label: 'Starts',
                child: OutlinedButton(
                  onPressed: () async {
                    final picked = await showTimePicker(context: context, initialTime: _time);
                    if (picked != null) setState(() => _time = picked);
                  },
                  child: Text(_time.format(context)),
                ),
              ),
            ),
          ]),
          _Field(
            label: 'Time zone of the venue',
            hint: 'Guests see the time where it happens, wherever they are.',
            child: DropdownButtonFormField<String>(initialValue: _timezone, items: [for (final tz in _timezones) DropdownMenuItem(value: tz, child: Text(tz.split('/').last.replaceAll('_', ' ')))], onChanged: (v) => setState(() => _timezone = v ?? _timezone)),
          ),
          _Field(label: 'Where to meet', error: _errors['location'], child: TextField(controller: _location, decoration: const InputDecoration(hintText: 'Harbour jetty, pier 3'))),
          _Field(
            label: 'Price per spot',
            hint: 'Shown to guests. You collect it on the day.',
            error: _errors['price'],
            child: Row(children: [
              SizedBox(width: 110, child: DropdownButtonFormField<String>(initialValue: _currency, items: [for (final c in const ['USD', 'NGN', 'GBP', 'EUR', 'KES', 'ZAR']) DropdownMenuItem(value: c, child: Text(c))], onChanged: (v) => setState(() => _currency = v ?? _currency))),
              const SizedBox(width: 8),
              Expanded(child: TextField(controller: _price, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(hintText: '45.00'))),
            ]),
          ),
          _Field(
            label: 'Spots',
            hint: 'Everyone counts, across every group.',
            error: _errors['capacity'],
            child: Row(children: [
              IconButton.outlined(tooltip: 'One fewer spot', onPressed: () => setState(() => _capacity = (_capacity - 1).clamp(1, 500)), icon: const Icon(Icons.remove)),
              Expanded(child: Text('$_capacity', textAlign: TextAlign.center, style: text.headlineSmall)),
              IconButton.outlined(tooltip: 'One more spot', onPressed: () => setState(() => _capacity = (_capacity + 1).clamp(1, 500)), icon: const Icon(Icons.add)),
            ]),
          ),
          if (_rootError != null) Notice(title: _rootError!),
          const SizedBox(height: 16),
          Cta(label: 'Publish activity', busy: _busy, onPressed: _publish),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}

class _Field extends StatelessWidget {
  const _Field({required this.label, required this.child, this.hint, this.error});

  final String label;
  final Widget child;
  final String? hint;
  final String? error;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: text.labelMedium),
        const SizedBox(height: 6),
        child,
        if (error != null) ...[const SizedBox(height: 4), Text(error!, style: text.bodySmall?.copyWith(color: VelioColors.scarcityText))] else if (hint != null) ...[const SizedBox(height: 4), Text(hint!, style: text.bodySmall)],
      ]),
    );
  }
}

class _Published extends ConsumerStatefulWidget {
  const _Published({required this.activity});

  final Activity activity;

  @override
  ConsumerState<_Published> createState() => _PublishedState();
}

class _PublishedState extends ConsumerState<_Published> {
  final _contact = TextEditingController();
  bool _vouchOpen = false;
  bool _vouchSent = false;
  String? _error;

  @override
  Widget build(BuildContext context) {
    final a = widget.activity;
    final text = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(actions: [IconButton(icon: const Icon(Icons.close), tooltip: 'Close', onPressed: () => Navigator.of(context).pop())]),
      body: ListView(
        padding: const EdgeInsets.all(VelioSpace.page),
        children: [
          const Chip2('Published', tone: 'ok'),
          const SizedBox(height: 12),
          Text('${a.title} is live. Now fill it.', style: text.displaySmall),
          const SizedBox(height: 8),
          Text('Anyone can find it on Explore. People you know fill it fastest.', style: text.bodyLarge),
          const SizedBox(height: 24),
          if (a.invitesEnabled) ...[
            Cta(
              label: 'Share the link',
              onPressed: () async {
                final invite = await ref.read(apiProvider).createInvite(rail: 'public', activityId: a.id);
                track(ref, 'invite_link_shared', inviteCode: invite.code, activityId: a.id);
                await Share.share('Come to ${a.title}: ${invite.url}');
              },
            ),
            const SizedBox(height: 10),
            if (!_vouchOpen) OutlinedButton(onPressed: () => setState(() => _vouchOpen = true), child: const Text('Vouch for someone')),
            if (_vouchOpen)
              VelioCard(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('Vouch for someone', style: TextStyle(fontWeight: FontWeight.w700)),
                  Text('A personal invite with your name on it. They start their own group.', style: text.bodySmall),
                  const SizedBox(height: 12),
                  TextField(controller: _contact, decoration: InputDecoration(hintText: 'Phone number or email', errorText: _error), keyboardType: TextInputType.emailAddress, autocorrect: false),
                  const SizedBox(height: 12),
                  Cta(
                    label: _vouchSent ? 'Vouch sent' : 'Send vouch',
                    tint: _vouchSent,
                    onPressed: _vouchSent
                        ? null
                        : () async {
                            try {
                              await ref.read(apiProvider).createInvite(rail: 'vouch', activityId: a.id, recipientContact: _contact.text.trim());
                              setState(() {
                                _vouchSent = true;
                                _error = null;
                              });
                            } on ApiException catch (e) {
                              setState(() => _error = e.code == ApiErrorCode.validation ? 'Enter a phone number or email.' : ErrorCopy.of(e.code).title);
                            }
                          },
                  ),
                ]),
              ),
          ] else
            Text("Invites aren't on for this activity, so it fills from Explore alone.", style: text.bodyMedium),
          const SizedBox(height: 16),
          Center(child: TextButton(onPressed: () => Navigator.of(context).pushReplacement(MaterialPageRoute<void>(builder: (_) => AttendanceScreen(activityId: a.id))), child: const Text('Watch bookings come in'))),
        ],
      ),
    );
  }
}

final attendanceProvider = FutureProvider.autoDispose.family<Attendance, String>((ref, activityId) async {
  ref.watch(sessionProvider);
  final api = ref.watch(apiProvider);
  // Refetch whenever the activity's version moves on the stream.
  final stream = AvailabilityStream(url: Uri.parse('${AppConfig.apiBaseUrl}/activities/$activityId/stream'), onAvailability: (_) => ref.invalidateSelf(), onGap: (_) => ref.invalidateSelf());
  ref.onDispose(stream.close);
  final attendance = await api.attendance(activityId);
  stream.lastVersion = attendance.totals.booked + 0 == 0 ? attendance.activity.version : attendance.activity.version;
  stream.start();
  return attendance;
});

/// Live attendance for the host: totals and who's coming, grouped by plan.
class AttendanceScreen extends ConsumerWidget {
  const AttendanceScreen({super.key, required this.activityId});

  final String activityId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = Theme.of(context).textTheme;
    final state = ref.watch(attendanceProvider(activityId));
    final userId = ref.watch(sessionProvider);
    return Scaffold(
      appBar: AppBar(title: Text("You're hosting", style: text.titleSmall)),
      body: state.when(
        loading: () => ListView(padding: const EdgeInsets.all(VelioSpace.page), children: const [Skeleton(height: 28, width: 200), SizedBox(height: 16), Skeleton(height: 150, radius: 20), SizedBox(height: 16), Skeleton(height: 80, radius: 20)]),
        error: (err, _) => Padding(padding: const EdgeInsets.all(VelioSpace.page), child: ErrorView(code: err is ApiException ? err.code : ApiErrorCode.tryAgain)),
        data: (data) {
          final a = data.activity;
          final t = data.totals;
          return ListView(
            padding: const EdgeInsets.all(VelioSpace.page),
            children: [
              Text(a.title, style: text.headlineMedium),
              Text(categoryLabels[a.category] ?? a.category, style: text.bodyMedium),
              const SizedBox(height: 16),
              VelioCard(
                clip: true,
                padding: EdgeInsets.zero,
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Cover(illustration: a.illustration, photos: a.photos, height: 150),
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(a.description, style: text.bodyMedium),
                      const SizedBox(height: 10),
                      Text('${formatWhen(a.startsAt, a.timezone)} local time', style: text.bodyMedium),
                      Text(a.location, style: text.bodyMedium),
                      Text('${formatMoney(a.price)} per spot, collected by you on the day', style: text.bodyMedium),
                      Text('${a.capacity} spots in total, across every group', style: text.bodyMedium),
                    ]),
                  ),
                ]),
              ),
              const SizedBox(height: 16),
              VelioCard(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Container(width: 8, height: 8, decoration: BoxDecoration(color: dotColour(t.spotsLeft), shape: BoxShape.circle)),
                    const SizedBox(width: 10),
                    Expanded(child: Text('${t.booked} of ${t.capacity} booked', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: spotColour(t.spotsLeft)))),
                    Text('LIVE', style: text.labelSmall),
                  ]),
                  const SizedBox(height: 10),
                  ClipRRect(borderRadius: BorderRadius.circular(2), child: LinearProgressIndicator(value: t.capacity == 0 ? 0 : t.booked / t.capacity, minHeight: 4, backgroundColor: VelioColors.border, color: dotColour(t.spotsLeft))),
                  const SizedBox(height: 8),
                  Text(t.plansCount == 0 ? 'No groups yet' : '${t.plansCount} ${t.plansCount == 1 ? 'group' : 'groups'} · ${t.viaInvites} came through invites', style: text.bodySmall),
                ]),
              ),
              const SizedBox(height: 20),
              if (data.plans.isEmpty)
                const EmptyView(title: 'No bookings yet', body: "It's on Explore. Share the link or vouch for someone to get the first group started.")
              else ...[
                Text("Who's coming, by group", style: text.titleMedium),
                const SizedBox(height: 10),
                for (final p in data.plans)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: VelioCard(
                      padding: const EdgeInsets.all(14),
                      child: Row(children: [
                        AvatarStack(names: p.members.map((m) => m.displayName).toList(), size: 28),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(p.membersCount == 1 ? '${p.owner.displayName} · 1' : "${p.owner.displayName}'s group · ${p.membersCount}", style: const TextStyle(fontWeight: FontWeight.w700)),
                            Text(p.membersCount == 1 ? 'Solo so far' : p.members.map((m) => m.joinedVia == 'direct' ? m.displayName : '${m.displayName} (${describeJoin(m, userId).toLowerCase()})').join(', '), style: text.bodySmall),
                          ]),
                        ),
                        if (DateTime.now().difference(data.latestJoinAt[p.id] ?? DateTime(2000)).inMinutes < 60) const Chip2('New', tone: 'ok'),
                      ]),
                    ),
                  ),
              ],
            ],
          );
        },
      ),
    );
  }
}
