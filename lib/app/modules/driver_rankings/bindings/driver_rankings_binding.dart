import 'package:get/get.dart';
import '../controllers/driver_rankings_controller.dart';

class DriverRankingsBinding extends Bindings {
  @override
  void dependencies() {
    Get.lazyPut<DriverRankingsController>(
      () => DriverRankingsController(),
    );
  }
}
