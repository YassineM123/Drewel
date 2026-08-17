class PublicDriverProfile {
  final String id;
  final String firstName;
  final String lastName;
  final String fullName;
  final String profileImageUrl;
  final bool isVerified;
  final double? rating;
  final String availabilityStatus;
  final bool isOnline;
  final String bio;
  final int? experienceYears;
  final List<String> languages;
  final String city;
  final VehicleInfo vehicle;
  final List<String> badges;
  final ReviewsSummary reviewsSummary;
  final RankingInfo? ranking;

  PublicDriverProfile({
    required this.id,
    this.firstName = '',
    this.lastName = '',
    this.fullName = '',
    this.profileImageUrl = '',
    this.isVerified = false,
    this.rating,
    this.availabilityStatus = 'Offline',
    this.isOnline = false,
    this.bio = '',
    this.experienceYears,
    this.languages = const [],
    this.city = '',
    this.vehicle = const VehicleInfo(),
    this.badges = const [],
    this.reviewsSummary = const ReviewsSummary(),
    this.ranking,
  });

  factory PublicDriverProfile.fromJson(Map<String, dynamic> json) {
    return PublicDriverProfile(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      firstName: (json['firstName'] ?? '').toString(),
      lastName: (json['lastName'] ?? '').toString(),
      fullName: (json['fullName'] ?? '').toString(),
      profileImageUrl: (json['profileImageUrl'] ?? '').toString(),
      isVerified: json['isVerified'] == true,
      rating: _asDouble(json['rating']),
      availabilityStatus: (json['availabilityStatus'] ?? 'Offline').toString(),
      isOnline: json['isOnline'] == true,
      bio: (json['bio'] ?? '').toString(),
      experienceYears: json['experienceYears'] is num
          ? (json['experienceYears'] as num).toInt()
          : null,
      languages: (json['languages'] as List?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
      city: (json['city'] ?? '').toString(),
      vehicle: json['vehicle'] is Map
          ? VehicleInfo.fromJson(Map<String, dynamic>.from(json['vehicle']))
          : const VehicleInfo(),
      badges: (json['badges'] as List?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
      reviewsSummary: json['reviewsSummary'] is Map
          ? ReviewsSummary.fromJson(
              Map<String, dynamic>.from(json['reviewsSummary']))
          : const ReviewsSummary(),
      ranking: json['ranking'] is Map
          ? RankingInfo.fromJson(Map<String, dynamic>.from(json['ranking']))
          : null,
    );
  }

  static double? _asDouble(dynamic value) {
    if (value is num) return value.toDouble();
    return double.tryParse(value?.toString() ?? '');
  }
}

class VehicleInfo {
  final String type;
  final String model;
  final String registration;

  const VehicleInfo({
    this.type = '',
    this.model = '',
    this.registration = '',
  });

  factory VehicleInfo.fromJson(Map<String, dynamic> json) {
    return VehicleInfo(
      type: (json['type'] ?? '').toString(),
      model: (json['model'] ?? '').toString(),
      registration: (json['registration'] ?? '').toString(),
    );
  }

  String get displayName {
    if (model.isNotEmpty && type.isNotEmpty) return '$type · $model';
    if (model.isNotEmpty) return model;
    if (type.isNotEmpty) return type;
    return '';
  }
}

class ReviewsSummary {
  final double averageRating;
  final int totalReviews;
  final int completedTrips;
  final Map<String, int> distribution;

  const ReviewsSummary({
    this.averageRating = 0,
    this.totalReviews = 0,
    this.completedTrips = 0,
    this.distribution = const {},
  });

  factory ReviewsSummary.fromJson(Map<String, dynamic> json) {
    return ReviewsSummary(
      averageRating: _asDouble(json['averageRating']) ?? 0,
      totalReviews: json['totalReviews'] is num
          ? (json['totalReviews'] as num).toInt()
          : 0,
      completedTrips: json['completedTrips'] is num
          ? (json['completedTrips'] as num).toInt()
          : 0,
      distribution: (json['distribution'] as Map?)
              ?.map((k, v) => MapEntry(k.toString(), v is num ? v.toInt() : 0)) ??
          {},
    );
  }

  static double? _asDouble(dynamic value) {
    if (value is num) return value.toDouble();
    return double.tryParse(value?.toString() ?? '');
  }
}

class RankingInfo {
  final int? position;
  final double score;
  final double weightedRating;

  const RankingInfo({
    this.position,
    this.score = 0,
    this.weightedRating = 0,
  });

  factory RankingInfo.fromJson(Map<String, dynamic> json) {
    return RankingInfo(
      position: json['position'] is num ? (json['position'] as num).toInt() : null,
      score: _asDouble(json['score']) ?? 0,
      weightedRating: _asDouble(json['weightedRating']) ?? 0,
    );
  }

  static double? _asDouble(dynamic value) {
    if (value is num) return value.toDouble();
    return double.tryParse(value?.toString() ?? '');
  }
}

class DriverReview {
  final String id;
  final int rating;
  final String comment;
  final DateTime? submittedAt;
  final ReviewerInfo reviewer;

  DriverReview({
    required this.id,
    this.rating = 0,
    this.comment = '',
    this.submittedAt,
    this.reviewer = const ReviewerInfo(),
  });

  factory DriverReview.fromJson(Map<String, dynamic> json) {
    return DriverReview(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      rating: json['rating'] is num ? (json['rating'] as num).toInt() : 0,
      comment: (json['comment'] ?? '').toString(),
      submittedAt: DateTime.tryParse(json['submittedAt']?.toString() ?? ''),
      reviewer: json['reviewer'] is Map
          ? ReviewerInfo.fromJson(Map<String, dynamic>.from(json['reviewer']))
          : const ReviewerInfo(),
    );
  }
}

class ReviewerInfo {
  final String firstName;
  final String profilePicture;

  const ReviewerInfo({
    this.firstName = 'Passenger',
    this.profilePicture = '',
  });

  factory ReviewerInfo.fromJson(Map<String, dynamic> json) {
    return ReviewerInfo(
      firstName: (json['firstName'] ?? 'Passenger').toString(),
      profilePicture: (json['profilePicture'] ?? '').toString(),
    );
  }
}

class DriverRankingItem {
  final int position;
  final DriverRankingDriver driver;
  final DriverRankingStats ranking;

  DriverRankingItem({
    this.position = 0,
    required this.driver,
    required this.ranking,
  });

  factory DriverRankingItem.fromJson(Map<String, dynamic> json) {
    return DriverRankingItem(
      position: json['position'] is num ? (json['position'] as num).toInt() : 0,
      driver: json['driver'] is Map
          ? DriverRankingDriver.fromJson(Map<String, dynamic>.from(json['driver']))
          : const DriverRankingDriver(),
      ranking: json['ranking'] is Map
          ? DriverRankingStats.fromJson(Map<String, dynamic>.from(json['ranking']))
          : const DriverRankingStats(),
    );
  }
}

class DriverRankingDriver {
  final String id;
  final String firstName;
  final String lastName;
  final String fullName;
  final String profileImageUrl;
  final String vehicleType;
  final String vehicleModel;
  final double? rating;
  final bool isVerified;

  const DriverRankingDriver({
    this.id = '',
    this.firstName = '',
    this.lastName = '',
    this.fullName = '',
    this.profileImageUrl = '',
    this.vehicleType = '',
    this.vehicleModel = '',
    this.rating,
    this.isVerified = false,
  });

  factory DriverRankingDriver.fromJson(Map<String, dynamic> json) {
    return DriverRankingDriver(
      id: (json['id'] ?? '').toString(),
      firstName: (json['firstName'] ?? '').toString(),
      lastName: (json['lastName'] ?? '').toString(),
      fullName: (json['fullName'] ?? '').toString(),
      profileImageUrl: (json['profileImageUrl'] ?? '').toString(),
      vehicleType: (json['vehicleType'] ?? '').toString(),
      vehicleModel: (json['vehicleModel'] ?? '').toString(),
      rating: _asDouble(json['rating']),
      isVerified: json['isVerified'] == true,
    );
  }

  static double? _asDouble(dynamic value) {
    if (value is num) return value.toDouble();
    return double.tryParse(value?.toString() ?? '');
  }
}

class DriverRankingStats {
  final double weightedRating;
  final int completedTrips;
  final int totalReviews;
  final double completionRate;
  final double rankingScore;

  const DriverRankingStats({
    this.weightedRating = 0,
    this.completedTrips = 0,
    this.totalReviews = 0,
    this.completionRate = 0,
    this.rankingScore = 0,
  });

  factory DriverRankingStats.fromJson(Map<String, dynamic> json) {
    return DriverRankingStats(
      weightedRating: _asDouble(json['weightedRating']) ?? 0,
      completedTrips: json['completedTrips'] is num
          ? (json['completedTrips'] as num).toInt()
          : 0,
      totalReviews: json['totalReviews'] is num
          ? (json['totalReviews'] as num).toInt()
          : 0,
      completionRate: _asDouble(json['completionRate']) ?? 0,
      rankingScore: _asDouble(json['rankingScore']) ?? 0,
    );
  }

  static double? _asDouble(dynamic value) {
    if (value is num) return value.toDouble();
    return double.tryParse(value?.toString() ?? '');
  }
}
