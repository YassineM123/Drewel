import 'package:get/get.dart';

import '../controllers/user_register_controller.dart';

class UserRegisterBinding extends Bindings {
  @override
  void dependencies() {
    Get.lazyPut<UserRegisterController>(
      () => UserRegisterController(),
    );
  }
}
