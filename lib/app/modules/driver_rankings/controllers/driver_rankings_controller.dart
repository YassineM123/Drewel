import 'package:get/get.dart';
import 'package:drewel/app/data/apis/api_models/driver_profile_models.dart';
import 'package:drewel/app/data/apis/communication_api_client.dart';
import 'package:drewel/app/data/repositories/driver_profile_repository.dart';

class DriverRankingsController extends GetxController {
  final loading = true.obs;
  final error = ''.obs;
  final rankings = <DriverRankingItem>[].obs;
  final page = 1.obs;
  final hasMore = true.obs;
  final loadingMore = false.obs;

  late final DriverProfileRepository _repository;

  @override
  void onInit() {
    super.onInit();
    _repository = DriverProfileRepository(CommunicationApiClient());
    loadRankings();
  }

  Future<void> loadRankings({bool refresh = false}) async {
    if (refresh) {
      page.value = 1;
      rankings.clear();
      hasMore.value = true;
    }
    loading.value = rankings.isEmpty;
    loadingMore.value = rankings.isNotEmpty;
    error.value = '';
    try {
      final results = await _repository.getRankings(page: page.value);
      if (refresh || page.value == 1) {
        rankings.value = results;
      } else {
        rankings.addAll(results);
      }
      hasMore.value = results.length >= 20;
    } catch (e) {
      error.value = e.toString();
    } finally {
      loading.value = false;
      loadingMore.value = false;
    }
  }

  Future<void> loadMore() async {
    if (!hasMore.value || loadingMore.value) return;
    page.value++;
    await loadRankings();
  }

  Future<void> refreshAll() async {
    await loadRankings(refresh: true);
  }
}
