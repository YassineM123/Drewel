class SimpleResponseModel {
  bool? success;
  String? message;
  String? code;

  SimpleResponseModel({
    this.success,
    this.message,
    this.code,
  });

  SimpleResponseModel.fromJson(Map<String, dynamic> json) {
    success = json['success'];
    message = json['message'];
    code = json['code'];
  }

  Map<String, dynamic> toJson() {
    final Map<String, dynamic> data = <String, dynamic>{};
    data['success'] = success;
    data['message'] = message;
    data['code'] = code;
    return data;
  }
}
