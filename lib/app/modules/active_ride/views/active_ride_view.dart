import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

import '../../../../common/colors.dart';
import '../../../../common/drewel_app_bar.dart';
import '../../../../common/drewel_osm_map.dart';
import '../../../../common/drewel_web_map_fallback.dart';
import '../../../../common/motion.dart';
import '../../../../common/vehicle_assets.dart';
import '../../../data/apis/api_models/active_ride_model.dart';
import '../../communication/controllers/call_state_controller.dart';
import '../controllers/active_ride_controller.dart';
import '../widgets/active_ride_card.dart';
import '../widgets/ride_cancellation_dialog.dart';

class ActiveRideView extends GetView<ActiveRideController> {
  const ActiveRideView({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: const Color(0xFFFCFCFC),
        appBar: DrewelAppBar(
          title: 'Active ride',
          showBackButton: true,
          actions: <Widget>[
            Obx(
              () {
                final RideStatus status = controller.status;
                return PopupMenuButton<String>(
                  tooltip: 'More ride actions',
                  onSelected: (String action) =>
                      _handleMenuAction(context, action),
                  itemBuilder: (BuildContext context) =>
                      <PopupMenuEntry<String>>[
                    if (status.canNormallyCancel)
                      const PopupMenuItem<String>(
                        value: 'cancel',
                        child: ListTile(
                          leading: Icon(Icons.cancel_outlined),
                          title: Text('Cancel ride'),
                          contentPadding: EdgeInsets.zero,
                        ),
                      ),
                    const PopupMenuItem<String>(
                      value: 'report',
                      child: ListTile(
                        leading: Icon(Icons.report_problem_outlined),
                        title: Text('Report a problem'),
                        contentPadding: EdgeInsets.zero,
                      ),
                    ),
                  ],
                );
              },
            ),
          ],
        ),
        body: Obx(() {
          final ActiveRideModel? ride = controller.ride.value;
          if (controller.isLoading.value && ride == null) {
            return const Center(child: CircularProgressIndicator());
          }
          if (ride == null) {
            return _NoActiveRide(
              message: controller.errorMessage.value,
              onRetry: controller.recover,
            );
          }
          return Column(
            children: <Widget>[
              if (controller.isOffline.value)
                MaterialBanner(
                  leading: const Icon(Icons.cloud_off_rounded),
                  content: const Text(
                    'Offline - showing the last known ride. Actions will be '
                    'available when the connection returns.',
                  ),
                  actions: <Widget>[
                    TextButton(
                      onPressed: () => controller.recover(showLoader: false),
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              Expanded(
                child: Stack(
                  children: <Widget>[
                    _RideMap(ride: ride),
                    PositionedDirectional(
                      top: 12,
                      start: 12,
                      end: 12,
                      child: _NavigationInstruction(ride: ride),
                    ),
                    PositionedDirectional(
                      end: 12,
                      bottom: 12,
                      child: Column(
                        children: <Widget>[
                          FloatingActionButton.small(
                            heroTag: 'route-overview',
                            tooltip: 'Route overview',
                            onPressed: controller.fitRouteOverview,
                            child: const Icon(Icons.route_rounded),
                          ),
                          const SizedBox(height: 10),
                          FloatingActionButton.small(
                            heroTag: 'ride-recenter',
                            tooltip: 'Recenter',
                            onPressed: controller.recenter,
                            child: const Icon(Icons.my_location_rounded),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              _RideActionSheet(ride: ride),
            ],
          );
        }),
      );

  Future<void> _handleMenuAction(
    BuildContext context,
    String action,
  ) async {
    if (action == 'cancel') {
      final RideCancellationResult? result =
          await showRideCancellationDialog(context);
      if (result == null || !context.mounted) return;
      final bool success = await controller.cancel(
        reason: result.reason,
        note: result.note,
      );
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              success ? 'Ride cancelled.' : controller.errorMessage.value,
            ),
          ),
        );
      }
      return;
    }
    final TextEditingController reason = TextEditingController();
    final String? submitted = await showDialog<String>(
      context: context,
      builder: (BuildContext dialogContext) => AlertDialog(
        title: const Text('Report a problem'),
        content: TextField(
          controller: reason,
          maxLength: 500,
          maxLines: 4,
          decoration: const InputDecoration(
            hintText: 'Describe what happened',
            border: OutlineInputBorder(),
          ),
        ),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Back'),
          ),
          FilledButton(
            onPressed: () {
              if (reason.text.trim().isNotEmpty) {
                Navigator.pop(dialogContext, reason.text.trim());
              }
            },
            child: const Text('Submit'),
          ),
        ],
      ),
    );
    reason.dispose();
    if (submitted != null) await controller.reportProblem(submitted);
  }
}

class _RideMap extends StatelessWidget {
  const _RideMap({required this.ride});

  final ActiveRideModel ride;

  @override
  Widget build(BuildContext context) {
    final ActiveRideController controller = Get.find<ActiveRideController>();
    return Obx(() {
      controller.driverVehicleMarkerVersion.value;
      final RideCoordinateModel? driver =
          controller.currentPosition.value ?? ride.lastDriverLocation;
      final String driverMarkerAsset = vehicleMarkerAssetPath(ride.vehicleType);
      final RideCoordinateModel? initial = driver?.isValid == true
          ? driver
          : ride.pickup?.isValid == true
              ? ride.pickup
              : ride.destination;
      final Set<Marker> markers = <Marker>{
        if (ride.pickup?.isValid == true)
          Marker(
            markerId: const MarkerId('pickup'),
            position: LatLng(ride.pickup!.latitude, ride.pickup!.longitude),
            infoWindow: const InfoWindow(title: 'Pickup'),
            icon: BitmapDescriptor.defaultMarkerWithHue(
              BitmapDescriptor.hueGreen,
            ),
          ),
        if (ride.destination?.isValid == true)
          Marker(
            markerId: const MarkerId('destination'),
            position: LatLng(
              ride.destination!.latitude,
              ride.destination!.longitude,
            ),
            infoWindow: const InfoWindow(title: 'Destination'),
          ),
        if (driver?.isValid == true)
          Marker(
            markerId: const MarkerId('driver'),
            position: LatLng(driver!.latitude, driver.longitude),
            infoWindow: const InfoWindow(title: 'Driver'),
            icon: controller.driverVehicleMarkerFor(ride.vehicleType),
            anchor: const Offset(0.5, 0.5),
            flat: true,
            rotation: _driverMarkerRotation(driver),
            zIndex: 3,
          ),
      };
      final List<LatLng> points = controller.polylinePoints;
      final LatLng center = initial?.isValid == true
          ? LatLng(initial!.latitude, initial.longitude)
          : const LatLng(25.2048, 55.2708);
      return DrewelWebMapFallback(
        openStreetMap: DrewelOsmMap(
          center: center,
          zoom: 14,
          polylines:
              points.isEmpty ? const <List<LatLng>>[] : <List<LatLng>>[points],
          markers: <DrewelOsmMarker>[
            if (ride.pickup?.isValid == true)
              DrewelOsmMarker(
                id: 'pickup',
                position: LatLng(ride.pickup!.latitude, ride.pickup!.longitude),
                child: const Icon(
                  Icons.radio_button_checked,
                  color: Colors.green,
                  size: 36,
                ),
              ),
            if (ride.destination?.isValid == true)
              DrewelOsmMarker(
                id: 'destination',
                position: LatLng(
                  ride.destination!.latitude,
                  ride.destination!.longitude,
                ),
                child: const Icon(
                  Icons.location_on,
                  color: primaryColor,
                  size: 40,
                ),
              ),
            if (driver?.isValid == true)
              DrewelOsmMarker(
                id: 'driver',
                position: LatLng(driver!.latitude, driver.longitude),
                width: 58,
                height: 58,
                child: Transform.rotate(
                  angle: _driverMarkerRadians(driver),
                  child: Image.asset(
                    driverMarkerAsset,
                    fit: BoxFit.contain,
                    errorBuilder: (_, __, ___) => const Icon(
                      Icons.local_shipping,
                      color: primaryColor,
                      size: 34,
                    ),
                  ),
                ),
              ),
          ],
        ),
        googleMap: GoogleMap(
          initialCameraPosition: CameraPosition(
            target: center,
            zoom: 14,
          ),
          onMapCreated: controller.attachMap,
          onCameraMoveStarted: controller.handleMapMoveStarted,
          myLocationEnabled: controller.isDriver,
          myLocationButtonEnabled: false,
          compassEnabled: true,
          markers: markers,
          polylines: points.isEmpty
              ? const <Polyline>{}
              : <Polyline>{
                  Polyline(
                    polylineId: const PolylineId('active-ride-route'),
                    points: points,
                    color: primaryColor,
                    width: 6,
                    startCap: Cap.roundCap,
                    endCap: Cap.roundCap,
                    jointType: JointType.round,
                  ),
                },
        ),
      );
    });
  }

  double _driverMarkerRotation(RideCoordinateModel driver) {
    final double? heading = driver.heading;
    if (heading == null || !heading.isFinite) return 0;
    return heading % 360;
  }

  double _driverMarkerRadians(RideCoordinateModel driver) =>
      _driverMarkerRotation(driver) * math.pi / 180;
}

class _NavigationInstruction extends StatelessWidget {
  const _NavigationInstruction({required this.ride});

  final ActiveRideModel ride;

  @override
  Widget build(BuildContext context) {
    final ActiveRideController controller = Get.find<ActiveRideController>();
    return Obx(() {
      final RideRouteModel? route = controller.route.value;
      final String routeError = controller.routeError.value;
      final bool loading = controller.isRouteLoading.value;
      final String supportingText = route != null
          ? '${route.distanceLabel} - ${route.etaLabel}'
          : _friendlyRouteStatus(
              routeError,
              loading: loading,
              ride: ride,
            );
      final Color supportingColor =
          route != null || loading || _isExpectedRouteWait(routeError)
              ? text2Color
              : Colors.red.shade700;
      return Material(
        elevation: 2,
        shadowColor: Colors.black.withValues(alpha: 0.08),
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            children: <Widget>[
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: primaryColor.withValues(alpha: 0.08),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.navigation_rounded,
                  color: primaryColor,
                  size: 22,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      rideStatusLabel(ride.rideStatus),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      supportingText,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context)
                          .textTheme
                          .bodySmall
                          ?.copyWith(color: supportingColor),
                    ),
                  ],
                ),
              ),
              IconButton(
                tooltip: 'Refresh route',
                onPressed: loading ? null : controller.refreshRoute,
                icon: loading
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.refresh_rounded),
              ),
            ],
          ),
        ),
      );
    });
  }

  bool _isExpectedRouteWait(String message) {
    final String value = message.toLowerCase();
    return value.isEmpty ||
        value.contains('driver location') ||
        value.contains('google routes');
  }

  String _friendlyRouteStatus(
    String message, {
    required bool loading,
    required ActiveRideModel ride,
  }) {
    if (loading) return 'Finding best route';
    final String value = message.toLowerCase();
    if (value.contains('driver location')) {
      return 'Waiting for live driver location';
    }
    if (value.contains('google routes')) {
      return 'Finding best route';
    }
    if (message.trim().isNotEmpty) return message.trim();
    return ride.rideStatus == RideStatus.inProgress
        ? 'Live route to destination'
        : 'Live route to pickup';
  }
}

