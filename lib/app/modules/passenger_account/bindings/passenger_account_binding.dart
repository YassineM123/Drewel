import 'package:get/get.dart';

import '../../../data/apis/communication_api_client.dart';
import '../../../data/repositories/passenger_account_repository.dart';
import '../../communication/controllers/call_state_controller.dart';
import '../controllers/passenger_account_controller.dart';

class PassengerAccountBinding extends Bindings {
  @override
  void dependencies() {
    CommunicationBinding().dependencies();
    if (!Get.isRegistered<PassengerAccountController>()) {
      final CommunicationApiClient api = CommunicationApiClient();
      Get.put<PassengerAccountController>(
        PassengerAccountController(
          repository: PassengerAccountRepository(api),
        ),
      );
    }
  }
}
