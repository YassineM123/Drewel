String? _firstNonBlank(Iterable<dynamic> values) {
  for (final dynamic value in values) {
    if (value == null) continue;
    final String candidate = value.toString().trim();
    if (candidate.isNotEmpty) return candidate;
  }
  return null;
}

class AddDriverDetailModel {
  bool? success;
  String? message;
  Driver? driver;

  AddDriverDetailModel({this.success, this.message, this.driver});

  AddDriverDetailModel.fromJson(Map<String, dynamic> json) {
    success = json['success'];
    message = json['message'];
    driver = json['driver'] != null ? Driver.fromJson(json['driver']) : null;
  }

  Map<String, dynamic> toJson() {
    final Map<String, dynamic> data = <String, dynamic>{};
    data['success'] = success;
    data['message'] = message;
    if (driver != null) {
      data['driver'] = driver!.toJson();
    }
    return data;
  }
}

class Driver {
  String? sId;
  String? countryCode;
  String? phone;
  String? firstName;
  String? lastName;
  String? whatsappNumber;
  bool? isVerified;
  bool? isApproved;
  bool? isRestricted;
  String? status;
  String? rejectionReason;
  String? otpCode;
  String? fullName;
  String? address;
  String? contractNumber;
  String? licenseCompany;
  String? licenseCompanyUrl;
  String? licenseCarUrl;
  String? licenseDriverUrl;
  String? idDocumentUrl;
  String? carLicenseUrl;
  String? carLicenseFrontUrl;
  String? carLicenseBackUrl;
  String? drivingLicenseUrl;
  String? drivingLicenseFrontUrl;
  String? drivingLicenseBackUrl;
  String? idProofUrl;
  String? idProofFrontUrl;
  String? idProofBackUrl;
  String? passportCopyUrl;
  String? profileImageUrl;
  String? basicRequestSubmittedAt;
  String? approvedAt;
  String? completedAt;
  String? createdAt;
  String? updatedAt;
  int? iV;
  String? city;
  bool? isOnline;
  dynamic lat;
  dynamic long;
  String? vehicleType;
  DriverLogs? driverLogs;

  Driver({
    this.sId,
    this.countryCode,
    this.phone,
    this.firstName,
    this.lastName,
    this.whatsappNumber,
    this.isVerified,
    this.isApproved,
    this.isRestricted,
    this.status,
    this.rejectionReason,
    this.otpCode,
    this.fullName,
    this.address,
    this.contractNumber,
    this.licenseCompany,
    this.licenseCompanyUrl,
    this.licenseCarUrl,
    this.licenseDriverUrl,
    this.idDocumentUrl,
    this.carLicenseUrl,
    this.carLicenseFrontUrl,
    this.carLicenseBackUrl,
    this.drivingLicenseUrl,
    this.drivingLicenseFrontUrl,
    this.drivingLicenseBackUrl,
    this.idProofUrl,
    this.idProofFrontUrl,
    this.idProofBackUrl,
    this.passportCopyUrl,
    this.profileImageUrl,
    this.basicRequestSubmittedAt,
    this.approvedAt,
    this.completedAt,
    this.createdAt,
    this.updatedAt,
    this.iV,
    this.city,
    this.isOnline,
    this.lat,
    this.long,
    this.vehicleType,
    this.driverLogs,
  });

