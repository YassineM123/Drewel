import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../../common/colors.dart';
import '../controllers/call_state_controller.dart';
import 'drewel_call_button.dart';

class SecureCommunicationPanel extends GetView<CallStateController> {
  const SecureCommunicationPanel({super.key});

  @override
  Widget build(BuildContext context) => SafeArea(
        top: false,
        child: Material(
          color: primary3Color,
          elevation: 10,
          child: Obx(() {
            final bool enabled = controller.hasAuthorizedRide;
            final String? error =
                controller.userFacingError.value.trim().isEmpty
                    ? null
                    : controller.userFacingError.value;
            return Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 10),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  if (!enabled || error != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: <Widget>[
                          Flexible(
                            child: Text(
                              error ?? controller.unavailableReason,
                              textAlign: TextAlign.center,
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          ),
                          if (!enabled)
                            IconButton(
                              tooltip: 'Refresh active ride',
                              onPressed: controller.isBusy.value
                                  ? null
                                  : controller.refreshActiveRide,
                              icon: const Icon(Icons.refresh_rounded),
                            ),
                        ],
                      ),
                    ),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: <Widget>[
                      Semantics(
                        button: true,
                        enabled: enabled,
                        label: 'Message driver',
                        child: Tooltip(
                          message: 'Message driver',
                          child: SizedBox.square(
                            dimension: 48,
                            child: IconButton.filledTonal(
                              onPressed:
                                  enabled ? controller.openRideChat : null,
                              icon: const Icon(Icons.message_rounded),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      DrewelCallButton(
                        enabled: enabled,
                        loading: controller.isBusy.value,
                        onPressed: () async {
                          final String name =
                              controller.counterpart?.firstName ?? 'Driver';
                          if (await controller.confirmDrewelCall(name)) {
                            await controller.initiateCall();
                          }
                        },
                      ),
                    ],
                  ),
                ],
              ),
            );
          }),
        ),
      );
}
