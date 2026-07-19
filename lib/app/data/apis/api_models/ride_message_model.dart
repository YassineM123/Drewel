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
    this.createdAt,
  });

  final String id;
  final String rideId;
  final String text;
  final String senderId;
  final RideMessageStatus status;
  final DateTime? createdAt;

  factory RideMessageModel.fromJson(Map<String, dynamic> json) =>
      RideMessageModel(
        id: (json['_id'] ?? json['id'] ?? '').toString(),
        rideId: (json['rideId'] ?? '').toString(),
        text: (json['text'] ?? '').toString(),
        senderId: (json['senderId'] ?? json['sender'] ?? '').toString(),
        status: RideMessageStatus.fromValue(json['status']),
        createdAt: DateTime.tryParse((json['createdAt'] ?? '').toString()),
      );
}
