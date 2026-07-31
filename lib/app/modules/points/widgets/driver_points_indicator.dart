import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../../common/colors.dart';
import '../../../routes/app_pages.dart';
import '../controllers/driver_points_controller.dart';

class DriverPointsIndicator extends GetView<DriverPointsController> {
  const DriverPointsIndicator({super.key});

  @override
  Widget build(BuildContext context) => Obx(() {
        final wallet = controller.wallet.value;
        final state = controller.state.value;
        final String label;
        final Color foreground;
        final IconData icon;
        if (state == PointsLoadState.loading ||
            state == PointsLoadState.initial) {
          label = 'points.loading'.tr;
          foreground = Colors.black54;
          icon = Icons.hourglass_top_rounded;
        } else if (state == PointsLoadState.offline) {
          label = 'points.offline'.tr;
          foreground = Colors.black54;
          icon = Icons.cloud_off_rounded;
        } else if (state == PointsLoadState.error || wallet == null) {
          label = 'points.error'.tr;
          foreground = primaryColor;
          icon = Icons.error_outline_rounded;
        } else if (wallet.balanceState == 'zero') {
          label = '${wallet.availablePoints} · ${'points.zero'.tr}';
          foreground = primaryColor;
          icon = Icons.toll_rounded;
        } else if (wallet.balanceState == 'low') {
          label = '${wallet.availablePoints} · ${'points.low'.tr}';
          foreground = Colors.orange.shade800;
          icon = Icons.toll_rounded;
        } else {
          label = 'points.points_value'
              .trParams({'points': '${wallet.availablePoints}'});
          foreground = Colors.black87;
          icon = Icons.toll_rounded;
        }
        return Semantics(
          button: true,
          label: '${'points.open_wallet'.tr}. $label',
          child: Material(
            color: Colors.white,
            elevation: 3,
            borderRadius: BorderRadius.circular(12),
            child: InkWell(
              key: const Key('driver-points-indicator'),
              borderRadius: BorderRadius.circular(12),
              onTap: () => Get.toNamed(Routes.MY_POINTS),
              child: ConstrainedBox(
                constraints: const BoxConstraints(minHeight: 48, minWidth: 120),
                child: Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: <Widget>[
                      Icon(icon, color: foreground, size: 20),
                      const SizedBox(width: 8),
                      Flexible(
                        child: Text(
                          label,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: foreground,
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      const SizedBox(width: 4),
                      Icon(
                        Directionality.of(context) == TextDirection.rtl
                            ? Icons.chevron_left_rounded
                            : Icons.chevron_right_rounded,
                        color: foreground,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        );
      });
}
