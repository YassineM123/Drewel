import 'package:flutter/material.dart';

import '../../../../common/colors.dart';
import '../../../../common/common_widgets.dart';
import '../../../../common/text_styles.dart';
import '../../../data/apis/api_models/get_all_driver_model.dart';
import '../../../data/constants/string_constants.dart';

class MarketplaceDriverCard extends StatelessWidget {
  const MarketplaceDriverCard({
    super.key,
    required this.driver,
    required this.onTap,
    required this.onChat,
    required this.onCall,
    this.selected = false,
    this.distanceKm,
    this.actionsLoading = false,
  });

  final Drivers driver;
  final VoidCallback onTap;
  final VoidCallback? onChat;
  final VoidCallback? onCall;
  final bool selected;
  final double? distanceKm;
  final bool actionsLoading;

  @override
  Widget build(BuildContext context) {
    final String status = driver.availabilityStatus;
    final Color statusColor = switch (status) {
      'online' => const Color(0xFF23884A),
      'busy' => const Color(0xFFE08A00),
      _ => Colors.grey,
    };
    final double? displayedDistance = driver.distanceKm ?? distanceKm;
    final String vehicle = <String?>[driver.vehicleType, driver.vehicleModel]
        .where((String? value) => value?.trim().isNotEmpty == true)
        .join(' · ');

    return Semantics(
      button: true,
      selected: selected,
      label: '${driver.fullName ?? 'Driver'}, $status',
      child: Material(
        color: primary3Color,
        shape: RoundedRectangleBorder(
          side: BorderSide(
            color: selected ? primaryColor : Colors.black.withOpacity(0.1),
            width: selected ? 1.5 : 1,
          ),
          borderRadius: BorderRadius.circular(selected ? 22 : 15),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                CommonWidgets.imageView(
                  image: driver.profileImageUrl ??
                      StringConstants.defaultNetworkImage,
                  height: 60,
                  width: 60,
                  borderRadius: BorderRadius.circular(30),
                  defaultNetworkImage: StringConstants.defaultNetworkImage,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Row(
                        children: <Widget>[
                          Expanded(
                            child: Text(
                              driver.fullName ?? 'Driver',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: MyTextStyle.titleStyle16bb,
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: statusColor.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Text(
                              _statusLabel(context, status),
                              style: MyTextStyle.titleStyle12b.copyWith(
                                color: statusColor,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ],
                      ),
                      if (vehicle.isNotEmpty) ...<Widget>[
                        const SizedBox(height: 4),
                        Text(
                          vehicle,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: MyTextStyle.titleStyle12b,
                        ),
                      ],
                      if (driver.registrationVisible &&
                          driver.registrationNumber?.trim().isNotEmpty ==
                              true) ...<Widget>[
                        const SizedBox(height: 2),
                        Text(
                          driver.registrationNumber!,
                          style: MyTextStyle.titleStyle12b,
                        ),
                      ],
                      const SizedBox(height: 7),
                      Wrap(
                        spacing: 6,
                        runSpacing: 3,
                        children: <Widget>[
                          if (driver.rating != null)
                            _Fact(
                              icon: Icons.star_rounded,
                              text: driver.rating!.toStringAsFixed(1),
                            ),
                          if (displayedDistance != null &&
                              displayedDistance.isFinite &&
                              displayedDistance >= 0)
                            _Fact(
                              icon: Icons.near_me_rounded,
                              text:
                                  '${displayedDistance.toStringAsFixed(1)} km',
                            ),
                          if (driver.priceEstimate != null)
                            _Fact(
                              icon: Icons.payments_outlined,
                              text:
                                  '${driver.priceEstimate!.toStringAsFixed(0)} ${driver.currency ?? ''}'
                                      .trim(),
                            ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: <Widget>[
                          Expanded(
                            child: Text(
                              driver.city ?? '',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: MyTextStyle.titleStyle12b.copyWith(
                                color: Colors.grey[600],
                              ),
                            ),
                          ),
                          _ContactIconButton(
                            icon: Icons.message_rounded,
                            tooltip: _chatLabel(context),
                            enabled: driver.canChat &&
                                onChat != null &&
                                !actionsLoading,
                            onPressed: onChat,
                          ),
                          const SizedBox(width: 8),
                          _ContactIconButton(
                            icon: Icons.call_rounded,
                            tooltip: _callLabel(context),
                            enabled: driver.canCall &&
                                onCall != null &&
                                !actionsLoading,
                            onPressed: onCall,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  static bool _isArabic(BuildContext context) =>
      Localizations.localeOf(context).languageCode == 'ar';

  static String _chatLabel(BuildContext context) =>
      _isArabic(context) ? 'مراسلة السائق' : 'Message driver';

  static String _callLabel(BuildContext context) =>
      _isArabic(context) ? 'الاتصال بالسائق' : 'Call driver';

  static String _statusLabel(BuildContext context, String status) {
    if (!_isArabic(context)) {
      return switch (status) {
        'online' => 'Online',
        'busy' => 'Busy',
        _ => 'Offline',
      };
    }
    return switch (status) {
      'online' => 'متصل',
      'busy' => 'مشغول',
      _ => 'غير متصل',
    };
  }
}

class _Fact extends StatelessWidget {
  const _Fact({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) => Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Icon(icon, size: 14, color: primaryColor),
          const SizedBox(width: 3),
          Text(text, style: MyTextStyle.titleStyle12b),
        ],
      );
}

class _ContactIconButton extends StatelessWidget {
  const _ContactIconButton({
    required this.icon,
    required this.tooltip,
    required this.enabled,
    required this.onPressed,
  });

  final IconData icon;
  final String tooltip;
  final bool enabled;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) => Semantics(
        button: true,
        enabled: enabled,
        label: tooltip,
        child: Tooltip(
          message: tooltip,
          child: SizedBox.square(
            dimension: 44,
            child: Material(
              color: enabled
                  ? primaryColor.withOpacity(0.1)
                  : Colors.grey.withOpacity(0.08),
              shape: const CircleBorder(),
              child: InkWell(
                customBorder: const CircleBorder(),
                onTap: enabled ? onPressed : null,
                child: Icon(
                  icon,
                  size: 21,
                  color: enabled ? primaryColor : Colors.grey,
                ),
              ),
            ),
          ),
        ),
      );
}
