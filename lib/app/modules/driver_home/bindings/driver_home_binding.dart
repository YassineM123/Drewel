import 'package:get/get.dart';

import '../controllers/driver_home_controller.dart';
import '../../points/bindings/driver_points_binding.dart';

class DriverHomeBinding extends Bindings {
  @override
  void dependencies() {
    DriverPointsBinding().dependencies();
    Get.lazyPut<DriverHomeController>(
      () => DriverHomeController(),
    );
  }
}
