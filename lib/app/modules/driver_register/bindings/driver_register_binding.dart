import 'package:get/get.dart';

import '../controllers/driver_register_controller.dart';

class DriverRegisterBinding extends Bindings {
  @override
  void dependencies() {
    if (!Get.isRegistered<DriverRegisterController>()) {
      Get.put<DriverRegisterController>(
        DriverRegisterController(),
        permanent: true,
      );
    }
  }
}
