import 'package:get/get.dart';
import '../controllers/driver_profile_controller.dart';

class DriverProfileBinding extends Bindings {
  @override
  void dependencies() {
    final String driverId = Get.arguments is String
        ? Get.arguments as String
        : (Get.arguments is Map ? (Get.arguments['driverId']?.toString() ?? '') : '');
    Get.lazyPut<DriverProfileController>(
      () => DriverProfileController(driverId: driverId),
    );
  }
}
