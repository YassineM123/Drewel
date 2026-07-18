import 'package:drewel/app/data/constants/image_constants.dart';
import 'package:flutter/material.dart';

import 'package:get/get.dart';
import 'package:responsive_sizer/responsive_sizer.dart';
import 'package:carousel_slider/carousel_slider.dart';
import '../../../../common/colors.dart';
import '../../../../common/common_widgets.dart';
import '../../../../common/drewel_app_bar.dart';
import '../../../../common/drewel_pop_scope.dart';
import '../../../../common/text_styles.dart';
import '../../../data/constants/icons_constant.dart';
import '../../../data/constants/string_constants.dart';
import '../controllers/user_register_controller.dart';

class UserRegisterView extends GetView<UserRegisterController> {
  const UserRegisterView({super.key});
  @override
  Widget build(BuildContext context) {
    return Obx(() {
      controller.count.value;
      return DrewelPopScope(
        fallbackRoute: '/user-type',
        hasUnsavedChanges: controller.hasUnsavedChanges.value,
        child: Scaffold(
            appBar: const DrewelAppBar(
              title: '',
              showBackButton: true,
              fallbackRoute: '/user-type',
            ),
            backgroundColor: primaryColor,
            resizeToAvoidBottomInset: false,
            floatingActionButtonLocation:
                FloatingActionButtonLocation.centerDocked,
            floatingActionButton: CommonWidgets.commonElevatedButton(
                onPressed: () {
                  controller.clickOnFindNowButton();
                },
                context: context,
                child: Text(
                  StringConstants.findNow,
                  style: MyTextStyle.titleStyle16bw,
                ),
                buttonMargin:
                    EdgeInsets.symmetric(vertical: 0.px, horizontal: 15.px)),
            body: Column(
              mainAxisAlignment: MainAxisAlignment.end,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                CommonWidgets.appIcons(
                    assetName: IconConstants.icLogo,
                    height: 115.px,
                    width: 220.px,
                    fit: BoxFit.contain),
                Expanded(
                  child: Container(
                      width: MediaQuery.of(context).size.width,
                      padding: EdgeInsets.symmetric(
                          horizontal: 20.px, vertical: 15.px),
                      decoration: BoxDecoration(
                          color: primary3Color,
                          borderRadius: BorderRadius.only(
                              topRight: Radius.circular(40.px),
                              topLeft: Radius.circular(40.px))),
                      child: SingleChildScrollView(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              StringConstants.confirmYourInformation,
                              style: MyTextStyle.titleStyle20bb,
                            ),
                            SizedBox(
                              height: 5.px,
                            ),
                            Text(
                              StringConstants.city,
                              style: MyTextStyle.titleStyle16b,
                            ),
                            SizedBox(
                              height: 5.px,
                            ),
                            GridView.builder(
                                padding: EdgeInsets.zero,
                                itemCount: controller.cityList.length,
                                shrinkWrap: true,
                                physics: const NeverScrollableScrollPhysics(),
                                gridDelegate:
                                    SliverGridDelegateWithFixedCrossAxisCount(
                                        crossAxisCount: 4,
                                        childAspectRatio: 90 / 75,
                                        crossAxisSpacing: 10.px,
                                        mainAxisSpacing: 5.px),
                                itemBuilder: (context, index) {
                                  return GestureDetector(
                                    onTap: () {
                                      controller.clickCityItem(index);
                                    },
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.center,
                                      children: [
                                        Container(
                                          height: 60.px,
                                          width: 80.px,
                                          margin: EdgeInsets.only(bottom: 5.px),
                                          alignment: Alignment.center,
                                          decoration: BoxDecoration(
                                              borderRadius:
                                                  BorderRadius.circular(12.px),
                                              border: Border.all(
                                                  color: controller.cityIndex
                                                              .value ==
                                                          index
                                                      ? primaryColor
                                                      : Colors.black
                                                          .withOpacity(0.2))),
                                          child: Text(
                                            controller.cityList[index],
                                            style: controller.cityIndex.value ==
                                                    index
                                                ? MyTextStyle.titleStyle14bb
                                                : MyTextStyle.titleStyle14b,
                                            textAlign: TextAlign.center,
                                          ),
                                        ),
                                      ],
                                    ),
                                  );
                                }),
                            SizedBox(
                              height: 5.px,
                            ),
                            Text(
                              StringConstants.findYourTransport,
                              style: MyTextStyle.titleStyle16b,
                            ),
                            GridView.builder(
                                padding: EdgeInsets.zero,
                                itemCount: controller.transportList.length,
                                shrinkWrap: true,
                                physics: const NeverScrollableScrollPhysics(),
                                gridDelegate:
                                    SliverGridDelegateWithFixedCrossAxisCount(
                                        crossAxisCount: 4,
                                        childAspectRatio: 72 / 90,
                                        crossAxisSpacing: 10.px,
                                        mainAxisSpacing: 5.px),
                                itemBuilder: (context, index) {
                                  return GestureDetector(
                                    onTap: () {
                                      controller.clickOnTransportItem(index);
                                    },
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.center,
                                      children: [
                                        Container(
                                          height: 60.px,
                                          width: 80.px,
                                          margin: EdgeInsets.only(bottom: 5.px),
                                          alignment: Alignment.center,
                                          decoration: BoxDecoration(
                                              borderRadius:
                                                  BorderRadius.circular(12.px),
                                              border: Border.all(
                                                  color: controller
                                                              .transportIndex
                                                              .value ==
                                                          index
                                                      ? primaryColor
                                                      : Colors.black
                                                          .withOpacity(0.2))),
                                          child: CommonWidgets.appIcons(
                                              assetName: controller
                                                          .transportList[index]
                                                      ['image'] ??
                                                  '',
                                              height: 32.px,
                                              width: 50.px,
                                              color: index == 0
                                                  ? Colors.black
                                                  : null),
                                        ),
                                        SizedBox(
                                          width: 80.px,
                                          height: 18.px,
                                          child: FittedBox(
                                            fit: BoxFit.scaleDown,
                                            child: Text(
                                              controller.transportList[index]
                                                      ['name'] ??
                                                  '',
                                              style: controller.transportIndex
                                                          .value ==
                                                      index
                                                  ? MyTextStyle.titleStyle12bb
                                                  : MyTextStyle.titleStyle12b,
                                              textAlign: TextAlign.center,
                                              maxLines: 1,
                                            ),
                                          ),
                                        )
                                      ],
                                    ),
                                  );
                                }),
                            SizedBox(
                              height: 10.px,
                            ),
                            CarouselSlider(
                              carouselController: controller.sliderController,
                              items: List.generate(
                                  controller.bannerList.length,
                                  (index) => Container(
                                        child: CommonWidgets.imageView(
                                          image: controller
                                                  .bannerList[index].imageUrl ??
                                              ImageConstants.imgBanner,
                                          height: 110.px,
                                          width:
                                              MediaQuery.of(context).size.width,
                                          fit: BoxFit.cover,
                                          borderRadius:
                                              BorderRadius.circular(12.px),
                                        ),
                                      )),
                              options: CarouselOptions(
                                  height: 110.px,
                                  viewportFraction: 1.0,
                                  initialPage: 0,
                                  enableInfiniteScroll: true,
                                  reverse: false,
                                  autoPlay: true,
                                  pageSnapping: false,
                                  autoPlayInterval: const Duration(seconds: 4),
                                  autoPlayAnimationDuration:
                                      const Duration(milliseconds: 1000),
                                  autoPlayCurve: Curves.easeInOut,
                                  enlargeCenterPage: true,
                                  enlargeFactor: 0.01,
                                  scrollDirection: Axis.horizontal,
                                  onPageChanged: (val, _) {
                                    controller.currentIndex.value = val;
                                  }),
                            ),
                            Align(
                              alignment: Alignment.center,
                              child: Container(
                                height: 8.px,
                                margin: EdgeInsets.symmetric(vertical: 10.px),
                                child: ListView.builder(
                                    itemCount: controller.bannerList.length,
                                    shrinkWrap: true,
                                    scrollDirection: Axis.horizontal,
                                    itemBuilder: (context, index) {
                                      return Obx(() {
                                        controller.currentIndex.value;
                                        return Container(
                                          height: 8.px,
                                          margin: EdgeInsets.symmetric(
                                              horizontal: 3.px),
                                          width:
                                              controller.currentIndex.value ==
                                                      index
                                                  ? 30.px
                                                  : 8.px,
                                          decoration: BoxDecoration(
                                              borderRadius:
                                                  BorderRadius.circular(4.px),
                                              color: controller
                                                          .currentIndex.value ==
                                                      index
                                                  ? const Color(0xff7E7E7E)
                                                  : const Color(0xFFD1D1D1)),
                                        );
                                      });
                                    }),
                              ),
                            ),
                            SizedBox(
                              height: 10.px,
                            )
                          ],
                        ),
                      )),
                )
              ],
            )),
      );
    });
  }
}
