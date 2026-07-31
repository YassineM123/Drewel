import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

import '../../../../common/colors.dart';
import '../../../data/apis/api_models/active_ride_model.dart';
import '../../communication/controllers/call_state_controller.dart';
import '../controllers/active_ride_controller.dart';
import '../widgets/active_ride_card.dart';
import '../widgets/ride_cancellation_dialog.dart';

class ActiveRideView extends GetView<ActiveRideController> {
  const ActiveRideView({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(
          title: const Text('Active ride'),
          actions: <Widget>[
            Obx(
              () => PopupMenuButton<String>(
                tooltip: 'More ride actions',
                onSelected: (String action) =>
                    _handleMenuAction(context, action),
                itemBuilder: (BuildContext context) => <PopupMenuEntry<String>>[
                  if (controller.status.canNormallyCancel)
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
              ),
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
                    'Offline — showing the last known ride. Actions will be '
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
    final RideCoordinateModel? driver =
        controller.currentPosition.value ?? ride.lastDriverLocation;
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
          icon: BitmapDescriptor.defaultMarkerWithHue(
            BitmapDescriptor.hueAzure,
          ),
        ),
    };
    final List<LatLng> points = controller.polylinePoints;
    return GoogleMap(
      initialCameraPosition: CameraPosition(
        target: initial?.isValid == true
            ? LatLng(initial!.latitude, initial.longitude)
            : const LatLng(25.2048, 55.2708),
        zoom: 14,
      ),
      onMapCreated: controller.attachMap,
      onCameraMoveStarted: () => controller.isFollowingDriver.value = false,
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
    );
  }
}

class _NavigationInstruction extends StatelessWidget {
  const _NavigationInstruction({required this.ride});

  final ActiveRideModel ride;

  @override
  Widget build(BuildContext context) {
    final ActiveRideController controller = Get.find<ActiveRideController>();
    final RideRouteModel? route = controller.route.value;
    final RideNavigationStepModel? step =
        route?.steps.isNotEmpty == true ? route!.steps.first : null;
    return Material(
      elevation: 5,
      color: primary3Color,
      borderRadius: BorderRadius.circular(14),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: <Widget>[
            const Icon(Icons.navigation_rounded, color: primaryColor),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    step?.instruction.trim().isNotEmpty == true
                        ? step!.instruction
                        : rideStatusLabel(ride.rideStatus),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  if (route != null)
                    Text('${route.distanceLabel} • ${route.etaLabel}'),
                  if (controller.routeError.value.isNotEmpty)
                    Text(
                      controller.routeError.value,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context)
                          .textTheme
                          .bodySmall
                          ?.copyWith(color: Colors.red.shade700),
                    ),
                ],
              ),
            ),
            IconButton(
              tooltip: 'Refresh route',
              onPressed: controller.isRouteLoading.value
                  ? null
                  : controller.refreshRoute,
              icon: controller.isRouteLoading.value
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
  }
}

class _RideActionSheet extends StatelessWidget {
  const _RideActionSheet({required this.ride});

  final ActiveRideModel ride;

  @override
  Widget build(BuildContext context) {
    final ActiveRideController controller = Get.find<ActiveRideController>();
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
        elevation: 10,
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
                        Text(
                          rideStatusLabel(ride.rideStatus),
                          style: Theme.of(context)
                              .textTheme
                              .titleMedium
                              ?.copyWith(fontWeight: FontWeight.w700),
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
              if (!driver &&
                  ride.rideStatus == RideStatus.driverArrived &&
                  ride.pickupPin?.isNotEmpty == true) ...<Widget>[
                const SizedBox(height: 10),
                Semantics(
                  label: 'Pickup PIN ${ride.pickupPin}',
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: primaryColor.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      'Pickup PIN: ${ride.pickupPin}',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            fontWeight: FontWeight.w800,
                            letterSpacing: 4,
                          ),
                    ),
                  ),
                ),
              ],
              if (action != null) ...<Widget>[
                const SizedBox(height: 12),
                SizedBox(
                  height: 48,
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
  }

  Future<void> _performAction(
    BuildContext context,
    RideStatus status,
  ) async {
    final ActiveRideController controller = Get.find<ActiveRideController>();
    String? pin;
    if (status == RideStatus.driverArrived) {
      final TextEditingController pinController = TextEditingController();
      pin = await showDialog<String>(
        context: context,
        builder: (BuildContext dialogContext) => AlertDialog(
          title: const Text('Verify pickup'),
          content: TextField(
            controller: pinController,
            autofocus: true,
            keyboardType: TextInputType.number,
            maxLength: 4,
            obscureText: true,
            decoration: const InputDecoration(
              labelText: 'Four-digit pickup PIN',
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
                if (RegExp(r'^\d{4}$').hasMatch(pinController.text)) {
                  Navigator.pop(dialogContext, pinController.text);
                }
              },
              child: const Text('Verify'),
            ),
          ],
        ),
      );
      pinController.dispose();
      if (pin == null) return;
    }
    final bool success = await controller.performPrimaryAction(pickupPin: pin);
    if (!success && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(controller.errorMessage.value)),
      );
    }
  }
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
