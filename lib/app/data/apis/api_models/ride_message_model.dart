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
    this.clientMessageId,
    this.audioUrl,
    this.audioDuration,
    this.audioMimeType,
    this.audioSize,
    this.createdAt,
  });

  final String id;
  final String rideId;
  final String text;
  final String senderId;
  final RideMessageStatus status;
  final String messageType;
  final Map<String, dynamic>? metadata;

  /// Idempotency key echoed by the server (top-level field, not metadata).
  final String? clientMessageId;

  // Voice-only metadata. Null for text/trip-request messages.
  final String? audioUrl;
  final double? audioDuration;
  final String? audioMimeType;
  final int? audioSize;

  final DateTime? createdAt;

  bool get isVoice => messageType.trim().toLowerCase() == 'voice';

  bool get isTripRequest =>
      messageType.trim().toLowerCase() == 'trip_request' ||
      metadata?['pickup'] is Map ||
      metadata?['destination'] is Map ||
      text.trim().toLowerCase().startsWith('trip request:');

  bool get isCancelledTripRequest {
    final Object? status = metadata?['tripRequestStatus'];
    return status?.toString().trim().toLowerCase() == 'cancelled';
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
        clientMessageId: json['clientMessageId']?.toString(),
        audioUrl: json['audioUrl']?.toString(),
        audioDuration: (json['audioDuration'] as num?)?.toDouble(),
        audioMimeType: json['audioMimeType']?.toString(),
        audioSize: (json['audioSize'] as num?)?.toInt(),
        createdAt: DateTime.tryParse((json['createdAt'] ?? '').toString()),
      );

  /// Convenience constructor used for optimistic local rows and realtime
  /// socket payloads, where fields arrive flat instead of nested.
  factory RideMessageModel.fromFlat({
    required String id,
    required String rideId,
    required Map<dynamic, dynamic> data,
    required String fallbackSenderId,
  }) =>
      RideMessageModel(
        id: id,
        rideId: rideId,
        text: (data['text'] ?? '').toString(),
        senderId: (data['senderId'] ?? fallbackSenderId).toString(),
        status: RideMessageStatus.fromValue(data['status']),
        messageType: (data['messageType'] ?? 'text').toString(),
        metadata:
            data['metadata'] is Map ? Map<String, dynamic>.from(data['metadata'] as Map) : null,
        clientMessageId: data['clientMessageId']?.toString(),
        audioUrl: data['audioUrl']?.toString(),
        audioDuration: (data['audioDuration'] as num?)?.toDouble(),
        audioMimeType: data['audioMimeType']?.toString(),
        audioSize: (data['audioSize'] as num?)?.toInt(),
        createdAt: DateTime.tryParse((data['createdAt'] ?? '').toString()),
      );
}
