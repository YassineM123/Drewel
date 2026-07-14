import 'package:drewel/app/data/apis/api_constants/api_key_constants.dart';
import 'package:drewel/app/routes/app_pages.dart';
import 'package:get/get.dart';
import 'package:shared_preferences/shared_preferences.dart';

class UserTypeController extends GetxController {
  //TODO: Implement UserTypeController

  final count = 0.obs;
  final currentIndex = 0.obs;



  void increment() => count.value++;

  void changeIndex(int index){
    currentIndex.value=index;
    increment();
  }

  void  clickOnNextButton()async{
    SharedPreferences prefs=await SharedPreferences.getInstance();
    if(currentIndex.value==0){
      prefs.setString(ApiKeyConstants.type, ApiKeyConstants.user);
    }else{
    prefs.setString(ApiKeyConstants.type, ApiKeyConstants.driver);
    }
    //Get.toNamed(Routes.DRIVER_REGISTER);
    Get.toNamed(Routes.LOGIN);
  }
}
