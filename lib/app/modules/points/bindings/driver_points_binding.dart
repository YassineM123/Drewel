import 'package:get/get.dart';

import '../../../data/apis/communication_api_client.dart';
import '../../../data/repositories/driver_points_repository.dart';
import '../controllers/driver_points_controller.dart';

class DriverPointsBinding extends Bindings {
  @override
  void dependencies() {
    if (Get.isRegistered<DriverPointsController>()) return;
    Get.lazyPut<DriverPointsController>(
      () => DriverPointsController(
        repository: ApiDriverPointsRepository(CommunicationApiClient()),
      ),
      fenix: true,
    );
  }
}
