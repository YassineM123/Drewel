import 'package:drewel/app/data/apis/api_constants/api_key_constants.dart';
import 'package:drewel/app/data/apis/api_models/get_banner_model.dart';
import 'package:drewel/app/routes/app_pages.dart';
import 'package:drewel/common/local_data.dart';
import 'package:get/get.dart';
import 'package:carousel_slider/carousel_slider.dart';

import '../../../data/apis/api_methods/api_methods.dart';

class UserRegisterController extends GetxController {
  CarouselSliderController sliderController = CarouselSliderController();
  List<String> cityList = LocalData().cityList;
  List<Map<String, String>> transportList = LocalData().transportList;
  List<Banners> bannerList = [];
  final count = 0.obs;
  final currentIndex = 0.obs;
  final transportIndex = 0.obs;
  final cityIndex = 0.obs;
  final hasUnsavedChanges = false.obs;
  @override
  void onInit() {
    super.onInit();
    callingGetBannerListApi();
  }

  void increment() => count.value++;

  void clickOnTransportItem(index) {
    transportIndex.value = index;
    hasUnsavedChanges.value = true;
    increment();
  }

  void clickCityItem(index) {
    cityIndex.value = index;
    hasUnsavedChanges.value = true;
    increment();
  }

  Future<void> callingGetBannerListApi() async {
    try {
      BannerModel? bannerModel = await ApiMethods.getBannerApi();
      if (bannerModel != null &&
          bannerModel.success != null &&
          bannerModel.success! &&
          bannerModel.banners != null) {
        bannerList = bannerModel.banners!;
      } else {
        print("Banner Image not found.....");
      }
    } catch (e) {
      print("Error: -----${e.toString()}");
    }
    increment();
  }

  void clickOnFindNowButton() {
    Map<String, String> data = {
      ApiKeyConstants.index: cityIndex.value.toString(),
      ApiKeyConstants.city:
          LocalData().cityList[cityIndex.value].replaceAll('\n', '').trim(),
      ApiKeyConstants.vehicleType: LocalData()
          .transportList[transportIndex.value]['name']
          .toString()
          .trim(),
    };
    Get.toNamed(Routes.USER_HOME, parameters: data);
  }
}
