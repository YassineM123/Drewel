class RideParticipantModel {
  const RideParticipantModel({
    required this.id,
    required this.firstName,
    required this.role,
    this.profileImageUrl,
    this.vehicleDescription,
  });

  final String id;
  final String firstName;
  final String role;
  final String? profileImageUrl;
  final String? vehicleDescription;

  factory RideParticipantModel.fromJson(Map<String, dynamic> json) {
    final String fullName = (json['fullName'] ?? json['name'] ?? '').toString();
    return RideParticipantModel(
      id: (json['_id'] ?? json['id'] ?? '').toString(),
      firstName: (json['firstName'] ??
              json['first_name'] ??
              (fullName.trim().isEmpty ? '' : fullName.trim().split(' ').first))
          .toString(),
      role: (json['role'] ?? '').toString(),
      profileImageUrl:
          (json['profileImageUrl'] ?? json['profile_image_url'])?.toString(),
      vehicleDescription:
          (json['vehicleDescription'] ?? json['vehicle'])?.toString(),
    );
  }
}

class ActiveRideModel {
  const ActiveRideModel({
    required this.id,
    required this.status,
    required this.contactAllowed,
    this.reference,
    this.contactExpiresAt,
    this.passenger,
    this.driver,
  });

  static const Set<String> communicationStatuses = <String>{
    'accepted',
    'driver_arriving',
    'driver_arrived',
    'in_progress',
    'completed',
  };

  final String id;
  final String status;
  final bool contactAllowed;
  final String? reference;
  final DateTime? contactExpiresAt;
  final RideParticipantModel? passenger;
  final RideParticipantModel? driver;

  bool get hasBackendRideId => id.trim().isNotEmpty;

  bool get canCommunicate {
    final DateTime? expiry = contactExpiresAt;
    return hasBackendRideId &&
        contactAllowed &&
        communicationStatuses.contains(status) &&
        (expiry == null || expiry.isAfter(DateTime.now().toUtc()));
  }

  RideParticipantModel? counterpartFor(String role) =>
      role == 'driver' ? passenger : driver;

  factory ActiveRideModel.fromJson(Map<String, dynamic> json) {
    final dynamic passengerJson = json['passenger'] ?? json['user'];
    final dynamic driverJson = json['driver'];
    return ActiveRideModel(
      id: (json['_id'] ?? json['id'] ?? json['rideId'] ?? '').toString(),
      status: (json['status'] ?? '').toString().toLowerCase(),
      contactAllowed: json['contactAllowed'] == true,
      reference: (json['reference'] ?? json['rideReference'])?.toString(),
      contactExpiresAt: DateTime.tryParse(
        (json['contactExpiresAt'] ?? '').toString(),
      )?.toUtc(),
      passenger: passengerJson is Map
          ? RideParticipantModel.fromJson(
              Map<String, dynamic>.from(passengerJson),
            )
          : null,
      driver: driverJson is Map
          ? RideParticipantModel.fromJson(Map<String, dynamic>.from(driverJson))
          : null,
    );
  }
}
