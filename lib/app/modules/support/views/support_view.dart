import 'package:flutter/material.dart';

import 'package:get/get.dart';
import 'package:responsive_sizer/responsive_sizer.dart';

import '../../../../common/colors.dart';
import '../../../../common/common_widgets.dart';
import '../../../../common/text_styles.dart';
import '../../../data/constants/icons_constant.dart';
import '../../../data/constants/image_constants.dart';
import '../../../data/constants/string_constants.dart';
import '../controllers/support_controller.dart';

class SupportView extends GetView<SupportController> {
  const SupportView({super.key});
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
              ListTile(
                leading: GestureDetector(
                  onTap: (){
                    Get.back();
                  },
                  child: CommonWidgets.appIcons(assetName: IconConstants.icBack,
                      height: 40.px,width: 40.px),
                ),
                title: Padding(
                  padding:  EdgeInsets.only(right: 50.px),
                  child: Center(
                    child:CommonWidgets.appIcons(
                        assetName: IconConstants.icLogo,
                        height: 60.px,
                        width: 150.px,
                        fit: BoxFit.contain
                    ) ,
                  ),
                ),
              ),
              Container(
                width: MediaQuery.of(context).size.width,
                height: MediaQuery.of(context).size.height-130.px,
                margin: EdgeInsets.only(top: 10.px),
                padding: EdgeInsets.symmetric(horizontal: 15.px,vertical: 25.px),
                decoration: BoxDecoration(
                    color: primary3Color,
                    borderRadius: BorderRadius.only(topRight: Radius.circular(40.px),
                        topLeft: Radius.circular(40.px))
                ),
                clipBehavior: Clip.hardEdge,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(StringConstants.support,style: MyTextStyle.titleStyle18bb,),
                    CommonWidgets.commonElevatedButton(onPressed: (){
                      controller.clickOnChatButton();
                    }, context: context,
                      child: Text(StringConstants.newChat,style: MyTextStyle.titleStyle16bw,),
                      buttonMargin: EdgeInsets.symmetric(vertical: 10.px)
                    ),
                    Text(StringConstants.yourConversation,style: MyTextStyle.titleStyle18b,),

                    showConversationList()

                  ],
                ),
              )

            ],
          );
        }));
  }
  Widget showConversationList() {
    return  ListView.builder(
      itemCount: 5,
      shrinkWrap: true,
      padding: EdgeInsets.zero,
      physics: const NeverScrollableScrollPhysics(),
      itemBuilder: (context, index) {
        return Container(
          width: MediaQuery.of(context).size.width,
          padding: EdgeInsets.all(20.px),
          margin: EdgeInsets.symmetric(vertical: 5.px),
          decoration: BoxDecoration(
            color: primary3Color,
            border: Border.all(color: backgroundColor.withOpacity(0.5), width: 1.px),
            borderRadius: BorderRadius.circular(10.px),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CommonWidgets.appIcons(
                assetName: ImageConstants.imgBoy,
                height: 40.px,
                width: 40.px,
              ),
              Expanded(
                child: Padding(
                  padding: EdgeInsets.symmetric(horizontal: 10.px),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Kyal Samuels', style: MyTextStyle.titleStyle14bb),
                      Text('Hi Harold, how can i help you', style: MyTextStyle.titleStyle12b),
                    ],
                  ),
                ),
              ),
              Text('2 hours ago', style: MyTextStyle.titleStyle12b),
            ],
          ),
        );
      },
    );
  }
}
