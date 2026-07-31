import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../routes/app_pages.dart';
import '../controllers/call_state_controller.dart';

class DriverRideRequestsPanel extends GetView<CallStateController> {
  const DriverRideRequestsPanel({super.key});

  @override
  Widget build(BuildContext context) => Obx(() {
        final ride = controller.activeRide.value;
        if (ride == null || ride.status != 'contacting') {
          return const SizedBox.shrink();
        }
        return Material(
          elevation: 6,
          child: Padding(
            padding: const EdgeInsets.all(10),
            child: Row(
              children: <Widget>[
                const Icon(Icons.person_pin_circle_outlined),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'points.waiting_offer'.trParams({
                      'name': ride.passenger?.firstName ?? 'Passenger',
                    }),
                  ),
                ),
                SizedBox(
                  height: 48,
                  child: FilledButton.icon(
                    onPressed: () => Get.toNamed(Routes.RIDE_CHAT),
                    icon: const Icon(Icons.local_offer_outlined),
                    label: Text('points.send_trip_offer'.tr),
                  ),
                ),
              ],
            ),
          ),
        );
      });
}
