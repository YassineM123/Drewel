import 'package:flutter/material.dart';

import '../../../../common/colors.dart';
import '../../../../common/responsive_primary_button.dart';

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
  Widget build(BuildContext context) => Material(
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
                    child: ResponsivePrimaryButton(
                      key: const Key('driver-online-button'),
                      onPressed: isLoading ? null : onToggleOnline,
                      isLoading: isLoading,
                      semanticLabel: isOnline ? 'Go Offline' : 'Go Online',
                      backgroundColor: isOnline ? primary3Color : primaryColor,
                      foregroundColor: isOnline ? primaryColor : primary3Color,
                      child: Text(
                        isOnline ? 'Go Offline' : 'Go Online',
                        style: const TextStyle(fontWeight: FontWeight.w800),
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
