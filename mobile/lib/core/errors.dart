/// Stable error codes from API.md. Screens switch on these, never on messages.
enum ApiErrorCode {
  soldOut('SOLD_OUT'),
  alreadyBooked('ALREADY_BOOKED'),
  activityStarted('ACTIVITY_STARTED'),
  inviteNotFound('INVITE_NOT_FOUND'),
  inviteExpired('INVITE_EXPIRED'),
  inviteUsed('INVITE_USED'),
  inviteRevoked('INVITE_REVOKED'),
  inviteNotForYou('INVITE_NOT_FOR_YOU'),
  invitesOff('INVITES_OFF'),
  vouchLimit('VOUCH_LIMIT'),
  notGoing('NOT_GOING'),
  photoTooLarge('PHOTO_TOO_LARGE'),
  photoType('PHOTO_TYPE'),
  photoLimit('PHOTO_LIMIT'),
  validation('VALIDATION'),
  unauthenticated('UNAUTHENTICATED'),
  forbidden('FORBIDDEN'),
  notFound('NOT_FOUND'),
  rateLimited('RATE_LIMITED'),
  tryAgain('TRY_AGAIN'),
  internal('INTERNAL'),
  offline('OFFLINE');

  const ApiErrorCode(this.wire);

  final String wire;

  static ApiErrorCode fromWire(String? code) =>
      ApiErrorCode.values.firstWhere((c) => c.wire == code, orElse: () => ApiErrorCode.tryAgain);
}

class ApiException implements Exception {
  ApiException(this.code, {this.message, this.status = 0, this.details});

  final ApiErrorCode code;
  final String? message;
  final int status;
  final Map<String, dynamic>? details;

  bool get isRetryable =>
      code == ApiErrorCode.tryAgain || code == ApiErrorCode.rateLimited || code == ApiErrorCode.offline || code == ApiErrorCode.internal;

  @override
  String toString() => 'ApiException(${code.wire}, $status, $message)';
}

/// What each code means to a person. Matches the error table in API.md.
class ErrorCopy {
  const ErrorCopy(this.title, this.body);

  final String title;
  final String body;

  static ErrorCopy of(ApiErrorCode code, {String inviter = 'the person who sent it'}) => switch (code) {
        ApiErrorCode.soldOut => const ErrorCopy('Someone got there a second before you', 'The last spot went while you were booking, so you haven\'t been booked.'),
        ApiErrorCode.alreadyBooked => const ErrorCopy('You\'re already going', 'Your spot is saved. Here\'s your plan.'),
        ApiErrorCode.activityStarted => const ErrorCopy('This one has already started', 'Here\'s what\'s coming up instead.'),
        ApiErrorCode.inviteNotFound => const ErrorCopy('We can\'t find that code', 'Check it with whoever sent it. Capitals and dashes don\'t matter.'),
        ApiErrorCode.inviteExpired => const ErrorCopy('This invite has expired', 'The activity it was for has already happened.'),
        ApiErrorCode.inviteUsed => ErrorCopy('This invite has already been claimed', 'Ask $inviter for another one.'),
        ApiErrorCode.inviteRevoked => const ErrorCopy('This link was turned off', 'The person who shared it turned it off. Ask them for a new one.'),
        ApiErrorCode.inviteNotForYou => ErrorCopy('This invite was sent to a different number or email', 'Check with $inviter which one they used.'),
        ApiErrorCode.invitesOff => const ErrorCopy('Invites aren\'t available for this activity', 'You can still book a spot directly.'),
        ApiErrorCode.vouchLimit => const ErrorCopy('You\'ve vouched for 10 people on this one', 'Share the link instead.'),
        ApiErrorCode.notGoing => const ErrorCopy('Book a spot first', 'Then bring your people.'),
        ApiErrorCode.photoTooLarge => const ErrorCopy('This one\'s over 10 MB', 'Try a smaller photo.'),
        ApiErrorCode.photoType => const ErrorCopy('Photos need to be JPG, PNG or WebP', ''),
        ApiErrorCode.photoLimit => const ErrorCopy('That\'s the limit of 6 photos', ''),
        ApiErrorCode.validation => const ErrorCopy('Some of that isn\'t right', 'Check the highlighted fields.'),
        ApiErrorCode.unauthenticated => const ErrorCopy('We don\'t know who you are yet', 'Claim an invite or enter a code to get started.'),
        ApiErrorCode.forbidden => const ErrorCopy('That isn\'t yours to change', ''),
        ApiErrorCode.notFound => const ErrorCopy('We can\'t find that one', 'It may have been removed.'),
        ApiErrorCode.rateLimited => const ErrorCopy('Slow down a moment', 'Try again in a few seconds.'),
        ApiErrorCode.offline => const ErrorCopy('You\'re offline', 'We need a connection to make sure the spot is still yours.'),
        ApiErrorCode.tryAgain || ApiErrorCode.internal => const ErrorCopy('Something went wrong on our side', 'Nothing was booked. Try again.'),
      };
}
