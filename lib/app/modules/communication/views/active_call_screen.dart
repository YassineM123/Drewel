import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../controllers/call_state_controller.dart';
import '../widgets/call_status_indicator.dart';

class ActiveCallScreen extends GetView<CallStateController> {
  const ActiveCallScreen({super.key});

  String _duration(int seconds) =>
      '${(seconds ~/ 60).toString().padLeft(2, '0')}:'
      '${(seconds % 60).toString().padLeft(2, '0')}';

  @override
  Widget build(BuildContext context) => Scaffold(
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
                  const Text('Drewel secure call'),
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
                  const SizedBox(height: 18),
                  Text(
                    counterpart?.firstName ?? 'Ride participant',
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  Text(_duration(controller.connectedSeconds.value)),
                  const SizedBox(height: 8),
                  CallStatusIndicator(
                    status: call.status,
                    connectionState: controller.connectionState.value,
                  ),
                  if (controller.connectionState.value.name == 'failed')
                    const Padding(
                      padding: EdgeInsets.only(top: 12),
                      child: Text('Network quality is too low. Try again.'),
                    ),
                  const Spacer(),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: <Widget>[
                      _AudioButton(
                        icon: controller.isMuted.value
                            ? Icons.mic_off
                            : Icons.mic,
                        label: 'Mute',
                        selected: controller.isMuted.value,
                        onPressed: controller.toggleMute,
                      ),
                      _AudioButton(
                        icon: Icons.volume_up,
                        label: 'Speaker',
                        selected: controller.isSpeakerEnabled.value,
                        onPressed: controller.toggleSpeaker,
                      ),
                      _AudioButton(
                        icon: Icons.call_end,
                        label: 'End',
                        color: Colors.red,
                        onPressed: controller.endCall,
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

class _AudioButton extends StatelessWidget {
  const _AudioButton({
    required this.icon,
    required this.label,
    required this.onPressed,
    this.selected = false,
    this.color,
  });

  final IconData icon;
  final String label;
  final VoidCallback onPressed;
  final bool selected;
  final Color? color;

  @override
  Widget build(BuildContext context) => Semantics(
        button: true,
        selected: selected,
        label: label,
        child: Column(
          children: <Widget>[
            SizedBox.square(
              dimension: 56,
              child: IconButton.filled(
                onPressed: onPressed,
                icon: Icon(icon),
                style: IconButton.styleFrom(
                  backgroundColor: color ??
                      (selected ? Theme.of(context).colorScheme.primary : null),
                ),
              ),
            ),
            Text(label),
          ],
        ),
      );
}
