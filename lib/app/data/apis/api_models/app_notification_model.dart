class AppNotificationModel {
  const AppNotificationModel({
    required this.id,
    required this.message,
    required this.read,
    this.type,
    this.userId,
    this.recipientType,
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
  final Map<String, dynamic> data;
  final DateTime? readAt;
  final DateTime? createdAt;

  String? get rideId => data['rideId']?.toString();
  String? get messageId => data['messageId']?.toString();
  String? get conversationId => data['conversationId']?.toString();

  AppNotificationModel copyWith({bool? read}) => AppNotificationModel(
        id: id,
        message: message,
        read: read ?? this.read,
        type: type,
        userId: userId,
        recipientType: recipientType,
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
      data: dataJson is Map
          ? Map<String, dynamic>.from(dataJson)
          : const <String, dynamic>{},
      readAt: DateTime.tryParse((json['readAt'] ?? '').toString())?.toLocal(),
      createdAt:
          DateTime.tryParse((json['createdAt'] ?? '').toString())?.toLocal(),
    );
  }
}
