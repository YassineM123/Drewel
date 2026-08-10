class SimpleResponseModel {
  bool? success;
  String? message;
  String? code;
  DriverPresenceModel? presence;

  SimpleResponseModel({
    this.success,
    this.message,
    this.code,
    this.presence,
  });

  SimpleResponseModel.fromJson(Map<String, dynamic> json) {
    success = json['success'];
    message = json['message'];
    code = json['code'];
    final dynamic presenceJson = json['presence'];
    if (presenceJson is Map) {
      presence = DriverPresenceModel.fromJson(
        Map<String, dynamic>.from(presenceJson),
      );
    }
  }

  Map<String, dynamic> toJson() {
    final Map<String, dynamic> data = <String, dynamic>{};
    data['success'] = success;
    data['message'] = message;
    data['code'] = code;
    if (presence != null) data['presence'] = presence!.toJson();
    return data;
  }
}

class DriverPresenceModel {
  DriverPresenceModel({
    this.status,
    this.sessionId,
    this.leaseExpiresAt,
    this.lastHeartbeatAt,
    this.version,
    this.heartbeatIntervalMs,
    this.timeoutMs,
  });

  String? status;
  String? sessionId;
  DateTime? leaseExpiresAt;
  DateTime? lastHeartbeatAt;
  int? version;
  int? heartbeatIntervalMs;
  int? timeoutMs;

  factory DriverPresenceModel.fromJson(Map<String, dynamic> json) =>
      DriverPresenceModel(
        status: json['status']?.toString(),
        sessionId: json['sessionId']?.toString(),
        leaseExpiresAt: DateTime.tryParse('${json['leaseExpiresAt'] ?? ''}'),
        lastHeartbeatAt: DateTime.tryParse('${json['lastHeartbeatAt'] ?? ''}'),
        version: _asInt(json['version']),
        heartbeatIntervalMs: _asInt(json['heartbeatIntervalMs']),
        timeoutMs: _asInt(json['timeoutMs']),
      );

  Map<String, dynamic> toJson() => <String, dynamic>{
        'status': status,
        'sessionId': sessionId,
        'leaseExpiresAt': leaseExpiresAt?.toUtc().toIso8601String(),
        'lastHeartbeatAt': lastHeartbeatAt?.toUtc().toIso8601String(),
        'version': version,
        'heartbeatIntervalMs': heartbeatIntervalMs,
        'timeoutMs': timeoutMs,
      };

  static int? _asInt(dynamic value) {
    if (value is int) return value;
    return int.tryParse('$value');
  }
}
