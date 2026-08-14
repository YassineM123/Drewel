import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../data/services/agora_call_service.dart';
import '../controllers/call_state_controller.dart';

class ActiveCallScreen extends GetView<CallStateController> {
  const ActiveCallScreen({super.key});

  static const Color _bg = Color(0xFF120C0D);
  static const Color _accent = Color(0xFFB3231C);

  String _duration(int seconds) =>
      '${(seconds ~/ 60).toString().padLeft(2, '0')}:'
      '${(seconds % 60).toString().padLeft(2, '0')}';

  String _roleLabel(String? role) => switch (role) {
        'driver' => 'Elite Captain',
        'user' => 'Passenger',
        _ => 'Drewel',
      };

  String _connectionLabel(AgoraConnectionState state) => switch (state) {
        AgoraConnectionState.connecting => 'Calling…',
        AgoraConnectionState.connected => 'Good connection',
        AgoraConnectionState.reconnecting => 'Reconnecting…',
        AgoraConnectionState.failed => 'Poor connection',
        AgoraConnectionState.idle => 'Connecting…',
      };

  IconData _connectionIcon(AgoraConnectionState state) => switch (state) {
        AgoraConnectionState.connected => Icons.network_cell_rounded,
        AgoraConnectionState.failed => Icons.signal_cellular_connected_no_internet_0_bar_rounded,
        _ => Icons.network_cell_rounded,
      };

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: _bg,
        body: DecoratedBox(
          decoration: const BoxDecoration(
            gradient: RadialGradient(
              center: Alignment(0, -0.15),
              radius: 1.1,
              colors: <Color>[Color(0xFF2A1113), _bg],
            ),
          ),
          child: SafeArea(
            child: Obx(() {
              final call = controller.currentCall.value;
              final counterpart = controller.counterpart;
              if (call == null) return const SizedBox.shrink();
              final AgoraConnectionState connState =
                  controller.connectionState.value;
              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                child: Column(
                  children: <Widget>[
                    Row(
                      children: <Widget>[
                        _RoundIconButton(
                          icon: Icons.keyboard_arrow_down_rounded,
                          onPressed: () => Get.back<void>(),
                        ),
                        const Spacer(),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 8,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.08),
                            borderRadius: BorderRadius.circular(24),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: <Widget>[
                              Icon(
                                _connectionIcon(connState),
                                size: 16,
                                color: const Color(0xFFE8A33D),
                              ),
                              const SizedBox(width: 8),
                              Text(
                                _connectionLabel(connState),
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w600,
                                  fontSize: 13,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const Spacer(flex: 3),
                    Stack(
                      clipBehavior: Clip.none,
                      children: <Widget>[
                        Container(
                          padding: const EdgeInsets.all(4),
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(color: _accent, width: 2),
                          ),
                          child: CircleAvatar(
                            radius: 60,
                            backgroundColor: Colors.white,
                            backgroundImage: counterpart?.profileImageUrl == null
                                ? null
                                : NetworkImage(counterpart!.profileImageUrl!),
                            child: counterpart?.profileImageUrl == null
                                ? Icon(Icons.person, size: 56, color: Colors.grey.shade400)
                                : null,
                          ),
                        ),
                        Positioned(
                          right: 4,
                          bottom: 4,
                          child: Container(
                            padding: const EdgeInsets.all(8),
                            decoration: const BoxDecoration(
                              color: _accent,
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(
                              Icons.local_taxi_rounded,
                              size: 18,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),
                    Text(
                      counterpart?.firstName ?? 'Ride participant',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 30,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      _roleLabel(counterpart?.role),
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.5),
                        fontSize: 16,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 20),
                    Text(
                      _duration(controller.connectedSeconds.value),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 34,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1.5,
                      ),
                    ),
                    if (connState == AgoraConnectionState.failed)
                      const Padding(
                        padding: EdgeInsets.only(top: 12),
                        child: Text(
                          'Network quality is too low. Try again.',
                          style: TextStyle(color: Colors.white70),
                        ),
                      ),
                    const Spacer(flex: 4),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                      children: <Widget>[
                        _CallButton(
                          icon: controller.isMuted.value
                              ? Icons.mic_off_rounded
                              : Icons.mic_rounded,
                          label: 'Mute',
                          selected: controller.isMuted.value,
                          onPressed: controller.toggleMute,
                        ),
                        _CallButton(
                          icon: Icons.call_end_rounded,
                          label: '',
                          size: 72,
                          background: _accent,
                          iconColor: Colors.white,
                          busy: controller.isBusy.value,
                          onPressed: controller.endCall,
                        ),
                        _CallButton(
                          icon: Icons.volume_up_rounded,
                          label: 'Speaker',
                          selected: controller.isSpeakerEnabled.value,
                          onPressed: controller.toggleSpeaker,
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                  ],
                ),
              );
            }),
          ),
        ),
      );
}

class _RoundIconButton extends StatelessWidget {
  const _RoundIconButton({required this.icon, required this.onPressed});

  final IconData icon;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) => Material(
        color: Colors.white.withValues(alpha: 0.08),
        shape: const CircleBorder(),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onPressed,
          child: SizedBox.square(
            dimension: 44,
            child: Icon(icon, color: Colors.white),
          ),
        ),
      );
}

class _CallButton extends StatelessWidget {
  const _CallButton({
    required this.icon,
    required this.label,
    required this.onPressed,
    this.selected = false,
    this.busy = false,
    this.size = 64,
    this.background,
    this.iconColor,
  });

  final IconData icon;
  final String label;
  final VoidCallback onPressed;
  final bool selected;
  final bool busy;
  final double size;
  final Color? background;
  final Color? iconColor;

  @override
  Widget build(BuildContext context) => Semantics(
        button: true,
        selected: selected,
        label: label.isEmpty ? 'Call action' : label,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Material(
              color: background ??
                  (selected
                      ? Colors.white.withValues(alpha: 0.9)
                      : Colors.white.withValues(alpha: 0.1)),
              shape: const CircleBorder(),
              child: InkWell(
                customBorder: const CircleBorder(),
                onTap: busy ? null : onPressed,
                child: SizedBox.square(
                  dimension: size,
                  child: busy
                      ? const Padding(
                          padding: EdgeInsets.all(20),
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : Icon(
                          icon,
                          color: iconColor ??
                              (selected ? Colors.black : Colors.white),
                          size: size * 0.4,
                        ),
                ),
              ),
            ),
            if (label.isNotEmpty) ...<Widget>[
              const SizedBox(height: 8),
              Text(
                label,
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.7),
                  fontSize: 13,
                ),
              ),
            ],
          ],
        ),
      );
}
