enum RideStatus {
  contacting,
  offerPending,
  confirmed,
  driverOnTheWay,
  driverArrived,
  pickupConfirmed,
  inProgress,
  completed,
  cancelledByUser,
  cancelledByDriver,
  cancelledByAdmin,
  disputed,
  unknown;

  static RideStatus fromValue(Object? value) {
    return switch (value?.toString().trim().toLowerCase()) {
      'contacting' || 'requested' => RideStatus.contacting,
      'offer_pending' => RideStatus.offerPending,
      'confirmed' || 'accepted' => RideStatus.confirmed,
      'driver_on_the_way' || 'driver_arriving' => RideStatus.driverOnTheWay,
      'driver_arrived' => RideStatus.driverArrived,
      'pickup_confirmed' => RideStatus.pickupConfirmed,
      'in_progress' => RideStatus.inProgress,
      'completed' => RideStatus.completed,
      'cancelled_by_user' || 'cancelled' => RideStatus.cancelledByUser,
      'cancelled_by_driver' => RideStatus.cancelledByDriver,
      'cancelled_by_admin' => RideStatus.cancelledByAdmin,
      'disputed' => RideStatus.disputed,
      _ => RideStatus.unknown,
    };
  }

  String get wireValue => switch (this) {
        RideStatus.offerPending => 'offer_pending',
        RideStatus.driverOnTheWay => 'driver_on_the_way',
        RideStatus.driverArrived => 'driver_arrived',
        RideStatus.pickupConfirmed => 'pickup_confirmed',
        RideStatus.inProgress => 'in_progress',
        RideStatus.cancelledByUser => 'cancelled_by_user',
        RideStatus.cancelledByDriver => 'cancelled_by_driver',
        RideStatus.cancelledByAdmin => 'cancelled_by_admin',
        _ => name,
      };

  bool get isTerminal => switch (this) {
        RideStatus.completed ||
        RideStatus.cancelledByUser ||
        RideStatus.cancelledByDriver ||
        RideStatus.cancelledByAdmin =>
          true,
        _ => false,
      };

  bool get isActive => switch (this) {
        RideStatus.confirmed ||
        RideStatus.driverOnTheWay ||
        RideStatus.driverArrived ||
        RideStatus.pickupConfirmed ||
        RideStatus.inProgress ||
        RideStatus.disputed =>
          true,
        _ => false,
      };

  bool get acceptsTripOfferFromRequest => this == RideStatus.contacting;

  bool get canNormallyCancel => switch (this) {
        RideStatus.offerPending ||
        RideStatus.confirmed ||
        RideStatus.driverOnTheWay ||
        RideStatus.driverArrived ||
        RideStatus.pickupConfirmed =>
          true,
        _ => false,
      };
}

class RideCoordinateModel {
  const RideCoordinateModel({
    required this.latitude,
    required this.longitude,
    this.address = '',
    this.accuracy,
    this.heading,
    this.speed,
    this.recordedAt,
  });

  final double latitude;
  final double longitude;
  final String address;
  final double? accuracy;
  final double? heading;
  final double? speed;
  final DateTime? recordedAt;

  bool get isValid =>
      latitude.isFinite &&
      longitude.isFinite &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'lat': latitude,
        'long': longitude,
        if (address.trim().isNotEmpty) 'address': address.trim(),
        if (accuracy != null) 'accuracy': accuracy,
        if (heading != null) 'heading': heading,
        if (speed != null) 'speed': speed,
        if (recordedAt != null)
          'recordedAt': recordedAt!.toUtc().toIso8601String(),
      };

  factory RideCoordinateModel.fromJson(Map<String, dynamic> json) {
    double? number(Object? value) =>
        value is num ? value.toDouble() : double.tryParse('$value');
    return RideCoordinateModel(
      latitude: number(json['lat'] ?? json['latitude']) ?? double.nan,
      longitude: number(json['long'] ?? json['lng'] ?? json['longitude']) ??
          double.nan,
      address: (json['address'] ?? '').toString(),
      accuracy: number(json['accuracy']),
      heading: number(json['heading']),
      speed: number(json['speed']),
      recordedAt: DateTime.tryParse(
              (json['recordedAt'] ?? json['timestamp'] ?? '').toString())
          ?.toLocal(),
    );
  }
}

class RideNavigationStepModel {
  const RideNavigationStepModel({
    required this.instruction,
    this.maneuver = '',
    this.distanceMeters = 0,
    this.durationSeconds = 0,
  });

