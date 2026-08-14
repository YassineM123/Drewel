import 'active_ride_model.dart';
import 'call_session_model.dart';

class PassengerProfileModel {
  const PassengerProfileModel({
    required this.id,
    required this.fullName,
    required this.countryCode,
    required this.phone,
    required this.email,
    required this.profileImageUrl,
    required this.isVerified,
  });

  final String id;
  final String fullName;
  final String countryCode;
  final String phone;
  final String email;
  final String profileImageUrl;
  final bool isVerified;

  factory PassengerProfileModel.fromJson(Map<String, dynamic> json) =>
      PassengerProfileModel(
        id: '${json['_id'] ?? json['id'] ?? ''}',
        fullName: '${json['fullName'] ?? ''}',
        countryCode: '${json['countryCode'] ?? ''}',
        phone: '${json['phone'] ?? ''}',
        email: '${json['email'] ?? ''}',
        profileImageUrl:
            '${json['profilePicture'] ?? json['profileImageUrl'] ?? ''}',
        isVerified: json['isVerified'] == true,
      );

  Map<String, dynamic> toJson() => <String, dynamic>{
        '_id': id,
        'fullName': fullName,
        'countryCode': countryCode,
        'phone': phone,
        'email': email,
        'profilePicture': profileImageUrl,
        'isVerified': isVerified,
      };
}

class SavedPlaceModel {
  const SavedPlaceModel({
    required this.id,
    required this.type,
    required this.name,
    required this.address,
    required this.lat,
    required this.long,
    required this.category,
  });

  final String id;
  final String type;
  final String name;
  final String address;
  final double lat;
  final double long;
  final String category;

  factory SavedPlaceModel.fromJson(Map<String, dynamic> json) =>
      SavedPlaceModel(
        id: '${json['id'] ?? json['_id'] ?? ''}',
        type: '${json['type'] ?? 'favorite'}',
        name: '${json['name'] ?? ''}',
        address: '${json['address'] ?? ''}',
        lat: (json['lat'] as num?)?.toDouble() ?? 0,
        long: (json['long'] as num?)?.toDouble() ?? 0,
        category: '${json['category'] ?? ''}',
      );
}

class NotificationPreferenceModel {
  const NotificationPreferenceModel({
    required this.rideUpdates,
    required this.messages,
    required this.calls,
    required this.accountUpdates,
    required this.sounds,
    required this.vibration,
  });

  final bool rideUpdates;
  final bool messages;
  final bool calls;
  final bool accountUpdates;
  final bool sounds;
  final bool vibration;

  factory NotificationPreferenceModel.fromJson(Map<String, dynamic> json) =>
      NotificationPreferenceModel(
        rideUpdates: json['rideUpdates'] != false,
        messages: json['messages'] != false,
        calls: json['calls'] != false,
        accountUpdates: json['accountUpdates'] != false,
        sounds: json['sounds'] != false,
        vibration: json['vibration'] != false,
      );

  Map<String, dynamic> toJson() => <String, dynamic>{
        'rideUpdates': rideUpdates,
        'messages': messages,
        'calls': calls,
        'accountUpdates': accountUpdates,
        'sounds': sounds,
        'vibration': vibration,
      };

  NotificationPreferenceModel copyWith({
    bool? rideUpdates,
    bool? messages,
    bool? calls,
    bool? accountUpdates,
    bool? sounds,
    bool? vibration,
  }) =>
      NotificationPreferenceModel(
        rideUpdates: rideUpdates ?? this.rideUpdates,
        messages: messages ?? this.messages,
        calls: calls ?? this.calls,
        accountUpdates: accountUpdates ?? this.accountUpdates,
        sounds: sounds ?? this.sounds,
        vibration: vibration ?? this.vibration,
      );
}

class PassengerPreferenceModel {
  const PassengerPreferenceModel({
    required this.language,
    required this.notifications,
  });

  final String language;
  final NotificationPreferenceModel notifications;

  factory PassengerPreferenceModel.fromJson(Map<String, dynamic> json) =>
      PassengerPreferenceModel(
        language: '${json['language'] ?? 'en'}',
        notifications: NotificationPreferenceModel.fromJson(
          Map<String, dynamic>.from(
              json['notifications'] as Map? ?? const <String, dynamic>{}),
        ),
      );
}

class PassengerCallModel {
  const PassengerCallModel({
    required this.call,
    required this.direction,
    required this.counterpartName,
    required this.rideReference,
  });

  final CallSessionModel call;
  final String direction;
  final String counterpartName;
  final String rideReference;

  factory PassengerCallModel.fromJson(Map<String, dynamic> json) =>
      PassengerCallModel(
        call: CallSessionModel.fromJson(json),
        direction: '${json['direction'] ?? ''}',
        counterpartName:
            '${(json['counterpart'] as Map?)?['displayName'] ?? 'Driver'}',
        rideReference: '${json['rideReference'] ?? ''}',
      );
}

class LegalContentModel {
  const LegalContentModel({
    required this.title,
    required this.body,
    this.lastUpdated,
  });

  final String title;
  final String body;
  final String? lastUpdated;

  factory LegalContentModel.fromJson(Map<String, dynamic> json) =>
      LegalContentModel(
        title: '${json['title'] ?? ''}',
        body: '${json['body'] ?? ''}',
        lastUpdated: json['lastUpdated']?.toString(),
      );
}

class RideHistoryFilter {
  static const String all = 'all';
  static const String active = 'active';
  static const String completed = 'completed';
  static const String cancelled = 'cancelled';

  static bool matches(ActiveRideModel ride, String filter) {
    if (filter == all) return true;
    if (filter == active) return !ride.rideStatus.isTerminal;
    if (filter == completed) return ride.status == 'completed';
    if (filter == cancelled) return ride.status.startsWith('cancelled');
    return true;
  }
}
