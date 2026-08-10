import 'dart:async';

import 'package:get/get.dart';

import '../../../data/apis/api_models/ride_conversation_model.dart';
import '../../../data/repositories/conversation_repository.dart';
import '../../../data/apis/communication_api_client.dart';
import '../../communication/controllers/call_state_controller.dart';

class MessagesController extends GetxController {
  MessagesController({CallStateController? communication})
      : _communication = communication ?? Get.find<CallStateController>();

  final CallStateController _communication;
  final RxList<RideConversationModel> conversations =
      <RideConversationModel>[].obs;
  final RxBool loading = false.obs;
  final RxString error = ''.obs;
  final RxString statusFilter = 'all'.obs;
  Timer? _searchDebounce;
  String _query = '';

  int get unreadTotal => _communication.conversationUnread.value;

  @override
  void onInit() {
    super.onInit();
    ever<String>(statusFilter, (_) => refreshList());
    _communication.refreshUnreadSummary();
    refreshList();
  }

  @override
  void onClose() {
    _searchDebounce?.cancel();
    super.onClose();
  }

  void setStatusFilter(String value) {
    if (statusFilter.value != value) statusFilter.value = value;
  }

  void onSearchChanged(String value) {
    _searchDebounce?.cancel();
    _searchDebounce = Timer(const Duration(milliseconds: 350), () {
      _query = value.trim();
      refreshList();
    });
  }

  Future<void> refreshList() async {
    loading.value = true;
    error.value = '';
    try {
      final ConversationListResult result =
          await _communication.conversationRepository.list(
        status: statusFilter.value,
        query: _query,
      );
      conversations.assignAll(result.conversations);
      _communication.conversationUnread.value = result.unreadTotal;
    } on CommunicationApiException catch (catchError) {
      error.value = catchError.message;
    } catch (_) {
      error.value = 'Unable to load messages. Please retry.';
    } finally {
      loading.value = false;
    }
  }

  void openConversation(String rideId) {
    _communication.openConversation(rideId);
  }
}
