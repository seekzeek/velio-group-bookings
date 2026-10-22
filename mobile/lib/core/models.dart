// Response shapes from API.md. Hand-written parsers keep the app free of code generation.

class Person {
  const Person({required this.id, required this.displayName});

  final String id;
  final String displayName;

  factory Person.fromJson(Map<String, dynamic> j) => Person(id: j['id'] as String, displayName: j['displayName'] as String);
  Map<String, dynamic> toJson() => {'id': id, 'displayName': displayName};
}

class Money {
  const Money({required this.amountMinor, required this.currency});

  final int amountMinor;
  final String currency;

  factory Money.fromJson(Map<String, dynamic> j) => Money(amountMinor: j['amountMinor'] as int, currency: j['currency'] as String);
  Map<String, dynamic> toJson() => {'amountMinor': amountMinor, 'currency': currency};
}

class Photo {
  const Photo({required this.id, required this.url, required this.position});

  final String id;
  final String url;
  final int position;

  factory Photo.fromJson(Map<String, dynamic> j) => Photo(id: j['id'] as String, url: j['url'] as String, position: j['position'] as int);
  Map<String, dynamic> toJson() => {'id': id, 'url': url, 'position': position};
}

class Viewer {
  const Viewer({required this.bookingId, required this.planId, required this.planRole, required this.joinedVia});

  final String bookingId;
  final String planId;
  final String planRole;
  final String joinedVia;

  factory Viewer.fromJson(Map<String, dynamic> j) =>
      Viewer(bookingId: j['bookingId'] as String, planId: j['planId'] as String, planRole: j['planRole'] as String, joinedVia: j['joinedVia'] as String);
  Map<String, dynamic> toJson() => {'bookingId': bookingId, 'planId': planId, 'planRole': planRole, 'joinedVia': joinedVia};
}

class Activity {
  const Activity({
    required this.id,
    required this.title,
    required this.description,
    required this.category,
    required this.illustration,
    required this.location,
    required this.startsAt,
    required this.timezone,
    required this.price,
    required this.capacity,
    required this.spotsTaken,
    required this.spotsLeft,
    required this.version,
    required this.status,
    required this.host,
    required this.photos,
    required this.plansCount,
    required this.invitesEnabled,
    required this.viewer,
  });

  final String id;
  final String title;
  final String description;
  final String category;
  final String illustration;
  final String location;
  final DateTime startsAt;
  final String timezone;
  final Money price;
  final int capacity;
  final int spotsTaken;
  final int spotsLeft;
  final int version;
  final String status;
  final Person host;
  final List<Photo> photos;
  final int plansCount;
  final bool invitesEnabled;
  final Viewer? viewer;

  bool get isFull => spotsLeft <= 0;
  bool get hasStarted => status == 'started';
  bool get booked => viewer != null;

  factory Activity.fromJson(Map<String, dynamic> j) => Activity(
        id: j['id'] as String,
        title: j['title'] as String,
        description: (j['description'] as String?) ?? '',
        category: j['category'] as String,
        illustration: (j['illustration'] as String?) ?? 'other',
        location: j['location'] as String,
        startsAt: DateTime.parse(j['startsAt'] as String),
        timezone: j['timezone'] as String,
        price: Money.fromJson(j['price'] as Map<String, dynamic>),
        capacity: j['capacity'] as int,
        spotsTaken: j['spotsTaken'] as int,
        spotsLeft: j['spotsLeft'] as int,
        version: j['version'] as int,
        status: j['status'] as String,
        host: Person.fromJson(j['host'] as Map<String, dynamic>),
        photos: ((j['photos'] as List?) ?? const []).map((p) => Photo.fromJson(p as Map<String, dynamic>)).toList(),
        plansCount: (j['plansCount'] as int?) ?? 0,
        invitesEnabled: (j['invitesEnabled'] as bool?) ?? false,
        viewer: j['viewer'] == null ? null : Viewer.fromJson(j['viewer'] as Map<String, dynamic>),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'description': description,
        'category': category,
        'illustration': illustration,
        'location': location,
        'startsAt': startsAt.toIso8601String(),
        'timezone': timezone,
        'price': price.toJson(),
        'capacity': capacity,
        'spotsTaken': spotsTaken,
        'spotsLeft': spotsLeft,
        'version': version,
        'status': status,
        'host': host.toJson(),
        'photos': photos.map((p) => p.toJson()).toList(),
        'plansCount': plansCount,
        'invitesEnabled': invitesEnabled,
        'viewer': viewer?.toJson(),
      };

