import 'package:get/get.dart';

class LocalUserDataController extends GetxController {
  final RxString userName = ''.obs;
  static RxString userFirstName = ''.obs;
  static RxString userLastName = ''.obs;
  static RxString userId = ''.obs;
  static RxString userPhone = ''.obs;
  static RxString userDob = ''.obs;
  final RxString userEmail = ''.obs;
  static RxString userImage = ''.obs;
  static RxString userGender = ''.obs;
  final RxString userSubscription = ''.obs;
/*
  setUserData(UserModel userModel) {
    userName.value =
        '${userModel.result!.firstName} ${userModel.result!.lastName}';
    userId.value = userModel.result!.id ?? '';
    userFirstName.value = userModel.result!.firstName ?? '';
    userLastName.value = userModel.result!.lastName ?? '';
    userPhone.value = userModel.result!.mobile ?? '';
    userDob.value = userModel.result!.dob ?? '';
    userEmail.value = userModel.result!.email ?? '';
    userImage.value = userModel.result!.image ?? '';
    userGender.value = userModel.result!.gender ?? '';
    userSubscription.value = userModel.result!.subscribe ?? '';
    update();
  }

  setSubscription() {
    userSubscription.value = 'YES';
  }*/
}
