class DriverListModel {
  bool? success;
  String? message;
  List<Drivers>? drivers;

  DriverListModel({this.success, this.message, this.drivers});

  DriverListModel.fromJson(Map<String, dynamic> json) {
    success = json['success'];
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
    data['message'] = message;
    if (drivers != null) {
      data['drivers'] = drivers!.map((v) => v.toJson()).toList();
    }
    return data;
  }
}

class Drivers {
  String? sId;
  String? countryCode;
  String? phone;
  String? whatsappNumber;
  bool? isVerified;
  int? iV;
  String? otpCode;
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
  bool? isOnline;
  var latitude;
  var longitude;
  String? vehicleType;
  var lat;
  var long;
  String? createdAt;

  Drivers(
      {this.sId,
        this.countryCode,
        this.phone,
        this.whatsappNumber,
        this.isVerified,
        this.iV,
        this.otpCode,
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
        this.isOnline,
        this.latitude,
        this.longitude,
        this.vehicleType,
        this.lat,
        this.long,
        this.createdAt});

  Drivers.fromJson(Map<String, dynamic> json) {
    sId = json['_id'];
    countryCode = json['countryCode'];
    phone = json['phone'];
    whatsappNumber = json['whatsappNumber'];
    isVerified = json['isVerified'];
    iV = json['__v'];
    otpCode = json['otpCode'];
    address = json['address'];
    fullName = json['fullName'];
    carLicenseUrl = json['carLicenseUrl'];
    drivingLicenseUrl = json['drivingLicenseUrl'];
    idProofUrl = json['idProofUrl'];
    licenseCompany = json['licenseCompany'];
    passportCopyUrl = json['passportCopyUrl'];
    updatedAt = json['updatedAt'];
    profileImageUrl = json['profileImageUrl'];
    city = json['city'];
    isOnline = json['isOnline'];
    latitude = json['latitude'];
    longitude = json['longitude'];
    vehicleType = json['vehicleType'];
    lat = json['lat'];
    long = json['long'];
    createdAt = json['createdAt'];
  }

  Map<String, dynamic> toJson() {
    final Map<String, dynamic> data = <String, dynamic>{};
    data['_id'] = sId;
    data['countryCode'] = countryCode;
    data['phone'] = phone;
    data['whatsappNumber'] = whatsappNumber;
    data['isVerified'] = isVerified;
    data['__v'] = iV;
    data['otpCode'] = otpCode;
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
    data['isOnline'] = isOnline;
    data['latitude'] = latitude;
    data['longitude'] = longitude;
    data['vehicleType'] = vehicleType;
    data['lat'] = lat;
    data['long'] = long;
    data['createdAt'] = createdAt;
    return data;
  }
}
