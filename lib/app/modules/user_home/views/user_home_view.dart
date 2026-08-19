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
import '../../../../common/drewel_osm_map.dart';
import '../../../../common/drewel_web_map_fallback.dart';
import '../../../../common/drewel_navigation.dart';
import '../../../../common/drewel_pop_scope.dart';
import '../../../../common/text_styles.dart';
import '../../../data/constants/icons_constant.dart';
import '../../../data/constants/string_constants.dart';
import '../../../routes/app_pages.dart';
import '../controllers/user_home_controller.dart';
import '../../communication/controllers/call_state_controller.dart';
import '../../communication/widgets/secure_communication_panel.dart';
import '../../messages/widgets/messages_app_bar_button.dart';
import '../../notification/widgets/notification_app_bar_button.dart';
import '../widgets/location_search_bar.dart';
import '../widgets/marketplace_driver_card.dart';
import '../../active_ride/widgets/active_ride_card.dart';

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

  List<DrewelOsmMarker> _openStreetMapMarkers() {
    final List<DrewelOsmMarker> result = <DrewelOsmMarker>[];
    if (controller.hasReferenceLocation) {
      result.add(DrewelOsmMarker(
        id: 'reference_location',
        position: controller.referenceLocation,
        child: const Material(
          color: Colors.transparent,
          child: Icon(Icons.location_pin, color: primaryColor, size: 42),
        ),
      ));
    }
    for (int index = 0; index < controller.driversList.length; index++) {
      final Drivers driver = controller.driversList[index];
      final double? latitude = double.tryParse(driver.lat?.toString() ?? '');
      final double? longitude = double.tryParse(driver.long?.toString() ?? '');
      if (latitude == null || longitude == null) continue;
      result.add(DrewelOsmMarker(
        id: 'driver-${driver.sId ?? index}',
        position: LatLng(latitude, longitude),
        onTap: () => controller.clickOnDriverIndex(index),
        child: Material(
          color: Colors.white,
          elevation: controller.selectIndex == index ? 6 : 2,
          shape: const CircleBorder(),
          child: Icon(
            Icons.local_shipping,
            color:
                controller.selectIndex == index ? primaryColor : Colors.black87,
            size: 28,
          ),
        ),
      ));
    }
    return result;
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
    final double screenHeight = MediaQuery.of(context).size.height - 120.px;
    // Only the map/search/sheet region needs to react to controller state;
    // keeping the Scaffold's AppBar/Drawer construction outside any Obx means
    // frequent map-only updates (driver marker animation, socket pings, place
    // search keystrokes) no longer force the whole screen chrome to rebuild.
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
              actions: const <Widget>[
                NotificationAppBarButton(),
                MessagesAppBarButton(),
                SizedBox(width: 4),
              ],
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
            endDrawer: Obx(
              () => CustomDrawer(
                userData: Map<String, String>.from(controller.userData),
              ),
            ),
            resizeToAvoidBottomInset: false,
            backgroundColor: primaryColor,
            bottomNavigationBar: Obx(() {
              final CallStateController communication =
                  Get.find<CallStateController>();
              final String? status = communication.activeRide.value?.status;
              return Column(
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  const ActiveRideCard(),
                  if (status != null && status != 'contacting')
                    const SecureCommunicationPanel(),
                ],
              );
            }),
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
                        // Watches count + mapRevision only: marker-animation
                        // ticks (mapRevision) rebuild just this map region,
                        // never the search bar or the driver sheet below.
                        Obx(() {
                          controller.count.value;
                          controller.mapRevision.value;
                          final double mapHeight =
                              screenHeight * (1 - controller.sheetSize.value);
                          return Container(
                            width: MediaQuery.of(context).size.width,
                            height: mapHeight,
                            padding: EdgeInsets.only(top: 0.px),
                            child: DrewelWebMapFallback(
                              openStreetMap: DrewelOsmMap(
                                center: controller.mapPosition,
                                markers: _openStreetMapMarkers(),
                                polylines: controller.polylines
                                    .map((Polyline line) => line.points)
                                    .toList(growable: false),
                                onTap: controller.setSelectedLocation,
                                onCenterChanged:
                                    controller.onAlternativeMapMove,
                              ),
                              googleMap: GoogleMap(
                                mapType: MapType.normal,
                                zoomGesturesEnabled: true,
                                tiltGesturesEnabled: true,
                                myLocationButtonEnabled: false,
                                markers: controller.markers,
                                // A finger drag/zoom starts here; a
                                // programmatic animateCamera call also
                                // triggers this, so the controller tells
                                // the two apart via its own guard.
                                onCameraMoveStarted:
                                    controller.onCameraMoveStarted,
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
                                onMapCreated: (GoogleMapController
                                    googlecontroller) async {
                                  await controller
                                      .onMapCreated(googlecontroller);
                                },
                              ),
                            ),
                          );
                        }),
                        // Distance Card - Shows when driver is selected
                        Obx(() {
                          controller.count.value;
                          if (controller.selectIndex >= 0 &&
                              controller.hasReferenceLocation &&
                              controller.selectedDriverDistance.value > 0) {
                            return Positioned(
                              top: 80.px,
                              left: 20.px,
                              child: _buildDistancePopup(context),
                            );
                          }
                          return const SizedBox.shrink();
                        }),
                        Positioned(
                          top: 20.px,
                          left: 16,
                          right: 16,
                          child: Align(
                            alignment: Alignment.topCenter,
                            child: ConstrainedBox(
                              constraints: const BoxConstraints(maxWidth: 720),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Expanded(
                                    child: LocationSearchBar(
                                      controller: controller,
                                    ),
                                  ),
                                  SizedBox(width: 10.px),
                                  const Padding(
                                    padding: EdgeInsets.only(top: 4),
                                    child: _LocationButton(),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                        // Driver list only needs `count` (never mapRevision):
                        // live marker-position animation must not re-render
                        // the sheet/list of driver cards.
                        Obx(() {
                          controller.count.value;
                          controller.sheetSize.value;
                          return showDriverList();
                        }),
                      ],
                    ),
                  ),
                ),
              ],
            )),
      );
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
                ? SingleChildScrollView(
                    controller: scrollController,
                    physics: const ClampingScrollPhysics(),
                    child: _buildDriversPlaceholderState(context),
                  )
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
            color: Colors.black.withValues(alpha: 0.12),
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
              color: primaryColor.withValues(alpha: 0.10),
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
                color: primaryColor.withValues(alpha: 0.10),
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
    if (item.sId?.trim().isNotEmpty == true) {
      return Padding(
        padding: EdgeInsets.symmetric(vertical: 5.px),
        child: _marketplaceCard(context, item, index, selected: true),
      );
    }
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
          ],
        ),
      ),
    );
  }

  Widget _buildDriverCard(BuildContext context, Drivers item, int index) {
    if (item.sId?.trim().isNotEmpty == true) {
      return Padding(
        padding: EdgeInsets.symmetric(vertical: 5.px),
        child: _marketplaceCard(context, item, index),
      );
    }
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
            color: Colors.black.withValues(alpha: 0.1),
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
                            color: primaryColor.withValues(alpha: 0.1),
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
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _marketplaceCard(
    BuildContext context,
    Drivers driver,
    int index, {
    bool selected = false,
  }) {
    final CallStateController communication = Get.find<CallStateController>();
    final double calculatedDistance = controller.getDistanceFromUser(driver);
    final double? distance =
        calculatedDistance.isFinite && calculatedDistance >= 0
            ? calculatedDistance
            : null;
    return Obx(
      () => MarketplaceDriverCard(
        driver: driver,
        selected: selected,
        distanceKm: distance,
        index: index,
        actionsLoading: communication.contactingDriverId.value == driver.sId,
        onTap: () => controller.clickOnDriverIndex(index),
        onChat: driver.canChat
            ? () => _requestTripFromDriver(context, driver, communication)
            : null,
      ),
    );
  }

  Future<void> _requestTripFromDriver(
    BuildContext context,
    Drivers driver,
    CallStateController communication,
  ) async {
    await communication.openDriverChat(driver.sId ?? '');
  }

  Widget _buildDriversPlaceholderState(BuildContext context) {
    final isDriversLoading = controller.isDriversLoading.value;
    final bool isServiceUnavailable =
        controller.isDriverServiceUnavailable.value;
    final String city = controller.selectedMarketplaceCity;
    final String vehicleType = controller.selectedVehicleType;
    final String vehicleLabel =
        vehicleType.isNotEmpty ? vehicleType : 'drivers';
    final String placeLabel = city.isNotEmpty ? ' in $city' : '';
    final String emptyMessage = 'No $vehicleLabel available nearby$placeLabel';

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
              ? 'Finding nearby $vehicleLabel...'
              : isServiceUnavailable
                  ? (controller.driverServiceMessage.value.isNotEmpty
                      ? controller.driverServiceMessage.value
                      : 'You\'re offline. Reconnecting...')
                  : emptyMessage,
          style: MyTextStyle.titleStyle18bb,
          textAlign: TextAlign.center,
        ),
        if (!isDriversLoading && isServiceUnavailable)
          TextButton.icon(
            onPressed: controller.retryDriverDiscovery,
            icon: const Icon(Icons.refresh),
            label: const Text('Retry'),
          ),
        const SizedBox(height: 8),
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

/// Round crosshair button that centres the map on the user's current position.
/// Kept separate from the search field so it never overlaps the search bar.
class _LocationButton extends StatelessWidget {
  const _LocationButton();

  @override
  Widget build(BuildContext context) {
    final UserHomeController controller = Get.find<UserHomeController>();
    return Obx(() {
      final bool hasLocation = controller.isUserLocationLoaded.value;
      final bool loading = controller.isFetchingUserLocation.value;
      return Semantics(
        button: true,
        label: 'Current location',
        child: GestureDetector(
          onTap: controller.handleGoToUserLocation,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              color: Colors.white,
              shape: BoxShape.circle,
              border: Border.all(
                color: hasLocation
                    ? primaryColor
                    : Colors.black.withValues(alpha: 0.08),
                width: hasLocation ? 1.5 : 1,
              ),
              boxShadow: const <BoxShadow>[
                BoxShadow(
                  color: Colors.black26,
                  blurRadius: 8,
                  offset: Offset(0, 2),
                ),
              ],
            ),
            alignment: Alignment.center,
            child: loading
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.2,
                      color: primaryColor,
                    ),
                  )
                : Icon(
                    hasLocation
                        ? Icons.my_location
                        : Icons.location_searching_rounded,
                    color: hasLocation ? primaryColor : Colors.black45,
                    size: 22,
                  ),
          ),
        ),
      );
    });
  }
}
