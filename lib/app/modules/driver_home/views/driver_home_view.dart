import 'package:drewel/app/data/constants/icons_constant.dart';
import 'package:drewel/app/data/constants/image_constants.dart';
import 'package:drewel/app/data/constants/string_constants.dart';
import 'package:drewel/common/common_drawer.dart';
import 'package:drewel/common/common_methods.dart';
import 'package:flutter/material.dart';

import 'package:get/get.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:responsive_sizer/responsive_sizer.dart';

import '../../../../common/colors.dart';
import '../../../../common/common_widgets.dart';
import '../../../../common/text_styles.dart';
import '../controllers/driver_home_controller.dart';

class DriverHomeView extends GetView<DriverHomeController> {
  const DriverHomeView({super.key});
  @override
  Widget build(BuildContext context) {
    return Obx((){
      controller.count.value;
      return Scaffold(
          key:  controller.scaffoldKey,
          endDrawer:  CustomDrawer(userData: controller.userData,),
          backgroundColor: primaryColor,
          floatingActionButtonLocation: FloatingActionButtonLocation.centerDocked,
          floatingActionButton: CommonWidgets.commonElevatedButton(onPressed: (){
            controller.callingUpdateDriverOnlineStatus();
          }, context: context,
              child: Text(controller.isGoOnline.value?StringConstants.goOnline:StringConstants.goOffline,
              style: controller.isGoOnline.value?MyTextStyle.titleStyle20bw:MyTextStyle.titleStyleCustom(20, FontWeight.bold, Colors.redAccent, 'Exo'),),

          buttonMargin: EdgeInsets.symmetric(horizontal: 15.px),
          decoration: BoxDecoration(
            color: controller.isGoOnline.value?primaryColor:primary3Color,
            border: Border.all(color:controller.isGoOnline.value?primaryColor:Colors.grey.withOpacity(0.7),width: 1.px ),
            borderRadius: BorderRadius.circular(10.px)
          ),
            showLoading: controller.showLoading.value
          ),
          body: Column(
            mainAxisAlignment: MainAxisAlignment.end,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              ListTile(
                title: Padding(
                  padding:  EdgeInsets.only(left: 50.px),
                  child: Center(
                    child:CommonWidgets.appIcons(
                        assetName: IconConstants.icLogo,
                        height: 60.px,
                        width: 150.px,
                        fit: BoxFit.contain
                    ) ,
                  ),
                ),
                trailing: GestureDetector(
                  onTap: () {
                    // Hide keyboard & clear only suggestions when opening drawer
                    controller.locationFocusNode.unfocus();
                    controller.clearPlaceSuggestions();
                    CommonMethods.unFocsKeyBoard();
                    controller.clickOnMenu();
                  },
                  child: CommonWidgets.appIcons(
                    assetName: IconConstants.icMenu,
                    height: 40.px,
                    width: 40.px,
                  ),
                ),
              )
              ,
              Container(
                width: MediaQuery.of(context).size.width,
                height: MediaQuery.of(context).size.height-130.px,
                margin: EdgeInsets.only(top: 10.px),
                decoration: BoxDecoration(
                    color: primary3Color,
                    borderRadius: BorderRadius.only(topRight: Radius.circular(40.px),
                        topLeft: Radius.circular(40.px))
                ),
                clipBehavior: Clip.hardEdge,
                child: Stack(
                  children: [

                    Container(
                      width: MediaQuery.of(context).size.width,
                      height: MediaQuery.of(context).size.height-130.px,
                      padding: EdgeInsets.only(top: 60.px),
                      child: GoogleMap(
                        mapType: MapType.normal,
                        zoomGesturesEnabled: true,
                        tiltGesturesEnabled: true,
                        myLocationButtonEnabled: false,
                        markers: {
                          Marker(
                              markerId: const MarkerId('driver_location'),
                              position: controller.mapPosition,
                              icon: controller.customMarker)
                        },
                        onCameraMove: (CameraPosition cameraPosition) async {
                          print(cameraPosition.zoom);
                        },
                        minMaxZoomPreference: MinMaxZoomPreference.unbounded,
                        initialCameraPosition: CameraPosition(
                          target: controller.mapPosition,
                          zoom: 12,
                        ),
                        onMapCreated: (GoogleMapController googlecontroller) {
                          controller.xController = googlecontroller;
                          controller.xController!.animateCamera(
                              CameraUpdate.newCameraPosition(CameraPosition(
                                target: controller.mapPosition,
                                zoom: 12,
                              )));
                        },
                      ),
                    ),
                    // My Location Button
                    Positioned(
                      top: 80.px,
                      right: 20.px,
                      child: GestureDetector(
                        onTap: () {
                          controller.getCurrentLocation();
                        },
                        child: Container(
                          padding: EdgeInsets.all(12.px),
                          decoration: BoxDecoration(
                            color: primaryColor,
                            borderRadius: BorderRadius.circular(12.px),
                            border: Border.all(color: primaryColor),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withOpacity(0.1),
                                blurRadius: 8,
                                offset: const Offset(0, 2),
                              ),
                            ],
                          ),
                          child: Icon(
                            Icons.my_location,
                            color: Colors.white,
                            size: 24.px,
                          ),
                        ),
                      ),
                    ),
                    Padding(
                      padding: EdgeInsets.symmetric(horizontal: 20.px,vertical: 20.px),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                padding:  EdgeInsets.symmetric(horizontal: 10.px),
                                decoration: BoxDecoration(
                                    color: primary3Color,
                                    borderRadius: BorderRadius.circular(12.px),
                                    border: Border.all(color: Colors.black.withOpacity(0.1))
                                ),
                                child: Row(
                                  children: [
                                    CommonWidgets.appIcons(assetName: IconConstants.icStarLocation,
                                        height:20.px,width: 20.px ),
                                    Expanded(
                                      child: TextField(
                                        controller: controller.locationController,
                                        focusNode: controller.locationFocusNode,
                                        style: MyTextStyle.titleStyle14b,
                                        decoration: InputDecoration(
                                          hintText: StringConstants.searchLocation,
                                          border: InputBorder.none,
                                          disabledBorder: InputBorder.none,
                                          focusedBorder: InputBorder.none,
                                          enabledBorder: InputBorder.none,
                                          hintStyle: MyTextStyle.titleStyle14b,
                                          contentPadding: EdgeInsets.zero,
                                        ),
                                        onChanged: controller.onLocationTextChanged,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              // Custom suggestions list
                              Obx(() {
                                if (controller.placeSuggestions.isEmpty) {
                                  return const SizedBox.shrink();
                                }
                                return Container(
                                  margin: EdgeInsets.only(top: 4.px),
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    borderRadius: BorderRadius.circular(10.px),
                                    boxShadow: [
                                      BoxShadow(
                                        color: Colors.black.withOpacity(0.08),
                                        blurRadius: 6,
                                        offset: const Offset(0, 2),
                                      ),
                                    ],
                                  ),
                                  constraints: BoxConstraints(
                                    maxHeight: 300.px, // make suggestions list a bit taller
                                  ),
                                  child: ListView.separated(
                                    shrinkWrap: true,
                                    padding: EdgeInsets.zero,
                                    itemCount: controller.placeSuggestions.length,
                                    separatorBuilder: (_, __) => const Divider(height: 1),
                                    itemBuilder: (context, index) {
                                      final prediction = controller.placeSuggestions[index];
                                      return InkWell(
                                        onTap: () async {
                                          await controller.clickOnLocation(prediction);
                                          controller.clearPlaceSuggestions();
                                          controller.locationFocusNode.unfocus();
                                          CommonMethods.unFocsKeyBoard();
                                        },
                                        child: Padding(
                                          padding: EdgeInsets.symmetric(
                                              horizontal: 12.px, vertical: 10.px),
                                          child: Row(
                                            children: [
                                              Icon(Icons.location_on_rounded,
                                                  color: Colors.blueAccent, size: 20.px),
                                              SizedBox(width: 10.px),
                                              Expanded(
                                                child: Text(
                                                  prediction.description ?? '',
                                                  style: TextStyle(
                                                    fontSize: 14.px,
                                                    fontWeight: FontWeight.w500,
                                                    color: Colors.black87,
                                                  ),
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      );
                                    },
                                  ),
                                );
                              }),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              )

            ],
          ));
    });
  }


  Widget showUserRequest(){
    return ListView.builder(
      itemCount: 2,
        shrinkWrap: true,
        padding: EdgeInsets.only(bottom: 70.px),
        itemBuilder: (context,index){
          return Container(
            height: 100.px,
            width: MediaQuery.of(context).size.width,
            padding: EdgeInsets.all(15.px),
            margin: EdgeInsets.symmetric(vertical: 5.px),
            decoration: BoxDecoration(
              color: primary3Color,
              border: Border.all(color: primaryColor,width: 1.px),
              borderRadius: BorderRadius.circular(20.px)
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                CommonWidgets.appIcons(assetName: ImageConstants.imgGirl,
                height: 60.px,width: 60.px),
                Expanded(
                  child: Padding(
                    padding:  EdgeInsets.symmetric(horizontal: 10.px),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Alex Robin',style: MyTextStyle.titleStyle16bb,),
                        Text('Honda City',style: MyTextStyle.titleStyle12b,),
                        Text('UK257845',style: MyTextStyle.titleStyle12b,),
                      ],
                    ),
                  ),
                ),
                CommonWidgets.appIcons(assetName: IconConstants.icWhatsApp,
                    height: 40.px,width: 40.px),
              ],
            ),
          );
        }
    );
  }
}