  Driver.fromJson(Map<String, dynamic> json) {
    sId = json['_id'];
    countryCode = json['countryCode'];
    phone = json['phone'];
    firstName = json['firstName'];
    lastName = json['lastName'];
    whatsappNumber = json['whatsappNumber'];
    isApproved = json['isApproved'];
    isVerified = json['isVerified'];
    isRestricted = json['isRestricted'];
    status = json['status'];
    rejectionReason = json['rejectionReason'];
    otpCode = json['otpCode'];
    fullName = json['fullName'];
    address = json['address'];
    contractNumber = json['contractNumber'];
    licenseCompany = json['licenseCompany'];
    licenseCompanyUrl = json['licenseCompanyUrl'];
    licenseCarUrl = _firstNonBlank([
      json['licenseCarUrl'],
      json['carLicenseFrontUrl'],
      json['carLicenseUrl'],
    ]);
    licenseDriverUrl = _firstNonBlank([
      json['licenseDriverUrl'],
      json['drivingLicenseFrontUrl'],
      json['drivingLicenseUrl'],
    ]);
    idDocumentUrl = _firstNonBlank([
      json['idDocumentUrl'],
      json['idProofFrontUrl'],
      json['idProofUrl'],
    ]);
    carLicenseUrl = json['carLicenseUrl'];
    carLicenseFrontUrl = _firstNonBlank([
      json['carLicenseFrontUrl'],
      json['licenseCarUrl'],
      json['carLicenseUrl'],
    ]);
    carLicenseBackUrl = json['carLicenseBackUrl'];
    drivingLicenseUrl = json['drivingLicenseUrl'];
    drivingLicenseFrontUrl = _firstNonBlank([
      json['drivingLicenseFrontUrl'],
      json['licenseDriverUrl'],
      json['drivingLicenseUrl'],
    ]);
    drivingLicenseBackUrl = json['drivingLicenseBackUrl'];
    idProofUrl = json['idProofUrl'];
    idProofFrontUrl = _firstNonBlank([
      json['idProofFrontUrl'],
      json['idDocumentUrl'],
      json['idProofUrl'],
    ]);
    idProofBackUrl = json['idProofBackUrl'];
    passportCopyUrl = json['passportCopyUrl'];
    profileImageUrl = json['profileImageUrl'];
    basicRequestSubmittedAt = json['basicRequestSubmittedAt'];
    approvedAt = json['approvedAt'];
    completedAt = json['completedAt'];
    createdAt = json['createdAt'];
    updatedAt = json['updatedAt'];
    iV = json['__v'];
    city = json['city'];
    isOnline = json['isOnline'];
    lat = json['lat'];
    long = json['long'];
    vehicleType = json['vehicleType'];
    driverLogs = json['driverLogs'] is Map<String, dynamic>
        ? DriverLogs.fromJson(json['driverLogs'])
        : null;
  }

  Map<String, dynamic> toJson() {
    final Map<String, dynamic> data = <String, dynamic>{};
    data['_id'] = sId;
    data['countryCode'] = countryCode;
    data['phone'] = phone;
    data['firstName'] = firstName;
    data['lastName'] = lastName;
    data['whatsappNumber'] = whatsappNumber;
    data['isVerified'] = isVerified;
    data['isApproved'] = isApproved;
    data['isRestricted'] = isRestricted;
    data['status'] = status;
    data['rejectionReason'] = rejectionReason;
    data['otpCode'] = otpCode;
    data['fullName'] = fullName;
    data['address'] = address;
    data['contractNumber'] = contractNumber;
    data['licenseCompany'] = licenseCompany;
    data['licenseCompanyUrl'] = licenseCompanyUrl;
    data['licenseCarUrl'] = licenseCarUrl;
    data['licenseDriverUrl'] = licenseDriverUrl;
    data['idDocumentUrl'] = idDocumentUrl;
    data['carLicenseUrl'] = carLicenseUrl;
    data['carLicenseFrontUrl'] = carLicenseFrontUrl;
    data['carLicenseBackUrl'] = carLicenseBackUrl;
    data['drivingLicenseUrl'] = drivingLicenseUrl;
    data['drivingLicenseFrontUrl'] = drivingLicenseFrontUrl;
    data['drivingLicenseBackUrl'] = drivingLicenseBackUrl;
    data['idProofUrl'] = idProofUrl;
    data['idProofFrontUrl'] = idProofFrontUrl;
    data['idProofBackUrl'] = idProofBackUrl;
    data['passportCopyUrl'] = passportCopyUrl;
    data['profileImageUrl'] = profileImageUrl;
    data['basicRequestSubmittedAt'] = basicRequestSubmittedAt;
    data['approvedAt'] = approvedAt;
    data['completedAt'] = completedAt;
    data['createdAt'] = createdAt;
    data['updatedAt'] = updatedAt;
    data['__v'] = iV;
    data['city'] = city;
    data['isOnline'] = isOnline;
    data['lat'] = lat;
    data['long'] = long;
    data['vehicleType'] = vehicleType;
    if (driverLogs != null) {
      data['driverLogs'] = driverLogs!.toJson();
    }
    return data;
  }
}

