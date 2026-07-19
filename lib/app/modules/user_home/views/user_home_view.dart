import 'package:drewel/app/data/apis/api_models/get_all_driver_model.dart';
import 'package:flutter/material.dart';

import 'package:get/get.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:responsive_sizer/responsive_sizer.dart';

import '../../../../common/colors.dart';
import '../../../../common/common_drawer.dart';
import '../../../../common/common_methods.dart';
import '../../../../common/common_widgets.dart';
import '../../../../common/drewel_app_bar.dart';
import '../../../../common/drewel_navigation.dart';
import '../../../../common/drewel_pop_scope.dart';
import '../../../../common/text_styles.dart';
import '../../../data/apis/api_constants/api_key_constants.dart';
import '../../../data/constants/icons_constant.dart';
import '../../../data/constants/string_constants.dart';
import '../../../routes/app_pages.dart';
import '../controllers/user_home_controller.dart';
import '../../communication/widgets/secure_communication_panel.dart';
import '../../communication/controllers/call_state_controller.dart';

class UserHomeView extends StatefulWidget {
  const UserHomeView({super.key});

  @override
  State<UserHomeView> createState() => _UserHomeViewState();
}

class _UserHomeViewState extends State<UserHomeView> {
  late final UserHomeController controller;
  bool _isLeaving = false;

  @override
  void initState() {
    super.initState();
    controller = Get.find<UserHomeController>();
  }

  Future<void> _handleBack() async {
    if (_isLeaving) return;
    _isLeaving = true;
    controller.locationFocusNode.unfocus();
    controller.clearPlaceSuggestions();
    CommonMethods.unFocsKeyBoard();
    await WidgetsBinding.instance.endOfFrame;
    if (!mounted) return;
    final NavigatorState navigator = Navigator.of(context);
    if (Get.previousRoute == Routes.USER_REGISTER && navigator.canPop()) {
      navigator.pop();
      return;
    }
    await DrewelNavigation.resetTo(Routes.USER_REGISTER);
  }

