import 'package:drewel/app/routes/app_pages.dart';
import 'package:get/get.dart';

class SupportController extends GetxController {
  //TODO: Implement SupportController

  final count = 0.obs;



  void increment() => count.value++;


  void clickOnChatButton(){
    Get.toNamed(Routes.SUPPORT_CHAT);
  }
}
