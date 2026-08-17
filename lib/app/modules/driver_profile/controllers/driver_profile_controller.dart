import 'package:get/get.dart';
import 'package:drewel/app/data/apis/api_models/driver_profile_models.dart';
import 'package:drewel/app/data/apis/communication_api_client.dart';
import 'package:drewel/app/data/repositories/driver_profile_repository.dart';

class DriverProfileController extends GetxController {
  DriverProfileController({required this.driverId});

  final String driverId;

  final loading = true.obs;
  final error = ''.obs;
  final profile = Rxn<PublicDriverProfile>();
  final reviews = <DriverReview>[].obs;
  final reviewsLoading = false.obs;
  final reviewsPage = 1.obs;
  final reviewsTotalPages = 1.obs;
  final reviewsSort = 'recent'.obs;
  final isFavorite = false.obs;
  final favoriteLoading = false.obs;

  late final DriverProfileRepository _repository;

  @override
  void onInit() {
    super.onInit();
    _repository = DriverProfileRepository(CommunicationApiClient());
    loadProfile();
    loadReviews();
  }

  Future<void> loadProfile() async {
    loading.value = true;
    error.value = '';
    try {
      profile.value = await _repository.getPublicProfile(driverId);
    } catch (e) {
      error.value = e.toString();
    } finally {
      loading.value = false;
    }
  }

  Future<void> loadReviews({bool refresh = false}) async {
    if (refresh) {
      reviewsPage.value = 1;
      reviews.clear();
    }
    reviewsLoading.value = true;
    try {
      final result = await _repository.getDriverReviews(
        driverId,
        sort: reviewsSort.value,
        page: reviewsPage.value,
      );
      final List<DriverReview> newReviews = result['reviews'] as List<DriverReview>;
      if (refresh || reviewsPage.value == 1) {
        reviews.value = newReviews;
      } else {
        reviews.addAll(newReviews);
      }
      reviewsTotalPages.value = result['totalPages'] as int;
    } catch (e) {
      // silently fail for reviews
    } finally {
      reviewsLoading.value = false;
    }
  }

  Future<void> loadMoreReviews() async {
    if (reviewsPage.value >= reviewsTotalPages.value) return;
    reviewsPage.value++;
    await loadReviews();
  }

  void changeSort(String sort) {
    reviewsSort.value = sort;
    loadReviews(refresh: true);
  }

  Future<void> toggleFavorite() async {
    if (favoriteLoading.value) return;
    favoriteLoading.value = true;
    try {
      final result = await _repository.toggleFavorite(driverId);
      isFavorite.value = result;
    } catch (e) {
      // silently fail
    } finally {
      favoriteLoading.value = false;
    }
  }

  Future<void> refreshAll() async {
    await Future.wait([
      loadProfile(),
      loadReviews(refresh: true),
    ]);
  }
}