  @override
  void dispose() {
    controller.disposeViewResources();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      controller.count.value;
      controller.sheetSize.value;
      final screenHeight = MediaQuery.of(context).size.height - 120.px;
      final mapHeight = screenHeight * (1 - controller.sheetSize.value);
      return DrewelPopScope(
        fallbackRoute: Routes.USER_REGISTER,
        onBack: _handleBack,
        child: Scaffold(
            key: controller.scaffoldKey,
            appBar: DrewelAppBar(
              title: '',
              titleWidget: Semantics(
                label: 'Drewel',
                image: true,
                child: ExcludeSemantics(
                  child: CommonWidgets.appIcons(
                    assetName: IconConstants.icLogo,
                    height: 52,
                    width: 150,
                    fit: BoxFit.contain,
                  ),
                ),
              ),
              showBackButton: true,
              showMenuButton: true,
              onBack: _handleBack,
              backIcon: ExcludeSemantics(
                child: CommonWidgets.appIcons(
                  assetName: IconConstants.icBack,
                  height: 40,
                  width: 40,
                  fit: BoxFit.contain,
                ),
              ),
              menuIcon: ExcludeSemantics(
                child: CommonWidgets.appIcons(
                  assetName: IconConstants.icMenu,
                  height: 32,
                  width: 32,
                  fit: BoxFit.contain,
                ),
              ),
              onMenu: () {
                controller.locationFocusNode.unfocus();
                controller.clearPlaceSuggestions();
                CommonMethods.unFocsKeyBoard();
                controller.clickOnMenu();
              },
            ),
            endDrawer: CustomDrawer(
              userData: Map<String, String>.from(controller.userData),
            ),
            resizeToAvoidBottomInset: false,
            backgroundColor: primaryColor,
            bottomNavigationBar: const SecureCommunicationPanel(),
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
                        Container(
                          width: MediaQuery.of(context).size.width,
                          height: mapHeight,
                          padding: EdgeInsets.only(top: 0.px),
                          child: GoogleMap(
                            mapType: MapType.normal,
                            zoomGesturesEnabled: true,
                            tiltGesturesEnabled: true,
                            myLocationButtonEnabled: false,
                            markers: controller.markers,
                            // Track camera movement for updating driver list
                            onCameraMove: (CameraPosition cameraPosition) {
                              controller.onCameraMove(cameraPosition);
                            },
                            // When camera stops moving, filter drivers by visible bounds
                            onCameraIdle: () {
                              controller.onCameraIdle();
                            },
                            // Tap on map to set location
                            onTap: (LatLng position) {
                              controller.setSelectedLocation(position);
                            },
                            minMaxZoomPreference:
                                MinMaxZoomPreference.unbounded,
                            initialCameraPosition: CameraPosition(
                              target: controller.mapPosition,
                              zoom: 12,
                            ),
                            onMapCreated:
                                (GoogleMapController googlecontroller) async {
                              await controller.onMapCreated(googlecontroller);
                            },
                          ),
                        ),
                        // Distance Card - Shows when driver is selected
                        if (controller.selectIndex >= 0 &&
                            controller.hasReferenceLocation &&
                            controller.selectedDriverDistance.value > 0)
                          Positioned(
                            top: 80.px,
                            left: 20.px,
                            child: _buildDistancePopup(context),
                          ),
                        Positioned(
                          top: 20.px,
                          left: 20.px,
                          right: 20.px,
                          child: Column(
                            children: [
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Expanded(
                                    child: Column(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Container(
                                          padding: EdgeInsets.symmetric(
                                              horizontal: 10.px),
                                          decoration: BoxDecoration(
                                              color: primary3Color,
                                              borderRadius:
                                                  BorderRadius.circular(12.px),
                                              border: Border.all(
                                                  color: Colors.black
                                                      .withOpacity(0.1))),
                                          child: Row(
                                            children: [
                                              CommonWidgets.appIcons(
                                                  assetName: IconConstants
                                                      .icStarLocation,
                                                  height: 20.px,
                                                  width: 20.px),
                                              SizedBox(width: 8.px),
                                              Expanded(
                                                child: TextField(
                                                  controller: controller
                                                      .locationController,
                                                  focusNode: controller
                                                      .locationFocusNode,
                                                  style:
                                                      MyTextStyle.titleStyle14b,
                                                  decoration: InputDecoration(
                                                    hintText: StringConstants
                                                        .searchLocation,
                                                    border: InputBorder.none,
                                                    disabledBorder:
                                                        InputBorder.none,
                                                    focusedBorder:
                                                        InputBorder.none,
                                                    enabledBorder:
                                                        InputBorder.none,
                                                    hintStyle: MyTextStyle
                                                        .titleStyle14b,
                                                    contentPadding:
                                                        EdgeInsets.zero,
                                                  ),
                                                  onChanged: controller
                                                      .onLocationTextChanged,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                        Obx(() {
                                          if (controller
                                              .placeSuggestions.isEmpty) {
                                            return const SizedBox.shrink();
                                          }
                                          return Container(
                                            margin: EdgeInsets.only(top: 4.px),
                                            decoration: BoxDecoration(
                                              color: Colors.white,
                                              borderRadius:
                                                  BorderRadius.circular(10.px),
                                              boxShadow: [
                                                BoxShadow(
                                                  color: Colors.black
                                                      .withOpacity(0.08),
                                                  blurRadius: 6,
                                                  offset: const Offset(0, 2),
                                                ),
                                              ],
                                            ),
                                            constraints: BoxConstraints(
                                              maxHeight: 300.px,
                                            ),
                                            child: ListView.separated(
                                              shrinkWrap: true,
                                              padding: EdgeInsets.zero,
                                              itemCount: controller
                                                  .placeSuggestions.length,
                                              separatorBuilder: (_, __) =>
                                                  const Divider(height: 1),
                                              itemBuilder: (context, index) {
                                                final prediction = controller
                                                    .placeSuggestions[index];
                                                return InkWell(
                                                  onTap: () async {
                                                    await controller
                                                        .clickOnLocation(
                                                            prediction);
                                                    controller
                                                        .clearPlaceSuggestions();
                                                    controller.locationFocusNode
                                                        .unfocus();
                                                    CommonMethods
                                                        .unFocsKeyBoard();
                                                  },
                                                  child: Padding(
                                                    padding:
                                                        EdgeInsets.symmetric(
                                                            horizontal: 12.px,
                                                            vertical: 10.px),
                                                    child: Row(
                                                      children: [
                                                        Icon(
                                                            Icons
                                                                .location_on_rounded,
                                                            color: Colors
                                                                .blueAccent,
                                                            size: 20.px),
                                                        SizedBox(width: 10.px),
                                                        Expanded(
                                                          child: Text(
                                                            prediction
                                                                    .description ??
                                                                '',
                                                            style: TextStyle(
                                                              fontSize: 14.px,
                                                              fontWeight:
                                                                  FontWeight
                                                                      .w500,
                                                              color: Colors
                                                                  .black87,
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
                                  ),
                                  SizedBox(width: 10.px),
                                  GestureDetector(
                                    onTap: () {
                                      controller.goToUserLocation();
                                    },
                                    child: Container(
                                      padding: EdgeInsets.all(12.px),
                                      decoration: BoxDecoration(
                                        color: controller
                                                .isUserLocationLoaded.value
                                            ? primaryColor
                                            : primary3Color,
                                        borderRadius:
                                            BorderRadius.circular(12.px),
                                        border: Border.all(
                                          color: controller
                                                  .isUserLocationLoaded.value
                                              ? primaryColor
                                              : Colors.black.withOpacity(0.2),
                                        ),
                                        boxShadow: [
                                          BoxShadow(
                                            color:
                                                Colors.black.withOpacity(0.1),
                                            blurRadius: 8,
                                            offset: const Offset(0, 2),
                                          ),
                                        ],
                                      ),
                                      child: Icon(
                                        Icons.my_location,
                                        color: controller
                                                .isUserLocationLoaded.value
                                            ? Colors.white
                                            : primaryColor,
                                        size: 24.px,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              // Selected location hint
                              if (controller.isSelectedLocationSet.value)
                                Container(
                                  margin: EdgeInsets.only(top: 8.px),
                                  padding: EdgeInsets.symmetric(
                                      horizontal: 12.px, vertical: 8.px),
                                  decoration: BoxDecoration(
                                    color: primaryColor.withOpacity(0.1),
                                    borderRadius: BorderRadius.circular(8.px),
                                    border: Border.all(
                                        color: primaryColor.withOpacity(0.3)),
                                  ),
                                  child: Row(
                                    children: [
                                      Icon(Icons.touch_app,
                                          color: primaryColor, size: 16.px),
                                      SizedBox(width: 8.px),
                                      Expanded(
                                        child: Text(
                                          'Tap map or drag marker to change location',
                                          style: MyTextStyle.titleStyle12b
                                              .copyWith(color: primaryColor),
                                        ),
                                      ),
                                      SizedBox(width: 8.px),
                                      GestureDetector(
                                        onTap: () {
                                          controller.clearSelectedLocation();
                                        },
                                        child: Container(
                                          padding: EdgeInsets.all(6.px),
                                          decoration: BoxDecoration(
                                            color: Colors.red.shade50,
                                            borderRadius:
                                                BorderRadius.circular(8.px),
                                            border: Border.all(
                                                color: Colors.red
                                                    .withOpacity(0.3)),
                                          ),
                                          child: Icon(
                                            Icons.close,
                                            color: Colors.red,
                                            size: 16.px,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                            ],
                          ),
                        ),
                        showDriverList()
                      ],
                    ),
                  ),
                ),
              ],
            )),
      );
    });
  }

  Widget showDriverList() {
    final bool isCompactSheet = controller.shouldUseCompactSheet;
    final List<int> displayIndexes = <int>[
      if (controller.selectIndex >= 0 &&
          controller.selectIndex < controller.driversList.length)
        controller.selectIndex,
      ...List<int>.generate(
        controller.driversList.length,
        (index) => index,
      ).where((index) => index != controller.selectIndex),
    ];

    return NotificationListener<DraggableScrollableNotification>(
      onNotification: (notification) {
        controller.onSheetDragged(notification.extent);
        return true;
      },
      child: DraggableScrollableSheet(
        key: ValueKey('driver_sheet_$isCompactSheet'),
        initialChildSize: isCompactSheet
            ? controller.emptyInitialSheetSize
            : controller.initialSheetSize,
        minChildSize: isCompactSheet
            ? controller.emptyMinSheetSize
            : controller.minSheetSize,
        maxChildSize: isCompactSheet
            ? controller.emptyMaxSheetSize
            : controller.maxSheetSize,
        builder: (BuildContext context, ScrollController scrollController) {
          return Container(
            padding: EdgeInsets.symmetric(horizontal: 15.px, vertical: 10.px),
            decoration: BoxDecoration(
              color: primary3Color,
              borderRadius: BorderRadius.vertical(top: Radius.circular(40.px)),
              boxShadow: const [
                BoxShadow(blurRadius: 10, color: Colors.black26)
              ],
            ),
            child: controller.driversList.isEmpty
                ? _buildDriversPlaceholderState(context)
                : ListView.builder(
                    controller: scrollController, // ✅ MUST be used
                    itemCount: displayIndexes.length + 1,
                    padding: EdgeInsets.zero,
                    itemBuilder: (context, itemIndex) {
                      if (itemIndex == 0) {
                        return Column(
                          children: [
                            Container(
                              width: 40,
                              height: 6,
                              margin: const EdgeInsets.symmetric(vertical: 10),
                              decoration: BoxDecoration(
                                color: Colors.grey[400],
                                borderRadius: BorderRadius.circular(10),
                              ),
                            ),
                            Text(
                              StringConstants.chooseTheDriver,
                              style: MyTextStyle.titleStyle18bb,
                            ),
                            if (controller
                                .regionalDriverMessage.value.isNotEmpty) ...[
                              SizedBox(height: 6.px),
                              Container(
                                width: double.infinity,
                                padding: EdgeInsets.symmetric(
                                  horizontal: 12.px,
                                  vertical: 8.px,
                                ),
                                decoration: BoxDecoration(
                                  color: primaryColor.withValues(alpha: 0.08),
                                  borderRadius: BorderRadius.circular(12.px),
                                ),
                                child: Text(
                                  controller.regionalDriverMessage.value,
                                  textAlign: TextAlign.center,
                                  style: MyTextStyle.titleStyle12b.copyWith(
                                    color: Colors.grey[700],
                                  ),
                                ),
                              ),
                            ],
                            SizedBox(height: 10.px),
                          ],
                        );
                      }

                      final int index = displayIndexes[itemIndex - 1];
                      final Drivers item = controller.driversList[index];
                      final bool isSelected = controller.selectIndex == index;

                      return isSelected
                          ? _buildSelectedDriverCard(context, item, index)
                          : _buildDriverCard(context, item, index);
                    },
                  ),
          );
        },
      ),
    );
  }

  Widget _buildDistancePopup(BuildContext context) {
    return Container(
      constraints: BoxConstraints(
        maxWidth: MediaQuery.of(context).size.width * 0.6,
      ),
      padding: EdgeInsets.symmetric(horizontal: 16.px, vertical: 14.px),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22.px),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.12),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            height: 44.px,
            width: 44.px,
            decoration: BoxDecoration(
              color: primaryColor.withOpacity(0.10),
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: Icon(
              Icons.directions_car_filled_rounded,
              color: primaryColor,
              size: 22.px,
            ),
          ),
          SizedBox(width: 12.px),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Distance',
                  style: MyTextStyle.titleStyle12b.copyWith(
                    color: Colors.grey[600],
                    fontSize: 10.5.px,
                  ),
                ),
                SizedBox(height: 2.px),
                Text(
                  '${controller.selectedDriverDistance.value.toStringAsFixed(1)} km',
                  style: MyTextStyle.titleStyleCustom(
                    16.px,
                    FontWeight.w800,
                    primaryColor,
                    'Exo',
                  ),
                ),
              ],
            ),
          ),
          SizedBox(width: 10.px),
          GestureDetector(
            onTap: () {
              controller.clearRoute();
            },
            child: Container(
              height: 36.px,
              width: 36.px,
              decoration: BoxDecoration(
                color: primaryColor.withOpacity(0.10),
                shape: BoxShape.circle,
              ),
              alignment: Alignment.center,
              child: Icon(
                Icons.close_rounded,
                color: primaryColor,
                size: 18.px,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSelectedDriverCard(
    BuildContext context,
    Drivers item,
    int index,
  ) {
    final bool hasDistance = controller.selectedDriverDistance.value > 0;

    return GestureDetector(
      onTap: () {
        controller.clickOnDriverIndex(index);
      },
      child: Container(
        width: MediaQuery.of(context).size.width,
        padding: EdgeInsets.all(14.px),
        margin: EdgeInsets.symmetric(vertical: 5.px),
        decoration: BoxDecoration(
          color: primary3Color,
          border: Border.all(
            color: primaryColor,
            width: 1.5.px,
          ),
          borderRadius: BorderRadius.circular(22.px),
        ),
        child: Column(
          children: [
            Container(
              width: double.infinity,
              padding: EdgeInsets.symmetric(
                horizontal: 14.px,
                vertical: 12.px,
              ),
              decoration: BoxDecoration(
                color: primaryColor,
                borderRadius: BorderRadius.circular(14.px),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.check_circle,
                    color: Colors.white,
                    size: 18.px,
                  ),
                  SizedBox(width: 8.px),
                  Expanded(
                    child: Text(
                      hasDistance
                          ? 'SELECTED • ${controller.selectedDriverDistance.value.toStringAsFixed(1)} km away'
                          : 'SELECTED',
                      style: MyTextStyle.titleStyleCustom(
                        11.5.px,
                        FontWeight.w700,
                        Colors.white,
                        'Exo',
                      ),
                    ),
                  ),
                ],
              ),
            ),
            SizedBox(height: 14.px),
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Stack(
                  clipBehavior: Clip.none,
                  children: [
                    CommonWidgets.imageView(
                      image: item.profileImageUrl ??
                          StringConstants.defaultNetworkImage,
                      height: 64.px,
                      width: 64.px,
                      borderRadius: BorderRadius.circular(32.px),
                      defaultNetworkImage: StringConstants.defaultNetworkImage,
                    ),
                    Positioned(
                      right: -2.px,
                      bottom: -2.px,
                      child: Container(
                        height: 22.px,
                        width: 22.px,
                        decoration: BoxDecoration(
                          color: const Color(0xFF45B56A),
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 2.px),
                        ),
                        child: Icon(
                          Icons.check,
                          color: Colors.white,
                          size: 12.px,
                        ),
                      ),
                    ),
                  ],
                ),
                SizedBox(width: 12.px),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.fullName ?? 'Driver',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: MyTextStyle.titleStyleCustom(
                          18.px,
                          FontWeight.w800,
                          Colors.black,
                          'Exo',
                        ),
                      ),
                      SizedBox(height: 4.px),
                      Row(
                        children: [
                          Icon(
                            Icons.location_city,
                            size: 14.px,
                            color: Colors.grey,
                          ),
                          SizedBox(width: 4.px),
                          Expanded(
                            child: Text(
                              item.city ?? 'N/A',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: MyTextStyle.titleStyle12b.copyWith(
                                fontSize: 11.px,
                              ),
                            ),
                          ),
                        ],
                      ),
                      SizedBox(height: 4.px),
                      Row(
                        children: [
                          Icon(
                            Icons.local_shipping,
                            size: 14.px,
                            color: Colors.grey,
                          ),
                          SizedBox(width: 4.px),
                          Expanded(
                            child: Text(
                              item.vehicleType ?? 'N/A',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: MyTextStyle.titleStyle12b.copyWith(
                                fontSize: 11.px,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
            _requestRideButton(item),
          ],
        ),
      ),
    );
  }

  Widget _requestRideButton(Drivers driver) {
    final CallStateController communication = Get.find<CallStateController>();
    return Obx(() => SizedBox(
          height: 48,
          child: OutlinedButton(
            onPressed: communication.isBusy.value ||
                    communication.activeRide.value != null ||
                    communication.pendingRide.value != null
                ? null
                : () => communication.requestRide(driver.sId ?? ''),
            child: const Text('Request ride'),
          ),
        ));
  }

  Widget _buildDriverCard(BuildContext context, Drivers item, int index) {
    return GestureDetector(
      onTap: () {
        controller.clickOnDriverIndex(index);
      },
      child: Container(
        width: MediaQuery.of(context).size.width,
        padding: EdgeInsets.all(15.px),
        margin: EdgeInsets.symmetric(vertical: 5.px),
        decoration: BoxDecoration(
          color: primary3Color,
          border: Border.all(
            color: Colors.black.withOpacity(0.1),
            width: 1.px,
          ),
          borderRadius: BorderRadius.circular(15.px),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            CommonWidgets.imageView(
              image:
                  item.profileImageUrl ?? StringConstants.defaultNetworkImage,
              height: 55.px,
              width: 55.px,
              borderRadius: BorderRadius.circular(27.5.px),
              defaultNetworkImage: StringConstants.defaultNetworkImage,
            ),
            SizedBox(width: 12.px),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.fullName ?? 'Driver',
                    style: MyTextStyle.titleStyle16bb,
                  ),
                  SizedBox(height: 2.px),
                  Row(
                    children: [
                      Icon(
                        Icons.location_city,
                        size: 14.px,
                        color: Colors.grey,
                      ),
                      SizedBox(width: 4.px),
                      Text(
                        item.city ?? 'N/A',
                        style: MyTextStyle.titleStyle12b,
                      ),
                    ],
                  ),
                  SizedBox(height: 6.px),
                  Row(
                    children: [
                      Icon(
                        Icons.local_shipping,
                        size: 14.px,
                        color: Colors.grey,
                      ),
                      SizedBox(width: 4.px),
                      Expanded(
                        child: Text(
                          item.vehicleType ?? 'N/A',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: MyTextStyle.titleStyle12b,
                        ),
                      ),
                    ],
                  ),
                  if (controller.hasReferenceLocation)
                    Builder(
                      builder: (context) {
                        final double distance =
                            controller.getDistanceFromUser(item);
                        if (distance == double.infinity || distance < 0) {
                          return const SizedBox.shrink();
                        }
                        return Container(
                          margin: EdgeInsets.only(top: 6.px),
                          padding: EdgeInsets.symmetric(
                            horizontal: 8.px,
                            vertical: 3.px,
                          ),
                          decoration: BoxDecoration(
                            color: primaryColor.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(8.px),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.near_me,
                                size: 12.px,
                                color: primaryColor,
                              ),
                              SizedBox(width: 4.px),
                              Text(
                                '${distance.toStringAsFixed(1)} km',
                                style: MyTextStyle.titleStyle12b.copyWith(
                                  color: primaryColor,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                  _requestRideButton(item),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDriversPlaceholderState(BuildContext context) {
    final isDriversLoading = controller.isDriversLoading.value;
    final bool isServiceUnavailable =
        controller.isDriverServiceUnavailable.value;
    final String city = controller.parameter[ApiKeyConstants.city] ?? '';
    final String vehicleType = controller.selectedVehicleType;
    final String emptyMessage = city.isNotEmpty && vehicleType.isNotEmpty
        ? 'No online $vehicleType drivers in $city'
        : 'No online drivers in this place';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Container(
          width: 40,
          height: 6,
          margin: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: Colors.grey[400],
            borderRadius: BorderRadius.circular(10),
          ),
        ),
        Text(
          isDriversLoading
              ? 'Finding drivers...'
              : isServiceUnavailable
                  ? controller.driverServiceMessage.value
                  : emptyMessage,
          style: MyTextStyle.titleStyle18bb,
          textAlign: TextAlign.center,
        ),
        if (!isDriversLoading && isServiceUnavailable)
          TextButton.icon(
            onPressed: () => controller.callingGetAllDriverListApi(),
            icon: const Icon(Icons.refresh),
            label: const Text('Retry'),
          ),
        const Spacer(),
        Align(
          alignment: Alignment.bottomCenter,
          child: SizedBox(
            width: double.infinity,
            height: 30.px,
            child: AnimatedBuilder(
              animation: controller.animation,
              builder: (context, child) {
                final screenWidth = MediaQuery.of(context).size.width;
                const startPosition = 0.0;
                final endPosition = screenWidth - 52.0;
                final leftPosition = startPosition +
                    (endPosition - startPosition) * controller.animation.value;

                return Stack(
                  children: [
                    Positioned(
                      bottom: 0,
                      left: leftPosition,
                      child: CommonWidgets.appIcons(
                        assetName: controller
                            .vehicleIcons[controller.vehicleIndex.value],
                        width: 52.px,
                        height: 30.px,
                        color: Colors.black,
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
        ),
      ],
    );
  }
}