class _RideActionSheet extends StatelessWidget {
  const _RideActionSheet({required this.ride});

  final ActiveRideModel ride;

  @override
  Widget build(BuildContext context) {
    final ActiveRideController controller = Get.find<ActiveRideController>();
    return Obx(() {
      final bool driver = controller.isDriver;
      final String? action = driver
          ? switch (ride.rideStatus) {
              RideStatus.confirmed => 'Start navigation to pickup',
              RideStatus.driverOnTheWay => 'I have arrived',
              RideStatus.driverArrived => 'Verify pickup PIN',
              RideStatus.pickupConfirmed => 'Start ride',
              RideStatus.inProgress => 'Complete ride',
              _ => null,
            }
          : null;
      return SafeArea(
        top: false,
        child: Material(
          color: primary3Color,
          elevation: 0,
          shape: Border(
            top: BorderSide(color: primaryColor.withValues(alpha: 0.12)),
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                Row(
                  children: <Widget>[
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          AnimatedSwitcher(
                            duration: MotionDuration.normal,
                            switchInCurve: MotionCurve.enter,
                            transitionBuilder: (child, animation) =>
                                FadeTransition(
                              opacity: animation,
                              child: SlideTransition(
                                position: Tween<Offset>(
                                  begin: const Offset(0, 0.15),
                                  end: Offset.zero,
                                ).animate(animation),
                                child: child,
                              ),
                            ),
                            child: Text(
                              rideStatusLabel(ride.rideStatus),
                              key: ValueKey<RideStatus>(ride.rideStatus),
                              style: Theme.of(context)
                                  .textTheme
                                  .titleMedium
                                  ?.copyWith(fontWeight: FontWeight.w700),
                            ),
                          ),
                          Text(
                            controller.routePhase == 'destination'
                                ? ride.destination?.address ?? 'Destination'
                                : ride.pickup?.address ?? 'Pickup',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: <Widget>[
                        IconButton(
                          tooltip: 'Message ride participant',
                          onPressed: ride.canCommunicate &&
                                  Get.isRegistered<CallStateController>()
                              ? Get.find<CallStateController>().openRideChat
                              : null,
                          icon: const Icon(Icons.message_rounded),
                        ),
                      ],
                    ),
                  ],
                ),
                if (!driver &&
                    ride.rideStatus == RideStatus.driverArrived &&
                    ride.pickupPin?.isNotEmpty == true) ...<Widget>[
                  const SizedBox(height: 10),
                  FadeSlideIn(
                    child: Semantics(
                      label: 'Pickup PIN ${ride.pickupPin}',
                      child: Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: primaryColor.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(
                          'Pickup PIN: ${ride.pickupPin}',
                          textAlign: TextAlign.center,
                          style:
                              Theme.of(context).textTheme.titleLarge?.copyWith(
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: 0,
                                  ),
                        ),
                      ),
                    ),
                  ),
                ],
                if (action != null) ...<Widget>[
                  const SizedBox(height: 12),
                  SizedBox(
                    height: 48,
                    child: AnimatedPressable(
                      onTap: controller.isActionLoading.value ||
                              controller.isOffline.value
                          ? null
                          : () => _performAction(context, ride.rideStatus),
                      child: FilledButton(
                        onPressed: controller.isActionLoading.value ||
                                controller.isOffline.value
                            ? null
                            : () => _performAction(context, ride.rideStatus),
                        child: controller.isActionLoading.value
                            ? const SizedBox.square(
                                dimension: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : Text(action),
                      ),
                    ),
                  ),
                ] else if (ride.rideStatus ==
                    RideStatus.driverArrived) ...<Widget>[
                  const SizedBox(height: 10),
                  const Text(
                    'The driver is waiting for pickup confirmation.',
                    textAlign: TextAlign.center,
                  ),
                ],
                if (controller.errorMessage.value.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(
                      controller.errorMessage.value,
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.red.shade700),
                    ),
                  ),
              ],
            ),
          ),
        ),
      );
    });
  }

  Future<void> _performAction(
    BuildContext context,
    RideStatus status,
  ) async {
    HapticFeedback.lightImpact();
    final ActiveRideController controller = Get.find<ActiveRideController>();
    String? pin;
    if (status == RideStatus.driverArrived) {
      pin = await showDialog<String>(
        context: context,
        builder: (BuildContext dialogContext) => const _PickupPinDialog(),
      );
      if (pin == null) return;
    }
    final bool success = await controller.performPrimaryAction(pickupPin: pin);
    if (!context.mounted) return;
    if (success) HapticFeedback.mediumImpact();
    if (success && status == RideStatus.inProgress) {
      final ActiveRideModel? completedRide = controller.lastCompletedRide.value;
      if (completedRide != null &&
          !_hasSubmittedReview(controller, completedRide)) {
        await showModalBottomSheet<bool>(
          context: context,
          isScrollControlled: true,
          useSafeArea: true,
          builder: (BuildContext sheetContext) =>
              _RideReviewSheet(ride: completedRide),
        );
      }
      if (!context.mounted) return;
      Get.offAllNamed(controller.homeRoute);
      return;
    }
    if (!success) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(controller.errorMessage.value)),
      );
    }
  }

  bool _hasSubmittedReview(
    ActiveRideController controller,
    ActiveRideModel ride,
  ) =>
      controller.isDriver
          ? ride.driverReview != null
          : ride.passengerReview != null;
}

