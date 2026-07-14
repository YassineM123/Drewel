class SignUpModel {
  String? status;
  SignUpData? data;
  String? message;

  SignUpModel({this.status, this.data, this.message});

  SignUpModel.fromJson(Map<String, dynamic> json) {
    status = json['status'];
    data = json['data'] != null ? SignUpData.fromJson(json['data']) : null;
    message = json['message'];
  }

  Map<String, dynamic> toJson() {
    final Map<String, dynamic> data = <String, dynamic>{};
    data['status'] = status;
    if (this.data != null) {
      data['data'] = this.data!.toJson();
    }
    data['message'] = message;
    return data;
  }
}

class SignUpData {
  String? id;
  String? userName;
  String? email;
  String? password;
  String? type;
  String? countryCode;
  String? mobile;
  String? gender;
  String? dob;
  String? image;
  String? otp;
  String? accountStatus;
  String? address;
  String? lat;
  String? long;
  String? language;
  String? updatedAt;
  String? createdAt;
  String? generalNotification;
  String? sound;
  String? vibrate;
  String? appUpdate;
  String? newTipsAvailable;
  String? newServiceAvailable;
  String? firstName;
  String? lastName;
  String? wallet;
  String? deviceId;
  String? status;
  String? userType;
  String? clubName;
  String? city;
  String? state;
  String? postalCode;

  SignUpData(
      {this.id,
      this.userName,
      this.email,
      this.password,
      this.type,
      this.countryCode,
      this.mobile,
      this.gender,
      this.dob,
      this.image,
      this.otp,
      this.accountStatus,
      this.address,
      this.lat,
      this.long,
      this.language,
      this.updatedAt,
      this.createdAt,
      this.generalNotification,
      this.sound,
      this.vibrate,
      this.appUpdate,
      this.newTipsAvailable,
      this.newServiceAvailable,
      this.firstName,
      this.lastName,
      this.wallet,
      this.deviceId,
      this.status,
      this.userType,
      this.clubName,
      this.city,
      this.state,
      this.postalCode});

  SignUpData.fromJson(Map<String, dynamic> json) {
    id = json['id'];
    userName = json['user_name'];
    email = json['email'];
    password = json['password'];
    type = json['type'];
    countryCode = json['country_code'];
    mobile = json['mobile'];
    gender = json['gender'];
    dob = json['dob'];
    image = json['image'];
    otp = json['otp'];
    accountStatus = json['account_status'];
    address = json['address'];
    lat = json['lat'];
    long = json['long'];
    language = json['language'];
    updatedAt = json['updated_at'];
    createdAt = json['created_at'];
    generalNotification = json['general_notification'];
    sound = json['sound'];
    vibrate = json['vibrate'];
    appUpdate = json['app_update'];
    newTipsAvailable = json['new_tips_available'];
    newServiceAvailable = json['new_service_available'];
    firstName = json['first_name'];
    lastName = json['last_name'];
    wallet = json['wallet'];
    deviceId = json['device_id'];
    status = json['status'];
    userType = json['user_type'];
    clubName = json['club_name'];
    city = json['city'];
    state = json['state'];
    postalCode = json['postal_code'];
  }

  Map<String, dynamic> toJson() {
    final Map<String, dynamic> data = <String, dynamic>{};
    data['id'] = id;
    data['user_name'] = userName;
    data['email'] = email;
    data['password'] = password;
    data['type'] = type;
    data['country_code'] = countryCode;
    data['mobile'] = mobile;
    data['gender'] = gender;
    data['dob'] = dob;
    data['image'] = image;
    data['otp'] = otp;
    data['account_status'] = accountStatus;
    data['address'] = address;
    data['lat'] = lat;
    data['long'] = long;
    data['language'] = language;
    data['updated_at'] = updatedAt;
    data['created_at'] = createdAt;
    data['general_notification'] = generalNotification;
    data['sound'] = sound;
    data['vibrate'] = vibrate;
    data['app_update'] = appUpdate;
    data['new_tips_available'] = newTipsAvailable;
    data['new_service_available'] = newServiceAvailable;
    data['first_name'] = firstName;
    data['last_name'] = lastName;
    data['wallet'] = wallet;
    data['device_id'] = deviceId;
    data['status'] = status;
    data['user_type'] = userType;
    data['club_name'] = clubName;
    data['city'] = city;
    data['state'] = state;
    data['postal_code'] = postalCode;
    return data;
  }
}
