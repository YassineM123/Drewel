import 'package:get/get.dart';

import '../../../data/apis/communication_api_client.dart';
import '../../../data/repositories/active_ride_repository.dart';
import '../controllers/active_ride_controller.dart';

class ActiveRideBinding extends Bindings {
  @override
  void dependencies() {
    if (Get.isRegistered<ActiveRideController>()) return;
    final CommunicationApiClient api = CommunicationApiClient();
    Get.put<ActiveRideController>(
      ActiveRideController(repository: ActiveRideRepository(api)),
      permanent: true,
    );
  }
}
