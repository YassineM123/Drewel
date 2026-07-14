import 'package:drewel/app/data/constants/string_constants.dart';
import 'package:drewel/common/text_styles.dart';
import 'package:flutter/material.dart';

import 'package:get/get.dart';
import 'package:responsive_sizer/responsive_sizer.dart';

import '../../../../common/colors.dart';
import '../../../../common/common_widgets.dart';
import '../../../data/constants/icons_constant.dart';
import '../controllers/user_type_controller.dart';

class UserTypeView extends GetView<UserTypeController> {
  const UserTypeView({super.key});
  @override
  Widget build(BuildContext context) {
    return Scaffold(
        backgroundColor: primaryColor,
        body: Obx(() {
          controller.count.value;
          return Column(
            mainAxisAlignment: MainAxisAlignment.end,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              CommonWidgets.appIcons(
                  assetName: IconConstants.icLogo,
                  height: 165.px,
                  width: 320.px,
                  fit: BoxFit.contain
              ),
              Container(
                width: MediaQuery.of(context).size.width,
                height: MediaQuery.of(context).size.height-250.px,
                padding: EdgeInsets.symmetric(horizontal: 20.px,vertical: 40.px),
                decoration: BoxDecoration(
                  color: primary3Color,
                  borderRadius: BorderRadius.only(topRight: Radius.circular(40.px),
                  topLeft: Radius.circular(40.px))
                ),
                child: SingleChildScrollView(
                  child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(StringConstants.welcomeToDREWEL,style: MyTextStyle.titleStyle20bb,),
                    SizedBox(height: 10.px,),
                    Text(StringConstants.chooseRegistrationType,style: MyTextStyle.titleStyle16b,),

                    GestureDetector(
                      onTap: (){
                        controller.changeIndex(0);
                      },
                      child: Container(
                        height: 100.px,
                        alignment: Alignment.center,
                        margin: EdgeInsets.symmetric(vertical: 10.px),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(12.px),
                          border: Border.all(color: controller.currentIndex.value==0?primaryColor:Colors.black.withOpacity(0.2))
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            // CommonWidgets.appIcons(assetName: IconConstants.icUser,
                            // height: 25.px,width: 21.px),
                            // SizedBox(width: 10.px,),
                            Text(StringConstants.registerAsAUser,style: controller.currentIndex.value==0?MyTextStyle.titleStyle16bb:MyTextStyle.titleStyle16b,)
                          ],
                        ),
                      ),
                    ),
                    GestureDetector(
                      onTap: (){
                        controller.changeIndex(1);
                      },
                      child: Container(
                        height: 100.px,
                        alignment: Alignment.center,
                        margin: EdgeInsets.symmetric(vertical: 10.px),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(12.px),
                          border: Border.all(color: controller.currentIndex.value==1?primaryColor:Colors.black.withOpacity(0.2))
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            // CommonWidgets.appIcons(assetName: IconConstants.icDriver,
                            // height: 25.px,width: 21.px),
                            // SizedBox(width: 10.px,),
                            Text(StringConstants.registerAsADriver,style: controller.currentIndex.value==1?MyTextStyle.titleStyle16bb:MyTextStyle.titleStyle16b,)
                          ],
                        ),
                      ),
                    ),

                    CommonWidgets.commonElevatedButton(
                        onPressed: (){
                        controller.clickOnNextButton();
                        },
                        context: context,
                      child: Text(StringConstants.next,style: MyTextStyle.titleStyle16bw,),
                      buttonMargin: EdgeInsets.symmetric(vertical: 20.px)
                    )
                  ],
                ),
                )
              )

            ],
          );
        }));
  }
}