  final String instruction;
  final String maneuver;
  final int distanceMeters;
  final int durationSeconds;

  factory RideNavigationStepModel.fromJson(Map<String, dynamic> json) =>
      RideNavigationStepModel(
        instruction: (json['instruction'] ??
                json['navigationInstruction']?['instructions'] ??
                '')
            .toString(),
        maneuver: (json['maneuver'] ??
                json['navigationInstruction']?['maneuver'] ??
                '')
            .toString(),
        distanceMeters: (json['distanceMeters'] as num?)?.toInt() ?? 0,
        durationSeconds:
            _durationSeconds(json['durationSeconds'] ?? json['duration']),
      );
}

class RideRouteModel {
  const RideRouteModel({
    required this.phase,
    required this.encodedPolyline,
    required this.distanceMeters,
    required this.durationSeconds,
    required this.steps,
    this.updatedAt,
  });

  final String phase;
  final String encodedPolyline;
  final int distanceMeters;
  final int durationSeconds;
  final List<RideNavigationStepModel> steps;
  final DateTime? updatedAt;

  String get distanceLabel => distanceMeters >= 1000
      ? '${(distanceMeters / 1000).toStringAsFixed(1)} km'
      : '$distanceMeters m';

  String get etaLabel {
    final int minutes = (durationSeconds / 60).ceil();
    return minutes < 60
        ? '$minutes min'
        : '${minutes ~/ 60} h ${minutes % 60} min';
  }

  factory RideRouteModel.fromJson(Map<String, dynamic> json) {
    final dynamic rawSteps = json['steps'] ?? json['navigationSteps'];
    return RideRouteModel(
      phase: (json['phase'] ?? '').toString(),
      encodedPolyline: (json['encodedPolyline'] ??
              json['polyline']?['encodedPolyline'] ??
              '')
          .toString(),
      distanceMeters: (json['distanceMeters'] as num?)?.toInt() ?? 0,
      durationSeconds:
          _durationSeconds(json['durationSeconds'] ?? json['duration']),
      steps: rawSteps is List
          ? rawSteps
              .whereType<Map>()
              .map((Map<dynamic, dynamic> item) =>
                  RideNavigationStepModel.fromJson(
                    Map<String, dynamic>.from(item),
                  ))
              .toList(growable: false)
          : const <RideNavigationStepModel>[],
      updatedAt: DateTime.tryParse(
              (json['updatedAt'] ?? json['calculatedAt'] ?? '').toString())
          ?.toLocal(),
    );
  }
}

int _durationSeconds(Object? value) {
  if (value is num) return value.toInt();
  final String text = (value ?? '').toString();
  if (text.endsWith('s')) {
    return double.tryParse(text.substring(0, text.length - 1))?.round() ?? 0;
  }
  return int.tryParse(text) ?? 0;
}

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

class RideReviewModel {
  const RideReviewModel({
    required this.rating,
    this.comment = '',
    this.submittedAt,
  });

  final int rating;
  final String comment;
  final DateTime? submittedAt;

