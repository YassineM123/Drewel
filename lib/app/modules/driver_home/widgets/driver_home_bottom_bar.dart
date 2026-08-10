import 'package:flutter/material.dart';

import '../../../../common/colors.dart';

class DriverHomeBottomBar extends StatelessWidget {
  const DriverHomeBottomBar({
    super.key,
    required this.isOnline,
    required this.isLoading,
    required this.onToggleOnline,
    required this.activeRide,
    required this.rideRequests,
    required this.communication,
  });

  final bool isOnline;
  final bool isLoading;
  final VoidCallback? onToggleOnline;
  final Widget activeRide;
  final Widget rideRequests;
  final Widget communication;

  @override
  Widget build(BuildContext context) {
    final String label = isOnline ? 'Go Offline' : 'Go Online';
    final String subtitle = isOnline
        ? 'You are online and visible to riders'
        : 'You are offline and hidden from riders';
    final bool filled = !isOnline;
    final Color surface = filled ? primaryColor : primary3Color;
    final Color content = filled ? Colors.white : textColor;
    final Color accent = isOnline ? primaryColor : primary3Color;

    return Material(
      color: primary3Color,
      elevation: 12,
      child: SafeArea(
        top: false,
        minimum: const EdgeInsets.only(bottom: 8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            activeRide,
            rideRequests,
            communication,
            Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 760),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 10, 16, 4),
                  child: Semantics(
                    button: true,
                    label: label,
                    enabled: !isLoading,
                    child: InkWell(
                      key: const Key('driver-online-button'),
                      borderRadius: BorderRadius.circular(14),
                      onTap: isLoading ? null : onToggleOnline,
                      child: Ink(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 18,
                          vertical: 12,
                        ),
                        decoration: BoxDecoration(
                          color: surface,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: accent, width: 1.5),
                        ),
                        child: Row(
                          children: <Widget>[
                            Container(
                              width: 36,
                              height: 36,
                              decoration: BoxDecoration(
                                color: filled
                                    ? Colors.white.withValues(alpha: 0.2)
                                    : primaryColor.withValues(alpha: 0.1),
                                shape: BoxShape.circle,
                              ),
                              child: Icon(
                                isOnline
                                    ? Icons.power_settings_new_rounded
                                    : Icons.power_settings_new_rounded,
                                color: isOnline ? primaryColor : Colors.white,
                                size: 20,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisSize: MainAxisSize.min,
                                children: <Widget>[
                                  Text(
                                    label,
                                    style: TextStyle(
                                      fontWeight: FontWeight.w800,
                                      fontSize: 16,
                                      color: content,
                                    ),
                                  ),
                                  Text(
                                    subtitle,
                                    style: TextStyle(
                                      fontWeight: FontWeight.w500,
                                      fontSize: 12,
                                      color: content.withValues(alpha: 0.7),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 12),
                            if (isLoading)
                              SizedBox(
                                width: 24,
                                height: 24,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2.5,
                                  color: content,
                                ),
                              )
                            else
                              Switch.adaptive(
                                value: isOnline,
                                onChanged:
                                    isLoading ? null : (_) => onToggleOnline?.call(),
                                activeColor: Colors.white,
                                activeTrackColor: primaryColor,
                                inactiveThumbColor: Colors.white,
                                inactiveTrackColor: Colors.white54,
                              ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
