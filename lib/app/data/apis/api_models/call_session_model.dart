enum CallSessionStatus {
  initiating,
  ringing,
  accepted,
  connected,
  declined,
  missed,
  cancelled,
  ended,
  failed;

  bool get isActive => switch (this) {
        initiating || ringing || accepted || connected => true,
        _ => false,
      };

  static CallSessionStatus fromValue(Object? value) => values.firstWhere(
        (CallSessionStatus status) => status.name == value?.toString(),
        orElse: () => CallSessionStatus.failed,
      );
}

class AgoraCredentialsModel {
  const AgoraCredentialsModel({
    required this.appId,
    required this.channelName,
    required this.uid,
    required this.token,
    this.expiresAt,
  });

  final String appId;
  final String channelName;
  final int uid;
  final String token;
  final DateTime? expiresAt;

  factory AgoraCredentialsModel.fromJson(Map<String, dynamic> json) =>
      AgoraCredentialsModel(
        appId: (json['appId'] ?? '').toString(),
        channelName: (json['channelName'] ?? '').toString(),
        uid: int.tryParse((json['uid'] ?? '').toString()) ?? 0,
        token: (json['token'] ?? '').toString(),
        expiresAt: DateTime.tryParse((json['expiresAt'] ?? '').toString()),
      );
}

class CallSessionModel {
  const CallSessionModel({
    required this.id,
    required this.rideId,
    required this.status,
    this.callerId,
    this.receiverId,
    this.startedAt,
    this.connectedAt,
    this.endedAt,
    this.durationSeconds = 0,
    this.endReason,
    this.credentials,
  });

  final String id;
  final String rideId;
  final CallSessionStatus status;
  final String? callerId;
  final String? receiverId;
  final DateTime? startedAt;
  final DateTime? connectedAt;
  final DateTime? endedAt;
  final int durationSeconds;
  final String? endReason;
  final AgoraCredentialsModel? credentials;

  CallSessionModel copyWith({
    CallSessionStatus? status,
    DateTime? startedAt,
    DateTime? connectedAt,
    DateTime? endedAt,
    int? durationSeconds,
    String? endReason,
    AgoraCredentialsModel? credentials,
  }) =>
      CallSessionModel(
        id: id,
        rideId: rideId,
        status: status ?? this.status,
        callerId: callerId,
        receiverId: receiverId,
        startedAt: startedAt ?? this.startedAt,
        connectedAt: connectedAt ?? this.connectedAt,
        endedAt: endedAt ?? this.endedAt,
        durationSeconds: durationSeconds ?? this.durationSeconds,
        endReason: endReason ?? this.endReason,
        credentials: credentials ?? this.credentials,
      );

  CallSessionModel mergeRuntimeState(CallSessionModel latest) =>
      CallSessionModel(
        id: latest.id,
        rideId: latest.rideId,
        status: latest.status,
        callerId:
            latest.callerId?.isNotEmpty == true ? latest.callerId : callerId,
        receiverId: latest.receiverId?.isNotEmpty == true
            ? latest.receiverId
            : receiverId,
        startedAt: latest.startedAt ?? startedAt,
        connectedAt: latest.connectedAt ?? connectedAt,
        endedAt: latest.endedAt ?? endedAt,
        durationSeconds: latest.durationSeconds,
        endReason: latest.endReason ?? endReason,
        credentials: latest.credentials ?? credentials,
      );

  factory CallSessionModel.fromJson(Map<String, dynamic> json) {
    final dynamic credentialsJson = json['credentials'] ?? json['agora'];
    return CallSessionModel(
      id: (json['_id'] ?? json['id'] ?? json['callId'] ?? '').toString(),
      rideId:
          (json['rideId'] is Map ? json['rideId']['_id'] : json['rideId'] ?? '')
              .toString(),
      status: CallSessionStatus.fromValue(json['status']),
      callerId: (json['callerId'] ?? '').toString(),
      receiverId: (json['receiverId'] ?? '').toString(),
      startedAt: DateTime.tryParse((json['startedAt'] ?? '').toString()),
      connectedAt: DateTime.tryParse((json['connectedAt'] ?? '').toString()),
      endedAt: DateTime.tryParse((json['endedAt'] ?? '').toString()),
      durationSeconds:
          int.tryParse((json['durationSeconds'] ?? '0').toString()) ?? 0,
      endReason: json['endReason']?.toString(),
      credentials: credentialsJson is Map
          ? AgoraCredentialsModel.fromJson(
              Map<String, dynamic>.from(credentialsJson),
            )
          : null,
    );
  }
}
