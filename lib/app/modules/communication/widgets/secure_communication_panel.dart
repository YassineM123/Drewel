import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../../common/colors.dart';
import '../controllers/call_state_controller.dart';

class SecureCommunicationPanel extends GetView<CallStateController> {
  const SecureCommunicationPanel({
    super.key,
    this.hideWhenUnavailable = false,
  });

  final bool hideWhenUnavailable;

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
            final bool counterpartIsDriver =
                controller.counterpart?.role == 'driver';
            final String messageLabel =
                counterpartIsDriver ? 'Message driver' : 'Message passenger';
            if (hideWhenUnavailable && !enabled && error == null) {
              return const SizedBox.shrink();
            }
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
                        label: messageLabel,
                        child: Tooltip(
                          message: messageLabel,
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
                    ],
                  ),
                ],
              ),
            );
          }),
        ),
      );
}
