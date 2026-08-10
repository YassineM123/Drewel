import 'package:get/get.dart';

import '../../communication/controllers/call_state_controller.dart';
import '../controllers/messages_controller.dart';

class MessagesBinding extends Bindings {
  @override
  void dependencies() {
    CommunicationBinding().dependencies();
    if (!Get.isRegistered<MessagesController>()) {
      Get.put<MessagesController>(MessagesController());
    }
  }
}
