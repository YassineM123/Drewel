import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../../common/colors.dart';
import '../../../../common/motion.dart';
import '../../../data/apis/api_models/active_ride_model.dart';
import '../../../routes/app_pages.dart';
import '../controllers/active_ride_controller.dart';

class ActiveRideCard extends GetView<ActiveRideController> {
  const ActiveRideCard({super.key});

  @override
  Widget build(BuildContext context) => Obx(() {
        final ActiveRideModel? ride = controller.ride.value;
        if (ride == null || !ride.isRecoverable) {
          return const SizedBox.shrink();
        }
        return FadeSlideIn(
          child: SafeArea(
          top: false,
          child: Material(
            color: primary3Color,
            elevation: 0,
            shape: Border(
              top: BorderSide(color: primaryColor.withValues(alpha: 0.12)),
            ),
            child: AnimatedPressable(
              onTap: () => Get.toNamed(Routes.ACTIVE_RIDE),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 10,
                ),
                child: Row(
                  children: <Widget>[
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: primaryColor.withValues(alpha: 0.12),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.navigation_rounded,
                        color: primaryColor,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
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
                                  .titleSmall
                                  ?.copyWith(fontWeight: FontWeight.w700),
                            ),
                          ),
                          Text(
                            ride.reference?.trim().isNotEmpty == true
                                ? 'Ride ${ride.reference}'
                                : 'Your active ride',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ],
                      ),
                    ),
                    if (controller.isOffline.value)
                      const Padding(
                        padding: EdgeInsets.only(right: 8),
                        child: Tooltip(
                          message: 'Offline - showing last known ride status',
                          child: Icon(Icons.cloud_off_rounded, size: 20),
                        ),
                      ),
                    const Text(
                      'Resume',
                      style: TextStyle(
                        color: primaryColor,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(width: 4),
                    const Icon(Icons.chevron_right_rounded,
                        color: primaryColor),
                  ],
                ),
              ),
            ),
          ),
          ),
        );
      });
}

String rideStatusLabel(RideStatus status) => switch (status) {
      RideStatus.contacting => 'Contacting driver',
      RideStatus.offerPending => 'Offer pending',
      RideStatus.confirmed => 'Ride confirmed',
      RideStatus.driverOnTheWay => 'Driver on the way',
      RideStatus.driverArrived => 'Driver arrived',
      RideStatus.pickupConfirmed => 'Pickup confirmed',
      RideStatus.inProgress => 'Ride in progress',
      RideStatus.completed => 'Ride completed',
      RideStatus.cancelledByUser => 'Cancelled by passenger',
      RideStatus.cancelledByDriver => 'Cancelled by driver',
      RideStatus.cancelledByAdmin => 'Cancelled by support',
      RideStatus.disputed => 'Under review',
      RideStatus.unknown => 'Ride status unavailable',
    };