  Activity withCounts({required int spotsTaken, required int spotsLeft, required int version}) => Activity(
        id: id,
        title: title,
        description: description,
        category: category,
        illustration: illustration,
        location: location,
        startsAt: startsAt,
        timezone: timezone,
        price: price,
        capacity: capacity,
        spotsTaken: spotsTaken,
        spotsLeft: spotsLeft,
        version: version,
        status: hasStarted ? 'started' : (spotsLeft <= 0 ? 'full' : 'open'),
        host: host,
        photos: photos,
        plansCount: plansCount,
        invitesEnabled: invitesEnabled,
        viewer: viewer,
      );
}

class Member {
  const Member({required this.userId, required this.displayName, required this.role, required this.joinedVia, required this.invitedBy, required this.joinedAt});

  final String userId;
  final String displayName;
  final String role;
  final String joinedVia;
  final Person? invitedBy;
  final DateTime joinedAt;

  factory Member.fromJson(Map<String, dynamic> j) => Member(
        userId: j['userId'] as String,
        displayName: j['displayName'] as String,
        role: j['role'] as String,
        joinedVia: j['joinedVia'] as String,
        invitedBy: j['invitedBy'] == null ? null : Person.fromJson(j['invitedBy'] as Map<String, dynamic>),
        joinedAt: DateTime.parse(j['joinedAt'] as String),
      );
  Map<String, dynamic> toJson() => {'userId': userId, 'displayName': displayName, 'role': role, 'joinedVia': joinedVia, 'invitedBy': invitedBy?.toJson(), 'joinedAt': joinedAt.toIso8601String()};
}

class Plan {
  const Plan({required this.id, required this.activityId, required this.owner, required this.members});

  final String id;
  final String activityId;
  final Person owner;
  final List<Member> members;

  int get membersCount => members.length;

  factory Plan.fromJson(Map<String, dynamic> j) => Plan(
        id: j['id'] as String,
        activityId: j['activityId'] as String,
        owner: Person.fromJson(j['owner'] as Map<String, dynamic>),
        members: ((j['members'] as List?) ?? const []).map((m) => Member.fromJson(m as Map<String, dynamic>)).toList(),
      );
  Map<String, dynamic> toJson() => {'id': id, 'activityId': activityId, 'owner': owner.toJson(), 'members': members.map((m) => m.toJson()).toList()};
}

class ResolvedInvite {
  const ResolvedInvite({
    required this.code,
    required this.codeDisplay,
    required this.rail,
    required this.isHostInvite,
    required this.status,
    required this.inviter,
    required this.activity,
    required this.plan,
    required this.alreadyInPlan,
  });

  final String code;
  final String codeDisplay;
  final String rail;
  final bool isHostInvite;
  final String status;
  final Person inviter;
  final Activity activity;
  final Plan? plan;
  final bool alreadyInPlan;

  bool get isVouch => rail == 'vouch';

  factory ResolvedInvite.fromJson(Map<String, dynamic> j) => ResolvedInvite(
        code: j['code'] as String,
        codeDisplay: j['codeDisplay'] as String,
        rail: j['rail'] as String,
        isHostInvite: j['isHostInvite'] as bool,
        status: j['status'] as String,
        inviter: Person.fromJson(j['inviter'] as Map<String, dynamic>),
        activity: Activity.fromJson(j['activity'] as Map<String, dynamic>),
        plan: j['plan'] == null ? null : Plan.fromJson(j['plan'] as Map<String, dynamic>),
        alreadyInPlan: (j['viewer'] as Map<String, dynamic>?)?['alreadyInPlan'] == true,
      );

  Map<String, dynamic> toJson() => {
        'code': code,
        'codeDisplay': codeDisplay,
        'rail': rail,
        'isHostInvite': isHostInvite,
        'status': status,
        'inviter': inviter.toJson(),
        'activity': activity.toJson(),
        'plan': plan?.toJson(),
        'viewer': alreadyInPlan ? {'alreadyInPlan': true} : null,
      };
}

