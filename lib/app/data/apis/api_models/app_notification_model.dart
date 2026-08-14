class AppNotificationModel {
  const AppNotificationModel({
    required this.id,
    required this.message,
    required this.read,
    this.type,
    this.userId,
    this.recipientType,
    this.title,
    this.deepLink,
    this.rideId,
    this.conversationId,
    this.messageId,
    this.data = const <String, dynamic>{},
    this.readAt,
    this.createdAt,
  });

  final String id;
  final String message;
  final bool read;
  final String? type;
  final String? userId;
  final String? recipientType;
  final String? title;
  final String? deepLink;
  final String? rideId;
  final String? conversationId;
  final String? messageId;
  final Map<String, dynamic> data;
  final DateTime? readAt;
  final DateTime? createdAt;

  /// Derived title: the server always sends a title now; legacy rows fall
  /// back to the notification type label.
  String get effectiveTitle {
    final String t = (title ?? '').trim();
    if (t.isNotEmpty) return t;
    return _titleFor(type);
  }

  /// Canonical navigation target. The server sends `deepLink` for every
  /// actionable notification; older rows fall back to a type-derived link.
  String get effectiveDeepLink {
    final String link = (deepLink ?? '').trim();
    if (link.isNotEmpty) return link;
    return _deepLinkFor(type, rideId: rideId, conversationId: conversationId);
  }

  bool get isUnread => !read;

  AppNotificationModel copyWith({bool? read}) => AppNotificationModel(
        id: id,
        message: message,
        read: read ?? this.read,
        type: type,
        userId: userId,
        recipientType: recipientType,
        title: title,
        deepLink: deepLink,
        rideId: rideId,
        conversationId: conversationId,
        messageId: messageId,
        data: data,
        readAt: readAt,
        createdAt: createdAt,
      );

  factory AppNotificationModel.fromJson(Map<String, dynamic> json) {
    final dynamic dataJson = json['data'];
    return AppNotificationModel(
      id: (json['_id'] ?? json['id'] ?? '').toString(),
      message: (json['message'] ?? '').toString(),
      read: json['read'] == true,
      type: (json['type'] ?? 'GENERAL').toString(),
      userId: json['userId']?.toString(),
      recipientType: json['recipientType']?.toString(),
      title: json['title']?.toString(),
      deepLink: json['deepLink']?.toString(),
      rideId: json['rideId']?.toString(),
      conversationId: json['conversationId']?.toString(),
      messageId: json['messageId']?.toString(),
      data: dataJson is Map
          ? Map<String, dynamic>.from(dataJson)
          : const <String, dynamic>{},
      readAt: DateTime.tryParse((json['readAt'] ?? '').toString())?.toLocal(),
      createdAt:
          DateTime.tryParse((json['createdAt'] ?? '').toString())?.toLocal(),
    );
  }

  static String _titleFor(String? type) => switch (type) {
        'RIDE_MESSAGE' => 'New message',
        'RIDE_REQUEST' => 'New ride request',
        'RIDE_ACCEPTED' => 'Driver found',
        'RIDE_CONFIRMED' => 'Ride accepted',
        'RIDE_ON_THE_WAY' => 'Your driver is on the way',
        'DRIVER_ARRIVED' => 'Your driver has arrived',
        'RIDE_STARTED' => 'Your ride has started',
        'RIDE_COMPLETED' => 'Ride complete',
        'RIDE_CANCELLED' => 'Ride cancelled',
        'RIDE_DRIVER_CANCELLED' => 'Your driver cancelled',
        'RIDE_PASSENGER_CANCELLED' => 'Passenger cancelled the ride',
        'RIDE_DISPUTED' => 'Ride under review',
        'CALL_MISSED' => 'Missed call',
        'DRIVER_APPROVED' => 'Application approved',
        'DRIVER_REJECTED' => 'Application not approved',
        'TRIP_OFFER_RECEIVED' => 'New trip offer',
        'TRIP_OFFER_ACCEPTED' => 'Trip offer accepted',
        'TRIP_OFFER_UPDATED' => 'Trip offer updated',
        'POINTS_LOW_BALANCE' => 'Points getting low',
        'POINTS_INSUFFICIENT_BALANCE' => 'Not enough points',
        'PURCHASED_POINTS_CREDITED' => 'Points purchased',
        'POINTS_CREDITED' => 'Points credited',
        'POINTS_ADJUSTED' => 'Points deducted',
        'WELCOME_POINTS_RECEIVED' => 'Welcome bonus',
        'OFFER_POINTS_RELEASED' => 'Points released',
        'RIDE_POINTS_CHARGED' => 'Points charged',
        'POINT_PURCHASE_REQUEST_UPDATED' => 'Purchase request updated',
        _ => 'Notification',
      };

  static String _deepLinkFor(String? type,
      {String? rideId, String? conversationId}) {
    final String t = (type ?? '').toUpperCase();
    if (t == 'RIDE_REQUEST') return 'drewel://driver/ride-request';
    if (t == 'RIDE_MESSAGE' || t == 'CHAT') {
      final String id = (rideId ?? conversationId ?? '');
      return id.isNotEmpty
          ? 'drewel://chat/ride?rideId=$id'
          : 'drewel://notifications';
    }
    if (t == 'CALL_MISSED' || t == 'MISSED_CALL') return 'drewel://call/active';
    if (t == 'DRIVER_APPROVED' || t == 'DRIVER_REJECTED') {
      return 'drewel://driver/status';
    }
    if (t.startsWith('POINTS') || t.startsWith('OFFER_POINTS')) {
      return 'drewel://driver/points';
    }
    if (t.startsWith('RIDE_') ||
        t.startsWith('DRIVER_ARRIVED') ||
        t.startsWith('TRIP_OFFER')) {
      if (t == 'RIDE_COMPLETED') return 'drewel://passenger/ride-summary';
      return rideId != null
          ? 'drewel://passenger/active-ride?rideId=$rideId'
          : 'drewel://rides';
    }
    return 'drewel://notifications';
  }
}
