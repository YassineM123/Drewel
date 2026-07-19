import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../controllers/call_state_controller.dart';

class IncomingCallScreen extends GetView<CallStateController> {
  const IncomingCallScreen({super.key});

  @override
  Widget build(BuildContext context) => PopScope<void>(
        canPop: false,
        onPopInvokedWithResult: (bool didPop, void result) {
          if (!didPop && !controller.isBusy.value) controller.declineCall();
        },
        child: Scaffold(
          body: SafeArea(
            child: Obx(() {
              final counterpart = controller.counterpart;
              return Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: <Widget>[
                    const Text('Drewel Call', style: TextStyle(fontSize: 18)),
                    const SizedBox(height: 28),
                    CircleAvatar(
                      radius: 52,
                      backgroundImage: counterpart?.profileImageUrl == null
                          ? null
                          : NetworkImage(counterpart!.profileImageUrl!),
                      child: counterpart?.profileImageUrl == null
                          ? const Icon(Icons.person, size: 48)
                          : null,
                    ),
                    const SizedBox(height: 18),
                    Text(
                      counterpart?.firstName.isNotEmpty == true
                          ? counterpart!.firstName
                          : 'Your ride participant',
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                    Text(counterpart?.role ?? 'Assigned ride participant'),
                    if (counterpart?.vehicleDescription != null)
                      Text(counterpart!.vehicleDescription!),
                    const Spacer(),
                    Row(
                      children: <Widget>[
                        Expanded(
                          child: SizedBox(
                            height: 52,
                            child: FilledButton.icon(
                              style: FilledButton.styleFrom(
                                backgroundColor: Colors.red,
                              ),
                              onPressed: controller.isBusy.value
                                  ? null
                                  : controller.declineCall,
                              icon: const Icon(Icons.call_end),
                              label: const Text('Decline'),
                            ),
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: SizedBox(
                            height: 52,
                            child: FilledButton.icon(
                              style: FilledButton.styleFrom(
                                backgroundColor: Colors.green,
                              ),
                              onPressed: controller.isBusy.value
                                  ? null
                                  : controller.acceptCall,
                              icon: const Icon(Icons.call),
                              label: const Text('Accept'),
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
        ),
      );
}
