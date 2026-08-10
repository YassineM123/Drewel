enum ConversationStatus {
  active,
  completed,
  cancelled,
  unknown;

  static ConversationStatus fromValue(Object? value) => values.firstWhere(
        (ConversationStatus status) => status.name == value?.toString(),
        orElse: () => ConversationStatus.unknown,
      );
}

class ConversationCounterpartModel {
  const ConversationCounterpartModel({
    required this.id,
    required this.role,
    required this.firstName,
    required this.fullName,
    this.profileImageUrl,
    this.vehicleType,
    this.vehicleModel,
    this.registration,
    this.rating,
  });

  final String id;
  final String role;
  final String firstName;
  final String fullName;
  final String? profileImageUrl;
  final String? vehicleType;
  final String? vehicleModel;
  final String? registration;
  final double? rating;

  String get displayName => fullName.trim().isNotEmpty ? fullName : firstName;

  factory ConversationCounterpartModel.fromJson(Map<String, dynamic> json) =>
      ConversationCounterpartModel(
        id: (json['_id'] ?? json['id'] ?? '').toString(),
        role: (json['role'] ?? '').toString(),
        firstName: (json['firstName'] ?? '').toString(),
        fullName: (json['fullName'] ?? json['name'] ?? '').toString(),
        profileImageUrl:
            (json['profileImageUrl'] ?? json['profile_image_url'])?.toString(),
        vehicleType: json['vehicleType']?.toString(),
        vehicleModel: json['vehicleModel']?.toString(),
        registration: json['registration']?.toString(),
        rating: json['rating'] is num
            ? (json['rating'] as num).toDouble()
            : double.tryParse((json['rating'] ?? '').toString()),
      );
}

class ConversationLastMessageModel {
  const ConversationLastMessageModel({
    required this.preview,
    required this.senderRole,
    required this.status,
    this.at,
  });

  final String preview;
  final String senderRole;
  final String status;
  final DateTime? at;

  factory ConversationLastMessageModel.fromJson(Map<String, dynamic> json) =>
      ConversationLastMessageModel(
        preview: (json['preview'] ?? '').toString(),
        senderRole: (json['senderRole'] ?? '').toString(),
        status: (json['status'] ?? '').toString(),
        at: DateTime.tryParse((json['at'] ?? '').toString())?.toLocal(),
      );
}

class RideConversationModel {
  const RideConversationModel({
    required this.id,
    required this.rideId,
    required this.status,
    this.rideReference,
    this.counterpart,
    this.lastMessage,
    this.myUnreadCount = 0,
    this.lastMessageAt,
    this.createdAt,
    this.updatedAt,
  });

  final String id;
  final String rideId;
  final String status;
  final String? rideReference;
  final ConversationCounterpartModel? counterpart;
  final ConversationLastMessageModel? lastMessage;
  final int myUnreadCount;
  final DateTime? lastMessageAt;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  ConversationStatus get conversationStatus =>
      ConversationStatus.fromValue(status);
  bool get hasUnread => myUnreadCount > 0;

  RideConversationModel copyWith({
    int? myUnreadCount,
    ConversationLastMessageModel? lastMessage,
    String? status,
  }) =>
      RideConversationModel(
        id: id,
        rideId: rideId,
        status: status ?? this.status,
        rideReference: rideReference,
        counterpart: counterpart,
        lastMessage: lastMessage ?? this.lastMessage,
        myUnreadCount: myUnreadCount ?? this.myUnreadCount,
        lastMessageAt: lastMessageAt,
        createdAt: createdAt,
        updatedAt: updatedAt,
      );

  factory RideConversationModel.fromJson(Map<String, dynamic> json) {
    final dynamic counterpartJson = json['counterpart'];
    final dynamic lastMessageJson = json['lastMessage'];
    return RideConversationModel(
      id: (json['_id'] ?? json['id'] ?? json['conversationId'] ?? '').toString(),
      rideId: (json['rideId'] ?? '').toString(),
      status: (json['status'] ?? '').toString().toLowerCase(),
      rideReference: json['rideReference']?.toString(),
      counterpart: counterpartJson is Map
          ? ConversationCounterpartModel.fromJson(
              Map<String, dynamic>.from(counterpartJson))
          : null,
      lastMessage: lastMessageJson is Map
          ? ConversationLastMessageModel.fromJson(
              Map<String, dynamic>.from(lastMessageJson))
          : null,
      myUnreadCount:
          (json['myUnreadCount'] as num?)?.toInt() ?? (json['unreadCount'] as num?)?.toInt() ?? 0,
      lastMessageAt:
          DateTime.tryParse((json['lastMessageAt'] ?? '').toString())?.toLocal(),
      createdAt:
          DateTime.tryParse((json['createdAt'] ?? '').toString())?.toLocal(),
      updatedAt:
          DateTime.tryParse((json['updatedAt'] ?? '').toString())?.toLocal(),
    );
  }
}