  factory RideReviewModel.fromJson(Map<String, dynamic> json) =>
      RideReviewModel(
        rating: (json['rating'] as num?)?.toInt() ?? 0,
        comment: (json['comment'] ?? '').toString(),
        submittedAt: DateTime.tryParse((json['submittedAt'] ?? '').toString())
            ?.toLocal(),
      );
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
    this.pickup,
    this.destination,
    this.lastDriverLocation,
    this.route,
    this.stateVersion = 0,
    this.pickupPin,
    this.agreedPrice,
    this.vehicleType,
    this.passengerReview,
    this.driverReview,
    this.updatedAt,
  });

  final String id;
  final String status;
  final bool contactAllowed;
  final String? reference;
  final DateTime? contactExpiresAt;
  final RideParticipantModel? passenger;
  final RideParticipantModel? driver;
  final RideCoordinateModel? pickup;
  final RideCoordinateModel? destination;
  final RideCoordinateModel? lastDriverLocation;
  final RideRouteModel? route;
  final int stateVersion;
  final String? pickupPin;
  final double? agreedPrice;
  final String? vehicleType;
  final RideReviewModel? passengerReview;
  final RideReviewModel? driverReview;
  final DateTime? updatedAt;

  RideStatus get rideStatus => RideStatus.fromValue(status);
  bool get hasBackendRideId => id.trim().isNotEmpty;
  bool get isRecoverable => hasBackendRideId && !rideStatus.isTerminal;

  bool get canCommunicate => canCommunicateAs('user');

  /// Drivers can always reach a rider they were matched with once the server
  /// authorizes the ride, even after it is completed; only the passenger side
  /// observes the terminal-status/expiry grace-period cutoff.
  bool canCommunicateAs(String role) {
    if (!hasBackendRideId) return false;
    final String normalizedRole = role.trim().toLowerCase();
    if (rideStatus == RideStatus.completed) {
      if (normalizedRole == 'driver') return contactAllowed;
      final DateTime? expiresAt = contactExpiresAt;
      return contactAllowed &&
          expiresAt != null &&
          expiresAt.isAfter(DateTime.now().toUtc());
    }
    return contactAllowed && !rideStatus.isTerminal;
  }

  RideParticipantModel? counterpartFor(String role) =>
      role == 'driver' ? passenger : driver;

  ActiveRideModel copyWith({
    RideCoordinateModel? lastDriverLocation,
    RideRouteModel? route,
  }) =>
      ActiveRideModel(
        id: id,
        status: status,
        contactAllowed: contactAllowed,
        reference: reference,
        contactExpiresAt: contactExpiresAt,
        passenger: passenger,
        driver: driver,
        pickup: pickup,
        destination: destination,
        lastDriverLocation: lastDriverLocation ?? this.lastDriverLocation,
        route: route ?? this.route,
        stateVersion: stateVersion,
        pickupPin: pickupPin,
        agreedPrice: agreedPrice,
        vehicleType: vehicleType,
        passengerReview: passengerReview,
        driverReview: driverReview,
        updatedAt: updatedAt,
      );

  factory ActiveRideModel.fromJson(Map<String, dynamic> json) {
    final dynamic passengerJson = json['passenger'] ?? json['user'];
    final dynamic driverJson = json['driver'];
    final Map<String, dynamic>? pickup = _map(json['pickup']);
    final Map<String, dynamic>? destination = _map(json['destination']);
    final Map<String, dynamic>? driverLocation =
        _map(json['lastDriverLocation'] ?? json['driverLocation']);
    final Map<String, dynamic>? route = _map(json['route']);
    final Map<String, dynamic>? reviews = _map(json['reviews']);
    final Map<String, dynamic>? passengerReview =
        _map(reviews?['passenger'] ?? json['passengerReview']);
    final Map<String, dynamic>? driverReview =
        _map(reviews?['driver'] ?? json['driverReview']);
    return ActiveRideModel(
      id: (json['_id'] ?? json['id'] ?? json['rideId'] ?? '').toString(),
      status: (json['status'] ?? '').toString().toLowerCase(),
      contactAllowed: json['contactAllowed'] == true,
      reference: (json['reference'] ?? json['rideReference'])?.toString(),
      contactExpiresAt: DateTime.tryParse(
              (json['contactExpiresAt'] ?? json['contactEndsAt'] ?? '')
                  .toString())
          ?.toUtc(),
      passenger: passengerJson is Map
          ? RideParticipantModel.fromJson(
              Map<String, dynamic>.from(passengerJson))
          : null,
      driver: driverJson is Map
          ? RideParticipantModel.fromJson(Map<String, dynamic>.from(driverJson))
          : null,
      pickup: pickup == null ? null : RideCoordinateModel.fromJson(pickup),
      destination: destination == null
          ? null
          : RideCoordinateModel.fromJson(destination),
      lastDriverLocation: driverLocation == null
          ? null
          : RideCoordinateModel.fromJson(driverLocation),
      route: route == null ? null : RideRouteModel.fromJson(route),
      stateVersion: (json['stateVersion'] as num?)?.toInt() ?? 0,
      pickupPin: (json['pickupPin'] ?? json['pickupCode'])?.toString(),
      agreedPrice: (json['agreedPrice'] as num?)?.toDouble(),
      vehicleType: json['vehicleType']?.toString(),
      passengerReview: passengerReview == null
          ? null
          : RideReviewModel.fromJson(passengerReview),
      driverReview:
          driverReview == null ? null : RideReviewModel.fromJson(driverReview),
      updatedAt:
          DateTime.tryParse((json['updatedAt'] ?? '').toString())?.toLocal(),
    );
  }
}

Map<String, dynamic>? _map(Object? value) =>
    value is Map ? Map<String, dynamic>.from(value) : null;
