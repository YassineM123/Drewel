import '../../../../common/gps_fix.dart';
import '../../../../common/vehicle_assets.dart';

class DriverListModel {
  bool? success;
  String? code;
  String? message;
  List<Drivers>? drivers;

  DriverListModel({this.success, this.code, this.message, this.drivers});

  DriverListModel.fromJson(Map<String, dynamic> json) {
    success = json['success'];
    code = json['code']?.toString();
    message = json['message'];
    if (json['drivers'] != null) {
      drivers = <Drivers>[];
      json['drivers'].forEach((v) {
        drivers!.add(Drivers.fromJson(v));
      });
    }
  }

  Map<String, dynamic> toJson() {
    final Map<String, dynamic> data = <String, dynamic>{};
    data['success'] = success;
    data['code'] = code;
    data['message'] = message;
    if (drivers != null) {
      data['drivers'] = drivers!.map((v) => v.toJson()).toList();
    }
    return data;
  }
}

class Drivers {
  String? sId;
  bool? isVerified;
  int? iV;
  String? address;
  String? fullName;
  String? carLicenseUrl;
  String? drivingLicenseUrl;
  String? idProofUrl;
  String? licenseCompany;
  String? passportCopyUrl;
  String? updatedAt;
  String? profileImageUrl;
  String? city;
  String? currentServiceArea;
  DateTime? locationUpdatedAt;
  bool? isOnline;
  var latitude;
  var longitude;
  double? heading;
  double? speed;
  String? vehicleType;
  String? vehicleTypeKey;
  String? vehicleModel;
  String? registrationNumber;
  bool registrationVisible = false;
  String availabilityStatus = 'offline';
  bool isAvailable = false;
  double? rating;
  double? distanceKm;
  double? priceEstimate;
  String? currency;
  var lat;
  var long;
  String? createdAt;

  Drivers(
      {this.sId,
      this.isVerified,
      this.iV,
      this.address,
      this.fullName,
      this.carLicenseUrl,
      this.drivingLicenseUrl,
      this.idProofUrl,
      this.licenseCompany,
      this.passportCopyUrl,
      this.updatedAt,
      this.profileImageUrl,
      this.city,
      this.currentServiceArea,
      this.locationUpdatedAt,
      this.isOnline,
      this.latitude,
      this.longitude,
      this.heading,
      this.speed,
      this.vehicleType,
      this.vehicleTypeKey,
      this.vehicleModel,
      this.registrationNumber,
      this.registrationVisible = false,
      this.availabilityStatus = 'offline',
      this.isAvailable = false,
      this.rating,
      this.distanceKm,
      this.priceEstimate,
      this.currency,
      this.lat,
      this.long,
      this.createdAt});

  Drivers.fromJson(Map<String, dynamic> json) {
    sId = (json['_id'] ?? json['driverId'] ?? json['id'])?.toString();
    isVerified = json['isVerified'];
    iV = json['__v'];
    address = json['address'];
    fullName = (json['fullName'] ??
            json['displayName'] ??
            json['firstName'] ??
            json['first_name'])
        ?.toString();
    carLicenseUrl = json['carLicenseUrl'];
    drivingLicenseUrl = json['drivingLicenseUrl'];
    idProofUrl = json['idProofUrl'];
    licenseCompany = json['licenseCompany'];
    passportCopyUrl = json['passportCopyUrl'];
    updatedAt = json['updatedAt'];
    profileImageUrl = json['profileImageUrl'];
    city = json['city'];
    currentServiceArea = (json['currentServiceArea'] ??
            json['serviceArea'] ??
            json['locationCity'])
        ?.toString();
    locationUpdatedAt = _asDateTime(
      json['locationUpdatedAt'] ?? json['locationTimestamp'],
    );
    final String rawStatus =
        (json['availabilityStatus'] ?? json['status'] ?? '').toString();
    isOnline = json['isOnline'] == true ||
        rawStatus.toLowerCase() == 'online' ||
        rawStatus.toLowerCase() == 'busy';
    latitude = json['latitude'];
    longitude = json['longitude'];
    heading = _asDouble(json['heading']);
    speed = _asDouble(json['speed']);
    vehicleType = json['vehicleType'];
    vehicleTypeKey = (json['vehicleTypeKey'] ??
            json['vehicle_type_key'] ??
            canonicalVehicleTypeKey(vehicleType))
        ?.toString();
    vehicleModel =
        (json['vehicleModel'] ?? json['vehicle']?['model'])?.toString();
    registrationNumber = (json['registrationNumber'] ??
            json['registration'] ??
            json['vehicle']?['registrationNumber'] ??
            json['vehicle']?['plate'])
        ?.toString();
    registrationVisible = json['registrationVisible'] == true ||
        json['showRegistration'] == true ||
        json['registration'] != null;
    availabilityStatus = _normalizeAvailability(
      rawStatus,
      isOnline: isOnline == true,
      isAvailable: json['isAvailable'] != false,
    );
    isAvailable = json['isAvailable'] == true ||
        json['available'] == true ||
        availabilityStatus == 'online';
    rating = _asDouble(json['rating'] ?? json['averageRating']);
    distanceKm = _asDouble(json['distanceKm'] ?? json['distance']);
    priceEstimate = _asDouble(json['priceEstimate'] ?? json['estimatedPrice']);
    currency = json['currency']?.toString();
    lat = json['lat'];
    long = json['long'];
    createdAt = json['createdAt'];
  }

