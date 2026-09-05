import 'package:drewel/app/modules/driver_register/bindings/driver_register_binding.dart';
import 'package:drewel/app/modules/driver_register/controllers/driver_register_controller.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get/get.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  setUp(() {
    Get.testMode = true;
    SharedPreferences.setMockInitialValues(<String, Object>{});
  });

  tearDown(() async {
    await DriverRegisterController.releaseVerificationController();
    Get.reset();
  });

  test('binding keeps verification controller alive across route replacement',
      () async {
    DriverRegisterBinding().dependencies();
    final DriverRegisterController controller = Get.find();

    final bool deletedByRouteCleanup =
        await Get.delete<DriverRegisterController>();

    expect(deletedByRouteCleanup, isFalse);
    expect(Get.find<DriverRegisterController>(), same(controller));
    expect(controller.firstNameController.text, isEmpty);
  });
}