class DriverLogs {
  String? sId;
  String? driverId;
  String? countryCode;
  String? phone;
  String? whatsappNumber;
  bool? isVerified;
  bool? isApproved;
  bool? isRestricted;
  String? otpCode;
  String? fullName;
  String? address;
  String? licenseCompanyUrl;
  String? carLicenseFrontUrl;
  String? carLicenseBackUrl;
  String? drivingLicenseFrontUrl;
  String? drivingLicenseBackUrl;
  String? idProofFrontUrl;
  String? idProofBackUrl;
  String? passportCopyUrl;
  String? profileImageUrl;
  String? createdAt;
  String? updatedAt;
  String? city;
  bool? isOnline;
  dynamic lat;
  dynamic long;
  String? vehicleType;

  DriverLogs({
    this.sId,
    this.driverId,
    this.countryCode,
    this.phone,
    this.whatsappNumber,
    this.isVerified,
    this.isApproved,
    this.isRestricted,
    this.otpCode,
    this.fullName,
    this.address,
    this.licenseCompanyUrl,
    this.carLicenseFrontUrl,
    this.carLicenseBackUrl,
    this.drivingLicenseFrontUrl,
    this.drivingLicenseBackUrl,
    this.idProofFrontUrl,
    this.idProofBackUrl,
    this.passportCopyUrl,
    this.profileImageUrl,
    this.createdAt,
    this.updatedAt,
    this.city,
    this.isOnline,
    this.lat,
    this.long,
    this.vehicleType,
  });

  DriverLogs.fromJson(Map<String, dynamic> json) {
    sId = json['_id'];
    driverId = json['driverId'];
    countryCode = json['countryCode'];
    phone = json['phone'];
    whatsappNumber = json['whatsappNumber'];
    isApproved = json['isApproved'];
    isVerified = json['isVerified'];
    isRestricted = json['isRestricted'];
    otpCode = json['otpCode'];
    fullName = json['fullName'];
    address = json['address'];
    licenseCompanyUrl = json['licenseCompanyUrl'];
    carLicenseFrontUrl = json['carLicenseFrontUrl'];
    carLicenseBackUrl = json['carLicenseBackUrl'];
    drivingLicenseFrontUrl = json['drivingLicenseFrontUrl'];
    drivingLicenseBackUrl = json['drivingLicenseBackUrl'];
    idProofFrontUrl = json['idProofFrontUrl'];
    idProofBackUrl = json['idProofBackUrl'];
    passportCopyUrl = json['passportCopyUrl'];
    profileImageUrl = json['profileImageUrl'];
    createdAt = json['createdAt'];
    updatedAt = json['updatedAt'];
    city = json['city'];
    isOnline = json['isOnline'];
    lat = json['lat'];
    long = json['long'];
    vehicleType = json['vehicleType'];
  }

  Map<String, dynamic> toJson() {
    final Map<String, dynamic> data = <String, dynamic>{};
    data['_id'] = sId;
    data['driverId'] = driverId;
    data['countryCode'] = countryCode;
    data['phone'] = phone;
    data['whatsappNumber'] = whatsappNumber;
    data['isVerified'] = isVerified;
    data['isApproved'] = isApproved;
    data['isRestricted'] = isRestricted;
    data['otpCode'] = otpCode;
    data['fullName'] = fullName;
    data['address'] = address;
    data['licenseCompanyUrl'] = licenseCompanyUrl;
    data['carLicenseFrontUrl'] = carLicenseFrontUrl;
    data['carLicenseBackUrl'] = carLicenseBackUrl;
    data['drivingLicenseFrontUrl'] = drivingLicenseFrontUrl;
    data['drivingLicenseBackUrl'] = drivingLicenseBackUrl;
    data['idProofFrontUrl'] = idProofFrontUrl;
    data['idProofBackUrl'] = idProofBackUrl;
    data['passportCopyUrl'] = passportCopyUrl;
    data['profileImageUrl'] = profileImageUrl;
    data['createdAt'] = createdAt;
    data['updatedAt'] = updatedAt;
    data['city'] = city;
    data['isOnline'] = isOnline;
    data['lat'] = lat;
    data['long'] = long;
    data['vehicleType'] = vehicleType;
    return data;
  }
}