  Map<String, dynamic> toJson() {
    final Map<String, dynamic> data = <String, dynamic>{};
    data['_id'] = sId;
    data['isVerified'] = isVerified;
    data['__v'] = iV;
    data['address'] = address;
    data['fullName'] = fullName;
    data['carLicenseUrl'] = carLicenseUrl;
    data['drivingLicenseUrl'] = drivingLicenseUrl;
    data['idProofUrl'] = idProofUrl;
    data['licenseCompany'] = licenseCompany;
    data['passportCopyUrl'] = passportCopyUrl;
    data['updatedAt'] = updatedAt;
    data['profileImageUrl'] = profileImageUrl;
    data['city'] = city;
    data['currentServiceArea'] = currentServiceArea;
    data['locationUpdatedAt'] = locationUpdatedAt?.toUtc().toIso8601String();
    data['isOnline'] = isOnline;
    data['latitude'] = latitude;
    data['longitude'] = longitude;
    data['heading'] = heading;
    data['speed'] = speed;
    data['vehicleType'] = vehicleType;
    data['vehicleTypeKey'] = vehicleTypeKey;
    data['vehicleModel'] = vehicleModel;
    if (registrationVisible) {
      data['registrationNumber'] = registrationNumber;
    }
    data['registrationVisible'] = registrationVisible;
    data['availabilityStatus'] = availabilityStatus;
    data['isAvailable'] = isAvailable;
    data['rating'] = rating;
    data['distanceKm'] = distanceKm;
    data['priceEstimate'] = priceEstimate;
    data['currency'] = currency;
    data['lat'] = lat;
    data['long'] = long;
    data['createdAt'] = createdAt;
    return data;
  }

  bool get isOnlineAndAvailable =>
      availabilityStatus == 'online' && isAvailable;

  bool hasFreshLocation({
    required DateTime now,
    Duration maxAge = const Duration(seconds: 45),
    Duration maxFutureSkew = const Duration(seconds: 30),
  }) {
    return isGpsTimestampFresh(
      locationUpdatedAt,
      now: now,
      maxAge: maxAge,
      maxFutureSkew: maxFutureSkew,
    );
  }

  bool get canChat =>
      availabilityStatus == 'online' ||
      (availabilityStatus == 'busy' && isAvailable);

  bool get canCall => availabilityStatus == 'online' && isAvailable;

  static double? _asDouble(dynamic value) {
    if (value is num) return value.toDouble();
    return double.tryParse(value?.toString() ?? '');
  }

  static DateTime? _asDateTime(dynamic value) {
    if (value == null) return null;
    return DateTime.tryParse(value.toString())?.toUtc();
  }

  static String _normalizeAvailability(
    String value, {
    required bool isOnline,
    required bool isAvailable,
  }) {
    final String normalized = value.trim().toLowerCase();
    if (normalized == 'busy') return 'busy';
    if (normalized == 'online' || normalized == 'available') return 'online';
    if (isOnline) return isAvailable ? 'online' : 'busy';
    return 'offline';
  }
}