class Invite {
  const Invite({
    required this.id,
    required this.code,
    required this.codeDisplay,
    required this.url,
    required this.rail,
    required this.activityId,
    required this.recipientLabel,
    required this.status,
    required this.opensCount,
    required this.joinedCount,
    required this.joinedAt,
    required this.createdAt,
    required this.inviteeName,
    required this.inviteeWasNew,
  });

  final String id;
  final String code;
  final String codeDisplay;
  final String url;
  final String rail;
  final String activityId;
  final String? recipientLabel;
  final String status;
  final int opensCount;
  final int joinedCount;
  final DateTime? joinedAt;
  final DateTime createdAt;
  final String? inviteeName;
  final bool? inviteeWasNew;

  bool get isVouch => rail == 'vouch';

  factory Invite.fromJson(Map<String, dynamic> j) => Invite(
        id: j['id'] as String,
        code: j['code'] as String,
        codeDisplay: j['codeDisplay'] as String,
        url: j['url'] as String,
        rail: j['rail'] as String,
        activityId: j['activityId'] as String,
        recipientLabel: j['recipientLabel'] as String?,
        status: j['status'] as String,
        opensCount: (j['opensCount'] as int?) ?? 0,
        joinedCount: (j['joinedCount'] as int?) ?? 0,
        joinedAt: j['joinedAt'] == null ? null : DateTime.parse(j['joinedAt'] as String),
        createdAt: DateTime.parse(j['createdAt'] as String),
        inviteeName: (j['invitee'] as Map<String, dynamic>?)?['displayName'] as String?,
        inviteeWasNew: (j['invitee'] as Map<String, dynamic>?)?['wasNew'] as bool?,
      );
}

class BookingResult {
  const BookingResult({required this.bookingId, required this.plan, required this.activity, required this.replayed});

  final String bookingId;
  final Plan plan;
  final Activity activity;
  final bool replayed;

  factory BookingResult.fromJson(Map<String, dynamic> j) => BookingResult(
        bookingId: (j['booking'] as Map<String, dynamic>)['id'] as String,
        plan: Plan.fromJson(j['plan'] as Map<String, dynamic>),
        activity: Activity.fromJson(j['activity'] as Map<String, dynamic>),
        replayed: (j['replayed'] as bool?) ?? false,
      );
}

class ClaimResult {
  const ClaimResult({required this.userId, required this.isNewUser, required this.generation, required this.booking});

  final String userId;
  final bool isNewUser;
  final int generation;
  final BookingResult booking;

  factory ClaimResult.fromJson(Map<String, dynamic> j) => ClaimResult(
        userId: j['userId'] as String,
        isNewUser: (j['isNewUser'] as bool?) ?? false,
        generation: (j['generation'] as int?) ?? 0,
        booking: BookingResult.fromJson(j),
      );
}

class AttendanceTotals {
  const AttendanceTotals({required this.booked, required this.capacity, required this.spotsLeft, required this.plansCount, required this.groupsOfTwoOrMore, required this.viaInvites, required this.viaVouch, required this.viaPublic});

  final int booked;
  final int capacity;
  final int spotsLeft;
  final int plansCount;
  final int groupsOfTwoOrMore;
  final int viaInvites;
  final int viaVouch;
  final int viaPublic;

  factory AttendanceTotals.fromJson(Map<String, dynamic> j) {
    final via = j['viaInvites'] as Map<String, dynamic>;
    return AttendanceTotals(
      booked: j['booked'] as int,
      capacity: j['capacity'] as int,
      spotsLeft: j['spotsLeft'] as int,
      plansCount: j['plansCount'] as int,
      groupsOfTwoOrMore: j['groupsOfTwoOrMore'] as int,
      viaInvites: via['total'] as int,
      viaVouch: via['vouch'] as int,
      viaPublic: via['public'] as int,
    );
  }
}

class Attendance {
  const Attendance({required this.activity, required this.totals, required this.plans, required this.latestJoinAt});

  final Activity activity;
  final AttendanceTotals totals;
  final List<Plan> plans;
  final Map<String, DateTime> latestJoinAt;

