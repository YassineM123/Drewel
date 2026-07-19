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
    sId = json['_id'];
    text = json['text'];
    imageUrl = json['imageUrl'];
    videoUrl = json['videoUrl'];
    seen = json['seen'];
    msgByUserId = json['msgByUserId'];
    createdAt = json['createdAt'];
    updatedAt = json['updatedAt'];
    iV = json['__v'];
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
