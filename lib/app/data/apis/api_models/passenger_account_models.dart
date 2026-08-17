import 'active_ride_model.dart';

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
    required this.accountUpdates,
    required this.sounds,
    required this.vibration,
  });

  final bool rideUpdates;
  final bool messages;
  final bool accountUpdates;
  final bool sounds;
  final bool vibration;

  factory NotificationPreferenceModel.fromJson(Map<String, dynamic> json) =>
      NotificationPreferenceModel(
        rideUpdates: json['rideUpdates'] != false,
        messages: json['messages'] != false,
        accountUpdates: json['accountUpdates'] != false,
        sounds: json['sounds'] != false,
        vibration: json['vibration'] != false,
      );

  Map<String, dynamic> toJson() => <String, dynamic>{
        'rideUpdates': rideUpdates,
        'messages': messages,
        'accountUpdates': accountUpdates,
        'sounds': sounds,
        'vibration': vibration,
      };

  NotificationPreferenceModel copyWith({
    bool? rideUpdates,
    bool? messages,
    bool? accountUpdates,
    bool? sounds,
    bool? vibration,
  }) =>
      NotificationPreferenceModel(
        rideUpdates: rideUpdates ?? this.rideUpdates,
        messages: messages ?? this.messages,
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

  factory LegalContentModel.fallback(String type) {
    final bool privacy = type.trim().toLowerCase() == 'privacy';
    return LegalContentModel(
      title: privacy ? 'Privacy' : 'Terms & Conditions',
      lastUpdated: null,
      body: privacy
          ? 'Drewel uses account, contact, location, ride, communication, and device data to provide the transport marketplace safely.\n\nLocation data supports pickup, destination, driver discovery, route, safety, and support workflows. Secure ride chat is used for Drewel ride coordination and support.\n\nDrewel limits access to personal data to authorized operations, support, security, and administration workflows. Contact support if you need help with account data or privacy questions.'
          : 'By using Drewel, passengers and drivers agree to use the marketplace honestly, safely, and only for lawful transport coordination.\n\nPassengers send ride requests, and drivers send official trip offers through Drewel. Prices, ride lifecycle changes, points, restrictions, and sensitive actions are controlled by the server.\n\nDrewel may restrict accounts, cancel unsafe activity, preserve ride and communication evidence, and require driver profile or document review when needed for marketplace safety.',
    );
  }
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
