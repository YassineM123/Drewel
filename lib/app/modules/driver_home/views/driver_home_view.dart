import 'package:drewel/app/data/apis/api_constants/api_key_constants.dart';
import 'package:drewel/app/data/constants/image_constants.dart';
import 'package:drewel/common/common_drawer.dart';
import 'package:drewel/common/common_methods.dart';
import 'package:drewel/common/drewel_app_bar.dart';
import 'package:drewel/common/drewel_osm_map.dart';
import 'package:drewel/common/drewel_web_map_fallback.dart';
import 'package:flutter/material.dart';

import 'package:get/get.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:responsive_sizer/responsive_sizer.dart';

import '../../../../common/colors.dart';
import '../../../../common/common_widgets.dart';
import '../../../../common/text_styles.dart';
import '../controllers/driver_home_controller.dart';
import '../../communication/widgets/secure_communication_panel.dart';
import '../../communication/widgets/driver_ride_requests_panel.dart';
import '../../messages/widgets/messages_app_bar_button.dart';
import '../../notification/widgets/notification_app_bar_button.dart';
import '../../points/widgets/driver_points_indicator.dart';
import '../../active_ride/widgets/active_ride_card.dart';
import '../widgets/driver_home_bottom_bar.dart';
import '../widgets/driver_location_search_bar.dart';

class DriverHomeView extends GetView<DriverHomeController> {
  const DriverHomeView({super.key});
  @override
  Widget build(BuildContext context) {
    return Obx(() {
      controller.count.value;
      return PopScope<Object?>(
        canPop: false,
        onPopInvokedWithResult: (bool didPop, Object? result) {
          if (didPop) return;
          if (controller.locationFocusNode.hasFocus ||
              controller.placeSuggestions.isNotEmpty) {
            controller.locationFocusNode.unfocus();
            controller.clearPlaceSuggestions();
            CommonMethods.unFocsKeyBoard();
          }
        },
        child: Scaffold(
            key: controller.scaffoldKey,
            appBar: DrewelAppBar(
              title: '',
              showMenuButton: true,
              actions: const <Widget>[
                NotificationAppBarButton(),
                MessagesAppBarButton(),
                SizedBox(width: 4),
              ],
              onMenu: () {
                controller.locationFocusNode.unfocus();
                controller.clearPlaceSuggestions();
                CommonMethods.unFocsKeyBoard();
                controller.clickOnMenu();
              },
            ),
            endDrawer: Obx(
              () => CustomDrawer(
                userData: <String, String>{
                  ...controller.userData,
                  ApiKeyConstants.type: ApiKeyConstants.driver,
                },
              ),
            ),
            backgroundColor: primaryColor,
            bottomNavigationBar: DriverHomeBottomBar(
              isOnline: !controller.isGoOnline.value,
              isLoading: controller.showLoading.value,
              onToggleOnline: controller.callingUpdateDriverOnlineStatus,
              activeRide: const ActiveRideCard(),
              rideRequests: const DriverRideRequestsPanel(),
              communication: const SecureCommunicationPanel(
                hideWhenUnavailable: true,
              ),
            ),
            body: Column(
              mainAxisAlignment: MainAxisAlignment.end,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(
                  child: Container(
                    width: MediaQuery.of(context).size.width,
                    margin: EdgeInsets.only(top: 10.px),
                    decoration: BoxDecoration(
                        color: primary3Color,
                        borderRadius: BorderRadius.only(
                            topRight: Radius.circular(40.px),
                            topLeft: Radius.circular(40.px))),
                    clipBehavior: Clip.hardEdge,
                    child: Stack(
                      children: [
                        Positioned.fill(
                          child: Padding(
                            padding: EdgeInsets.only(top: 60.px),
                            child: DrewelWebMapFallback(
                              openStreetMap: DrewelOsmMap(
                                center: controller.mapPosition,
                                onTap: (_) {
                                  controller.locationFocusNode.unfocus();
                                  controller.clearPlaceSuggestions();
                                  CommonMethods.unFocsKeyBoard();
                                },
                                markers: <DrewelOsmMarker>[
                                  DrewelOsmMarker(
                                    id: 'driver_location',
                                    position: controller.mapPosition,
                                    child: const Material(
                                      color: Colors.transparent,
                                      child: Icon(
                                        Icons.local_shipping,
                                        color: primaryColor,
                                        size: 34,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              googleMap: GoogleMap(
                                mapType: MapType.normal,
                                zoomGesturesEnabled: true,
                                tiltGesturesEnabled: true,
                                myLocationButtonEnabled: false,
                                onTap: (_) {
                                  controller.locationFocusNode.unfocus();
                                  controller.clearPlaceSuggestions();
                                  CommonMethods.unFocsKeyBoard();
                                },
                                markers: {
                                  Marker(
                                      markerId:
                                          const MarkerId('driver_location'),
                                      position: controller.mapPosition,
                                      icon: controller.customMarker)
                                },
                                onCameraMove:
                                    (CameraPosition cameraPosition) async {
                                  print(cameraPosition.zoom);
                                },
                                minMaxZoomPreference:
                                    MinMaxZoomPreference.unbounded,
                                initialCameraPosition: CameraPosition(
                                  target: controller.mapPosition,
                                  zoom: 12,
                                ),
                                onMapCreated:
                                    (GoogleMapController googlecontroller) {
                                  controller.xController = googlecontroller;
                                  controller.xController!.animateCamera(
                                      CameraUpdate.newCameraPosition(
                                          CameraPosition(
                                    target: controller.mapPosition,
                                    zoom: 12,
                                  )));
                                },
                              ),
                            ),
                          ),
                        ),
                        // My Location Button
                        Positioned(
                          top: 84.px,
                          right: 20.px,
                          child: GestureDetector(
                            onTap: () {
                              controller.locationFocusNode.unfocus();
                              controller.clearPlaceSuggestions();
                              CommonMethods.unFocsKeyBoard();
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
                        Positioned(
                          top: 84.px,
                          left: 20.px,
                          child: ConstrainedBox(
                            constraints: BoxConstraints(
                              maxWidth:
                                  MediaQuery.of(context).size.width * 0.58,
                            ),
                            child: const DriverPointsIndicator(),
                          ),
                        ),
                        // Top Search Bar
                        Positioned(
                          top: 20.px,
                          left: 20.px,
                          right: 20.px,
                          child: DriverLocationSearchBar(
                            controller: controller,
                          ),
                        ),
                      ],
                    ),
                  ),
                )
              ],
            )),
      );
    });
  }

  Widget showUserRequest() {
    return ListView.builder(
        itemCount: 2,
        shrinkWrap: true,
        padding: EdgeInsets.only(bottom: 70.px),
        itemBuilder: (context, index) {
          return Container(
            height: 100.px,
            width: MediaQuery.of(context).size.width,
            padding: EdgeInsets.all(15.px),
            margin: EdgeInsets.symmetric(vertical: 5.px),
            decoration: BoxDecoration(
                color: primary3Color,
                border: Border.all(color: primaryColor, width: 1.px),
                borderRadius: BorderRadius.circular(20.px)),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                CommonWidgets.appIcons(
                    assetName: ImageConstants.imgGirl,
                    height: 60.px,
                    width: 60.px),
                Expanded(
                  child: Padding(
                    padding: EdgeInsets.symmetric(horizontal: 10.px),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Alex Robin',
                          style: MyTextStyle.titleStyle16bb,
                        ),
                        Text(
                          'Honda City',
                          style: MyTextStyle.titleStyle12b,
                        ),
                        Text(
                          'UK257845',
                          style: MyTextStyle.titleStyle12b,
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          );
        });
  }
}
