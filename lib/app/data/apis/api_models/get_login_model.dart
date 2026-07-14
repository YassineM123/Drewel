class LoginModel {
  bool? success;
  String? message;
  String? token;
  User? user;

  LoginModel({this.success, this.message, this.token, this.user});

  LoginModel.fromJson(Map<String, dynamic> json) {
    success = json['success'];
    message = json['message'];
    token = json['token'];
    user = json['user'] != null ? User.fromJson(json['user']) : null;
  }

  Map<String, dynamic> toJson() {
    final Map<String, dynamic> data = <String, dynamic>{};
    data['success'] = success;
    data['message'] = message;
    data['token'] = token;
    if (user != null) {
      data['user'] = user!.toJson();
    }
    return data;
  }
}

class User {
  String? sId;
  String? countryCode;
  String? phone;
  String? firstName;
  String? lastName;
  bool? isVerified;
  bool? isApproved;
  bool? isRestricted;
  String? status;
  String? rejectionReason;
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

  User(
      {this.sId,
        this.countryCode,
        this.phone,
        this.firstName,
        this.lastName,
        this.isVerified,
        this.isApproved,
        this.isRestricted,
        this.status,
        this.rejectionReason,
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
        this.profileImageUrl});

  User.fromJson(Map<String, dynamic> json) {
    sId = json['_id'];
    countryCode = json['countryCode'];
    phone = json['phone'];
    firstName = json['firstName'];
    lastName = json['lastName'];
    isVerified = json['isVerified'];
    isApproved = json['isApproved'];
    isRestricted = json['isRestricted'];
    status = json['status'];
    rejectionReason = json['rejectionReason'];
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
  }

  Map<String, dynamic> toJson() {
    final Map<String, dynamic> data = <String, dynamic>{};
    data['_id'] = sId;
    data['countryCode'] = countryCode;
    data['phone'] = phone;
    data['firstName'] = firstName;
    data['lastName'] = lastName;
    data['isVerified'] = isVerified;
    data['isApproved'] = isApproved;
    data['isRestricted'] = isRestricted;
    data['status'] = status;
    data['rejectionReason'] = rejectionReason;
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
    return data;
  }
}
