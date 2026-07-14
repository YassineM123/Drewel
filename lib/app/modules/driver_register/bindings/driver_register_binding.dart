import 'package:get/get.dart';

import '../controllers/driver_register_controller.dart';

class DriverRegisterBinding extends Bindings {
  @override
  void dependencies() {
    Get.lazyPut<DriverRegisterController>(
      () => DriverRegisterController(),
    );
  }
}