  factory Attendance.fromJson(Map<String, dynamic> j) {
    final plans = (j['plans'] as List).cast<Map<String, dynamic>>();
    return Attendance(
      activity: Activity.fromJson(j['activity'] as Map<String, dynamic>),
      totals: AttendanceTotals.fromJson(j['totals'] as Map<String, dynamic>),
      plans: plans.map(Plan.fromJson).toList(),
      latestJoinAt: {for (final p in plans) p['id'] as String: DateTime.parse(p['latestJoinAt'] as String)},
    );
  }
}

class PlanEntry {
  const PlanEntry({required this.plan, required this.activity, required this.viewerRole, required this.viewerJoinedVia, required this.pendingVouches});

  final Plan plan;
  final Activity activity;
  final String viewerRole;
  final String viewerJoinedVia;
  final int pendingVouches;

  factory PlanEntry.fromJson(Map<String, dynamic> j) => PlanEntry(
        plan: Plan.fromJson(j['plan'] as Map<String, dynamic>),
        activity: Activity.fromJson(j['activity'] as Map<String, dynamic>),
        viewerRole: j['viewerRole'] as String,
        viewerJoinedVia: j['viewerJoinedVia'] as String,
        pendingVouches: (j['pendingVouches'] as int?) ?? 0,
      );
}

class HostedEntry {
  const HostedEntry({required this.activity, required this.plansCount, required this.viaInvites});

  final Activity activity;
  final int plansCount;
  final int viaInvites;

  factory HostedEntry.fromJson(Map<String, dynamic> j) {
    final attendance = j['attendance'] as Map<String, dynamic>;
    return HostedEntry(
      activity: Activity.fromJson(j['activity'] as Map<String, dynamic>),
      plansCount: attendance['plansCount'] as int,
      viaInvites: (attendance['viaInvites'] as Map<String, dynamic>)['total'] as int,
    );
  }
}

class MyPlans {
  const MyPlans({required this.going, required this.hosting, required this.past});

  final List<PlanEntry> going;
  final List<HostedEntry> hosting;
  final List<PlanEntry> past;

  factory MyPlans.fromJson(Map<String, dynamic> j) => MyPlans(
        going: (j['going'] as List).map((e) => PlanEntry.fromJson(e as Map<String, dynamic>)).toList(),
        hosting: (j['hosting'] as List).map((e) => HostedEntry.fromJson(e as Map<String, dynamic>)).toList(),
        past: ((j['past'] as List?) ?? const []).map((e) => PlanEntry.fromJson(e as Map<String, dynamic>)).toList(),
      );
}

class InviteGroup {
  const InviteGroup({required this.activity, required this.viewerGroupSize, required this.invites});

  final Activity activity;
  final int viewerGroupSize;
  final List<Invite> invites;

  factory InviteGroup.fromJson(Map<String, dynamic> j) => InviteGroup(
        activity: Activity.fromJson(j['activity'] as Map<String, dynamic>),
        viewerGroupSize: (j['viewerGroupSize'] as int?) ?? 0,
        invites: (j['invites'] as List).map((i) => Invite.fromJson(i as Map<String, dynamic>)).toList(),
      );
}

class MyInvites {
  const MyInvites({required this.sent, required this.vouches, required this.links, required this.joined, required this.joinedNew, required this.waiting, required this.missed, required this.groups});

  final int sent;
  final int vouches;
  final int links;
  final int joined;
  final int joinedNew;
  final int waiting;
  final int missed;
  final List<InviteGroup> groups;

  factory MyInvites.fromJson(Map<String, dynamic> j) {
    final s = j['summary'] as Map<String, dynamic>;
    return MyInvites(
      sent: s['sent'] as int,
      vouches: s['vouches'] as int,
      links: s['links'] as int,
      joined: s['joined'] as int,
      joinedNew: s['joinedNew'] as int,
      waiting: s['waiting'] as int,
      missed: s['missed'] as int,
      groups: (j['activities'] as List).map((g) => InviteGroup.fromJson(g as Map<String, dynamic>)).toList(),
    );
  }
}

class PickerUser {
  const PickerUser({required this.id, required this.displayName, required this.isHost});

  final String id;
  final String displayName;
  final bool isHost;

  factory PickerUser.fromJson(Map<String, dynamic> j) => PickerUser(id: j['id'] as String, displayName: j['displayName'] as String, isHost: (j['isHost'] as bool?) ?? false);
}
