import 'package:get/get.dart';

import '../../../data/apis/communication_api_client.dart';
import '../../../data/repositories/driver_account_repository.dart';
import '../../points/bindings/driver_points_binding.dart';
import '../controllers/driver_account_controller.dart';

class DriverAccountBinding extends Bindings {
  @override
  void dependencies() {
    DriverPointsBinding().dependencies();
    Get.lazyPut<DriverAccountController>(
      () => DriverAccountController(
        repository: DriverAccountRepository(CommunicationApiClient()),
      ),
    );
  }
}
