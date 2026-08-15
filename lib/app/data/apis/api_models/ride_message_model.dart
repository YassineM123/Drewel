enum RideMessageStatus {
  sent,
  delivered,
  read;

  static RideMessageStatus fromValue(Object? value) => values.firstWhere(
        (RideMessageStatus status) => status.name == value?.toString(),
        orElse: () => RideMessageStatus.sent,
      );
}

class RideMessageModel {
  const RideMessageModel({
    required this.id,
    required this.rideId,
    required this.text,
    required this.senderId,
    required this.status,
    this.messageType = 'text',
    this.metadata,
    this.createdAt,
  });

  final String id;
  final String rideId;
  final String text;
  final String senderId;
  final RideMessageStatus status;
  final String messageType;
  final Map<String, dynamic>? metadata;
  final DateTime? createdAt;

  bool get isCancelledTripRequest {
    final Object? status = metadata?['tripRequestStatus'];
    return status?.toString().trim().toLowerCase() == 'cancelled';
  }

  RideMessageModel copyWith({
    Map<String, dynamic>? metadata,
  }) =>
      RideMessageModel(
        id: id,
        rideId: rideId,
        text: text,
        senderId: senderId,
        status: status,
        messageType: messageType,
        metadata: metadata ?? this.metadata,
        createdAt: createdAt,
      );

  bool get isTripRequest {
    final String normalizedType = messageType.trim().toLowerCase();
    if (normalizedType == 'trip_request') return true;
    if (metadata?['pickup'] is Map || metadata?['destination'] is Map) {
      return true;
    }
    return text.trim().toLowerCase().startsWith('trip request:');
  }

  factory RideMessageModel.fromJson(Map<String, dynamic> json) =>
      RideMessageModel(
        id: (json['_id'] ?? json['id'] ?? json['messageId'] ?? '').toString(),
        rideId: (json['rideId'] ?? '').toString(),
        text: (json['text'] ?? '').toString(),
        senderId: (json['senderId'] ?? json['sender'] ?? '').toString(),
        status: RideMessageStatus.fromValue(json['status']),
        messageType: (json['messageType'] ?? json['type'] ?? 'text')
            .toString()
            .trim()
            .toLowerCase(),
        metadata: json['metadata'] is Map
            ? Map<String, dynamic>.from(json['metadata'] as Map)
            : null,
        createdAt: DateTime.tryParse((json['createdAt'] ?? '').toString()),
      );
}
