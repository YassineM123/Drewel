import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../controllers/call_state_controller.dart';
import '../widgets/call_status_indicator.dart';

class OutgoingCallScreen extends GetView<CallStateController> {
  const OutgoingCallScreen({super.key});

  @override
  Widget build(BuildContext context) => PopScope<void>(
        canPop: false,
        onPopInvokedWithResult: (bool didPop, void result) {
          if (!didPop && !controller.isBusy.value) controller.cancelCall();
        },
        child: Scaffold(
          body: SafeArea(
            child: Obx(() {
              final call = controller.currentCall.value;
              final counterpart = controller.counterpart;
              if (call == null) return const SizedBox.shrink();
              return Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: <Widget>[
                    const Spacer(),
                    CircleAvatar(
                      radius: 52,
                      backgroundImage: counterpart?.profileImageUrl == null
                          ? null
                          : NetworkImage(counterpart!.profileImageUrl!),
                      child: counterpart?.profileImageUrl == null
                          ? const Icon(Icons.person, size: 48)
                          : null,
                    ),
                    const SizedBox(height: 20),
                    Text(
                      counterpart?.firstName ?? 'Ride participant',
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                    const SizedBox(height: 8),
                    CallStatusIndicator(
                      status: call.status,
                      connectionState: controller.connectionState.value,
                    ),
                    const Spacer(),
                    SizedBox(
                      height: 52,
                      width: double.infinity,
                      child: FilledButton.icon(
                        style:
                            FilledButton.styleFrom(backgroundColor: Colors.red),
                        onPressed: controller.isBusy.value
                            ? null
                            : controller.cancelCall,
                        icon: const Icon(Icons.call_end),
                        label: const Text('Cancel call'),
                      ),
                    ),
                  ],
                ),
              );
            }),
          ),
        ),
      );
}
