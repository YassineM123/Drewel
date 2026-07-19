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
                    children: <Widget>[
                      Expanded(
                        child: SizedBox(
                          height: 48,
                          child: OutlinedButton.icon(
                            onPressed: enabled ? controller.openRideChat : null,
                            icon: const Icon(Icons.message_rounded),
                            label: const Text('Message'),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: DrewelCallButton(
                          enabled: enabled,
                          loading: controller.isBusy.value,
                          onPressed: controller.initiateCall,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: SizedBox(
                          height: 48,
                          child: OutlinedButton.icon(
                            onPressed: controller.openSafety,
                            icon: const Icon(Icons.shield_rounded),
                            label: const Text('Safety'),
                          ),
                        ),
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
