import '../apis/api_constants/api_url_constants.dart';
import '../apis/api_models/ride_conversation_model.dart';
import '../apis/communication_api_client.dart';

class ConversationPagination {
  const ConversationPagination({
    required this.page,
    required this.limit,
    required this.total,
    required this.totalPages,
  });

  final int page;
  final int limit;
  final int total;
  final int totalPages;

  bool get hasMore => page < totalPages;

  factory ConversationPagination.fromJson(Map<String, dynamic> json) =>
      ConversationPagination(
        page: (json['page'] as num?)?.toInt() ?? 1,
        limit: (json['limit'] as num?)?.toInt() ?? 20,
        total: (json['total'] as num?)?.toInt() ?? 0,
        totalPages: (json['totalPages'] as num?)?.toInt() ?? 0,
      );
}

class ConversationListResult {
  const ConversationListResult({
    required this.conversations,
    required this.unreadTotal,
    required this.pagination,
    this.lastMessageAt,
  });

  final List<RideConversationModel> conversations;
  final int unreadTotal;
  final DateTime? lastMessageAt;
  final ConversationPagination pagination;

  factory ConversationListResult.fromJson(Map<String, dynamic> json) {
    final dynamic rawConversations = json['conversations'] ?? json['data'];
    return ConversationListResult(
      conversations: rawConversations is List
          ? rawConversations
              .whereType<Map>()
              .map((Map value) => RideConversationModel.fromJson(
                    Map<String, dynamic>.from(value),
                  ))
              .toList(growable: false)
          : const <RideConversationModel>[],
      unreadTotal: (json['unreadTotal'] as num?)?.toInt() ?? 0,
      lastMessageAt:
          DateTime.tryParse((json['lastMessageAt'] ?? '').toString())?.toLocal(),
      pagination: json['pagination'] is Map
          ? ConversationPagination.fromJson(
              Map<String, dynamic>.from(json['pagination'] as Map))
          : const ConversationPagination(page: 1, limit: 20, total: 0, totalPages: 0),
    );
  }
}

class ConversationUnreadSummary {
  const ConversationUnreadSummary({required this.unreadTotal, this.lastMessageAt});

  final int unreadTotal;
  final DateTime? lastMessageAt;

  factory ConversationUnreadSummary.fromJson(Map<String, dynamic> json) =>
      ConversationUnreadSummary(
        unreadTotal: (json['unreadTotal'] as num?)?.toInt() ?? 0,
        lastMessageAt:
            DateTime.tryParse((json['lastMessageAt'] ?? '').toString())?.toLocal(),
      );
}

class ConversationRepository {
  ConversationRepository(this._api);

  final CommunicationApiClient _api;

  Future<ConversationListResult> list({
    String status = 'all',
    bool unread = false,
    String query = '',
    int page = 1,
    int limit = 20,
  }) async {
    final Uri uri = Uri.parse(ApiUrlConstants.conversations('')).replace(
      queryParameters: <String, String>{
        'status': status,
        if (unread) 'unread': 'true',
        if (query.trim().isNotEmpty) 'q': query.trim(),
        'page': '$page',
        'limit': '$limit',
      },
    );
    return ConversationListResult.fromJson(await _api.get(uri.toString()));
  }

  Future<RideConversationModel> get(String rideId) async {
    final Map<String, dynamic> response =
        await _api.get(ApiUrlConstants.conversations('/$rideId'));
    final dynamic raw = response['conversation'] ?? response['data'];
    return RideConversationModel.fromJson(Map<String, dynamic>.from(raw as Map));
  }

  Future<RideConversationModel> markRead(String rideId) async {
    final Map<String, dynamic> response =
        await _api.post(ApiUrlConstants.conversations('/$rideId/read'));
    final dynamic raw = response['conversation'] ?? response['data'];
    return RideConversationModel.fromJson(Map<String, dynamic>.from(raw as Map));
  }

  Future<ConversationUnreadSummary> summary() async {
    final Map<String, dynamic> response =
        await _api.get(ApiUrlConstants.conversations('/summary'));
    return ConversationUnreadSummary.fromJson(response);
  }
}