class _RideReviewSheet extends StatefulWidget {
  const _RideReviewSheet({required this.ride});

  final ActiveRideModel ride;

  @override
  State<_RideReviewSheet> createState() => _RideReviewSheetState();
}

class _RideReviewSheetState extends State<_RideReviewSheet> {
  final TextEditingController _commentController = TextEditingController();
  int _rating = 5;

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ActiveRideController controller = Get.find<ActiveRideController>();
    final bool reviewingPassenger = controller.isDriver;
    final RideParticipantModel? participant =
        reviewingPassenger ? widget.ride.passenger : widget.ride.driver;
    final String name = participant?.firstName.trim().isNotEmpty == true
        ? participant!.firstName
        : reviewingPassenger
            ? 'Passenger'
            : 'Driver';
    final EdgeInsets keyboard = MediaQuery.viewInsetsOf(context);
    return Padding(
      padding: EdgeInsets.only(bottom: keyboard.bottom),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              Row(
                children: <Widget>[
                  Expanded(
                    child: Text(
                      'Review $name',
                      style: Theme.of(context)
                          .textTheme
                          .titleLarge
                          ?.copyWith(fontWeight: FontWeight.w800),
                    ),
                  ),
                  IconButton(
                    tooltip: 'Close',
                    onPressed: () => Navigator.of(context).pop(false),
                    icon: const Icon(Icons.close_rounded),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List<Widget>.generate(
                  5,
                  (int index) {
                    final int value = index + 1;
                    return IconButton(
                      tooltip: '$value star${value == 1 ? '' : 's'}',
                      onPressed: () => setState(() => _rating = value),
                      icon: Icon(
                        value <= _rating
                            ? Icons.star_rounded
                            : Icons.star_border_rounded,
                        color: amberColor,
                        size: 34,
                      ),
                    );
                  },
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _commentController,
                maxLength: 500,
                maxLines: 4,
                decoration: const InputDecoration(
                  labelText: 'Comment',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 8),
              Obx(
                () => SizedBox(
                  height: 48,
                  child: FilledButton(
                    onPressed: controller.isActionLoading.value
                        ? null
                        : () => _submit(context, controller),
                    child: controller.isActionLoading.value
                        ? const SizedBox.square(
                            dimension: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Text('Submit review'),
                  ),
                ),
              ),
              TextButton(
                onPressed: () => Navigator.of(context).pop(false),
                child: const Text('Skip'),
              ),
              Obx(
                () => controller.errorMessage.value.isEmpty
                    ? const SizedBox.shrink()
                    : Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          controller.errorMessage.value,
                          textAlign: TextAlign.center,
                          style: TextStyle(color: Colors.red.shade700),
                        ),
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _submit(
    BuildContext context,
    ActiveRideController controller,
  ) async {
    final bool success = await controller.submitReview(
      completedRide: widget.ride,
      rating: _rating,
      comment: _commentController.text,
    );
    if (success && context.mounted) {
      Navigator.of(context).pop(true);
    }
  }
}

class _PickupPinDialog extends StatefulWidget {
  const _PickupPinDialog();

  @override
  State<_PickupPinDialog> createState() => _PickupPinDialogState();
}

class _PickupPinDialogState extends State<_PickupPinDialog> {
  final TextEditingController _pinController = TextEditingController();

  bool get _valid => RegExp(r'^\d{4}$').hasMatch(_pinController.text);

  @override
  void dispose() {
    _pinController.dispose();
    super.dispose();
  }

  void _submit() {
    if (!_valid) return;
    Navigator.of(context).pop(_pinController.text);
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: const Text('Verify pickup'),
        content: TextField(
          controller: _pinController,
          autofocus: true,
          keyboardType: TextInputType.number,
          maxLength: 4,
          obscureText: true,
          onChanged: (_) => setState(() {}),
          onSubmitted: (_) => _submit(),
          decoration: const InputDecoration(
            labelText: 'Four-digit pickup PIN',
            border: OutlineInputBorder(),
          ),
        ),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Back'),
          ),
          FilledButton(
            onPressed: _valid ? _submit : null,
            child: const Text('Verify'),
          ),
        ],
      );
}

class _NoActiveRide extends StatelessWidget {
  const _NoActiveRide({required this.message, required this.onRetry});

  final String message;
  final Future<void> Function({bool showLoader}) onRetry;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              const Icon(Icons.route_outlined, size: 52),
              const SizedBox(height: 12),
              Text(
                message.isEmpty ? 'No active ride.' : message,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('Refresh'),
              ),
            ],
          ),
        ),
      );
}
