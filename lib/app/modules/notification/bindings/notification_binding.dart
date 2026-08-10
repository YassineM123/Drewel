import 'package:get/get.dart';

import '../../communication/controllers/call_state_controller.dart';
import '../controllers/notification_controller.dart';

class NotificationBinding extends Bindings {
  @override
  void dependencies() {
    CommunicationBinding().dependencies();
    Get.lazyPut<NotificationController>(
      () => NotificationController(),
    );
  }
}
