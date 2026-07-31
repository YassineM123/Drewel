class ChatMessageModel {
  String? sId;
  String? text;
  String? imageUrl;
  String? videoUrl;
  bool? seen;
  String? msgByUserId;
  String? createdAt;
  String? updatedAt;
  int? iV;

  ChatMessageModel(
      {this.sId,
      this.text,
      this.imageUrl,
      this.videoUrl,
      this.seen,
      this.msgByUserId,
      this.createdAt,
      this.updatedAt,
      this.iV});

  ChatMessageModel.fromJson(Map<String, dynamic> json) {
    sId = json['_id']?.toString();
    text = json['text']?.toString();
    imageUrl = json['imageUrl']?.toString();
    videoUrl = json['videoUrl']?.toString();
    seen = json['seen'];
    msgByUserId = _readId(json['msgByUserId']);
    createdAt = json['createdAt']?.toString();
    updatedAt = json['updatedAt']?.toString();
    iV = json['__v'];
  }

  static String? _readId(dynamic value) {
    if (value == null) return null;
    if (value is Map) {
      final dynamic nestedId = value['_id'] ?? value['id'];
      return nestedId?.toString();
    }
    return value.toString();
  }

  Map<String, dynamic> toJson() {
    final Map<String, dynamic> data = <String, dynamic>{};
    data['_id'] = sId;
    data['text'] = text;
    data['imageUrl'] = imageUrl;
    data['videoUrl'] = videoUrl;
    data['seen'] = seen;
    data['msgByUserId'] = msgByUserId;
    data['createdAt'] = createdAt;
    data['updatedAt'] = updatedAt;
    data['__v'] = iV;
    return data;
  }
}
