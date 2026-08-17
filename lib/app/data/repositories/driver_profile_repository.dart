import '../apis/api_constants/api_url_constants.dart';
import '../apis/api_models/driver_profile_models.dart';
import '../apis/communication_api_client.dart';

class DriverProfileRepository {
  DriverProfileRepository(this._api);

  final CommunicationApiClient _api;

  Future<PublicDriverProfile> getPublicProfile(String driverId) async {
    final Map<String, dynamic> response =
        await _api.get(ApiUrlConstants.publicDriverProfile(driverId));
    final dynamic raw = response['profile'];
    return PublicDriverProfile.fromJson(
        Map<String, dynamic>.from(raw as Map));
  }

  Future<Map<String, dynamic>> getDriverReviews(
    String driverId, {
    String sort = 'recent',
    int page = 1,
    int limit = 20,
  }) async {
    final String url =
        '${ApiUrlConstants.publicDriverReviews(driverId)}?sort=$sort&page=$page&limit=$limit';
    final Map<String, dynamic> response = await _api.get(url);
    final List<dynamic> rawReviews = response['reviews'] as List? ?? [];
    final reviews = rawReviews
        .map((r) => DriverReview.fromJson(Map<String, dynamic>.from(r as Map)))
        .toList();
    final dynamic summaryRaw = response['summary'];
    final summary = summaryRaw is Map
        ? ReviewsSummary.fromJson(Map<String, dynamic>.from(summaryRaw))
        : const ReviewsSummary();
    final dynamic paginationRaw = response['pagination'];
    final pagination = paginationRaw is Map
        ? Map<String, dynamic>.from(paginationRaw)
        : <String, dynamic>{};
    return {
      'reviews': reviews,
      'summary': summary,
      'totalPages': pagination['totalPages'] ?? 1,
    };
  }

  Future<List<DriverRankingItem>> getRankings({
    int page = 1,
    int limit = 20,
  }) async {
    final String url =
        '${ApiUrlConstants.endPointOfDriverRankings}?page=$page&limit=$limit';
    final Map<String, dynamic> response = await _api.get(url);
    final List<dynamic> rawDrivers = response['drivers'] as List? ?? [];
    return rawDrivers
        .map((d) =>
            DriverRankingItem.fromJson(Map<String, dynamic>.from(d as Map)))
        .toList();
  }

  Future<void> updateProfileFields({
    String? bio,
    int? experienceYears,
    List<String>? languages,
    bool? publicProfileEnabled,
  }) async {
    await _api.patch(
      ApiUrlConstants.endPointOfUpdateProfileFields,
      <String, dynamic>{
        if (bio != null) 'bio': bio,
        if (experienceYears != null) 'experienceYears': experienceYears,
        if (languages != null) 'languages': languages,
        if (publicProfileEnabled != null)
          'publicProfileEnabled': publicProfileEnabled,
      },
    );
  }

  Future<bool> toggleFavorite(String driverId) async {
    final Map<String, dynamic> response = await _api.post(
      ApiUrlConstants.endPointOfFavoriteDriver,
      <String, dynamic>{'driverId': driverId},
    );
    return response['favorited'] == true;
  }
}
