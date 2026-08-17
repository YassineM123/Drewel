import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:get/get.dart';

import '../../../../common/colors.dart';
import '../../../../common/motion.dart';
import '../../../data/apis/api_models/driver_points_models.dart';
import '../../../routes/app_pages.dart';
import '../controllers/driver_points_controller.dart';

Future<bool> showOfferReservationConfirmation(
  BuildContext context,
  DriverPointsController controller,
) async {
  await controller.refreshWallet(silent: controller.wallet.value != null);
  if (!context.mounted) return false;
  final wallet = controller.wallet.value;
  if (wallet == null) return false;
  if (!wallet.canSendOffer ||
      wallet.availablePointsAfterOfferReservation == null) {
    final bool buy = await showDialog<bool>(
          context: context,
          builder: (dialogContext) => AlertDialog(
            key: const Key('insufficient-points-dialog'),
            icon: const Icon(Icons.toll_rounded, color: primaryColor),
            title: Text('points.low'.tr),
            content: Text('points.insufficient'.tr),
            actions: <Widget>[
              TextButton(
                onPressed: () => Navigator.pop(dialogContext, false),
                child: Text('points.cancel'.tr),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(dialogContext, true),
                child: Text('points.buy'.tr),
              ),
            ],
          ),
        ) ??
        false;
    if (buy) Get.toNamed(Routes.BUY_POINTS);
    return false;
  }
  return await showDialog<bool>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          key: const Key('offer-reservation-dialog'),
          title: Text('points.send_trip_offer'.tr),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              _QuoteRow(
                label: 'points.current_balance'.tr,
                value: wallet.availablePoints,
              ),
              _QuoteRow(
                label: 'points.offer_reservation'.tr,
                value: wallet.offerPointsCost,
              ),
              const Divider(),
              _QuoteRow(
                label: 'points.after_reservation'.tr,
                value: wallet.availablePointsAfterOfferReservation!,
                emphasized: true,
              ),
            ],
          ),
          actions: <Widget>[
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: Text('points.cancel'.tr),
            ),
            FilledButton(
              key: const Key('confirm-send-offer-button'),
              onPressed: controller.isSendingOffer.value
                  ? null
                  : () => Navigator.pop(dialogContext, true),
              child: Text(
                'points.send_offer'.trParams(
                  {'points': '${wallet.offerPointsCost}'},
                ),
              ),
            ),
          ],
        ),
      ) ??
      false;
}

class _QuoteRow extends StatelessWidget {
  const _QuoteRow({
    required this.label,
    required this.value,
    this.emphasized = false,
  });

  final String label;
  final int value;
  final bool emphasized;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(
          children: <Widget>[
            Expanded(child: Text(label)),
            AnimatedNumber(
              value: value,
              style: TextStyle(
                fontWeight: FontWeight.bold,
                color: emphasized ? primaryColor : Colors.black87,
              ),
              builder: (v) => 'points.points_value'.trParams({'points': '$v'}),
            ),
          ],
        ),
      );
}

class TripOfferStatusCard extends StatelessWidget {
  const TripOfferStatusCard({
    super.key,
    required this.offer,
    this.onAccept,
    this.onDecline,
  });

  final TripOffer offer;
  final VoidCallback? onAccept;
  final VoidCallback? onDecline;

  static String _address(Map<String, dynamic>? location, String fallback) =>
      (location?['address'] ?? fallback).toString();

  @override
  Widget build(BuildContext context) {
    if (offer.status == 'accepted') {
      final String fare = offer.offeredPrice == null
          ? 'Price confirmed'
          : '${offer.offeredPrice!.toStringAsFixed(0)} ${offer.currency ?? ''}'
              .trim();
      return FadeSlideIn(
        child: Container(
        margin: const EdgeInsets.fromLTRB(12, 8, 12, 0),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: primaryColor.withValues(alpha: 0.26)),
        ),
        child: Semantics(
          liveRegion: true,
          label: 'Trip offer accepted. Proposed fare $fare',
          child: Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                Row(
                  children: <Widget>[
                    const Icon(
                      Icons.directions_car_filled_rounded,
                      color: primaryColor,
                      size: 18,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Trip Offer',
                        style:
                            Theme.of(context).textTheme.titleMedium?.copyWith(
                                  color: textColor,
                                  fontWeight: FontWeight.w800,
                                ),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 5,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFE7A8),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: const Text(
                        'ACCEPTED',
                        style: TextStyle(
                          color: Color(0xFF6E4A00),
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0,
                        ),
                      ),
                    ),
                  ],
                ),
                Divider(
                  height: 24,
                  color: primaryColor.withValues(alpha: 0.16),
                ),
                Row(
                  children: <Widget>[
                    const Expanded(
                      child: Text(
                        'Proposed Fare',
                        style: TextStyle(
                          color: Color(0xFF4B3F42),
                          fontSize: 14,
                        ),
                      ),
                    ),
                    Text(
                      fare,
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            color: textColor,
                            fontWeight: FontWeight.w900,
                          ),
                    )
                        .animate()
                        .scale(
                          begin: const Offset(0.96, 0.96),
                          end: const Offset(1, 1),
                          duration: MotionDuration.deliberate,
                          curve: MotionCurve.emphasized,
                        ),
                  ],
                ),
                Divider(
                  height: 24,
                  color: primaryColor.withValues(alpha: 0.16),
                ),
                _TripOfferLocationRow(
                  icon: Icons.radio_button_checked_rounded,
                  label: 'PICKUP',
                  value: _address(offer.pickup, 'Pickup location'),
                ),
                const SizedBox(height: 10),
                _TripOfferLocationRow(
                  icon: Icons.location_on_rounded,
                  label: 'DESTINATION',
                  value: _address(offer.destination, 'Destination'),
                ),
                if (onAccept != null && onDecline != null) ...<Widget>[
                  const SizedBox(height: 16),
                  Row(
                    children: <Widget>[
                      Expanded(
                        child: AnimatedPressable(
                          onTap: onDecline == null
                              ? null
                              : () {
                                  HapticFeedback.lightImpact();
                                  onDecline!();
                                },
                          child: OutlinedButton(
                            style: OutlinedButton.styleFrom(
                              minimumSize: const Size.fromHeight(44),
                              foregroundColor: textColor,
                              side: const BorderSide(color: Color(0xFFD9D1D3)),
                            ),
                            onPressed: onDecline,
                            child: const Text('Decline'),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: AnimatedPressable(
                          onTap: onAccept == null
                              ? null
                              : () {
                                  HapticFeedback.mediumImpact();
                                  onAccept!();
                                },
                          child: FilledButton(
                            style: FilledButton.styleFrom(
                              backgroundColor: primaryColor,
                              foregroundColor: Colors.white,
                              minimumSize: const Size.fromHeight(44),
                            ),
                            onPressed: onAccept,
                            child: const Text('Accept'),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ),
        ),
      );
    }
    final (IconData icon, Color color, String message) = switch (offer.status) {
      'accepted' => (
          Icons.check_circle_rounded,
          Colors.green,
          'points.accepted_status'.trParams({'points': '${offer.pointsCost}'})
        ),
      'declined' => (
          Icons.undo_rounded,
          Colors.orange,
          'points.declined_status'.trParams({'points': '${offer.pointsCost}'})
        ),
      'expired' => (
          Icons.timer_off_rounded,
          Colors.orange,
          'points.expired_status'.trParams({'points': '${offer.pointsCost}'})
        ),
      'delivery_failed' => (
          Icons.sync_problem_rounded,
          primaryColor,
          'points.failure_status'.tr
        ),
      'cancelled' => (
          Icons.cancel_outlined,
          Colors.orange,
          'points.cancelled_status'.tr
        ),
      _ => (
          Icons.hourglass_top_rounded,
          primaryColor,
          'points.reserved_status'.trParams({'points': '${offer.pointsCost}'})
        ),
    };
    final bool showCountdown =
        offer.status != 'accepted' && offer.expiresAt != null;
    return FadeSlideIn(
      key: ValueKey<String>(offer.status),
      child: Material(
      color: color.withValues(alpha: 0.1),
      child: Semantics(
        liveRegion: true,
        label: message,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Row(
            children: <Widget>[
              Icon(icon, color: color),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  message,
                  style: TextStyle(color: color, fontWeight: FontWeight.w600),
                ),
              ),
              if (showCountdown) ...<Widget>[
                const SizedBox(width: 8),
                _OfferExpiryCountdown(expiresAt: offer.expiresAt!, color: color),
              ],
            ],
          ),
        ),
      ),
      ),
    );
  }
}

class _TripOfferLocationRow extends StatelessWidget {
  const _TripOfferLocationRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Icon(icon, size: 16, color: primaryColor),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 10,
                    letterSpacing: 0,
                    color: Color(0xFF8A7A7D),
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: Color(0xFF4B3F42)),
                ),
              ],
            ),
          ),
        ],
      );
}

/// Subtle timer readout for a Trip Offer's remaining reservation window.
/// Updates itself once a second in isolation so the surrounding offer card
/// never rebuilds just to tick a clock; only escalates color near expiry.
class _OfferExpiryCountdown extends StatefulWidget {
  const _OfferExpiryCountdown({required this.expiresAt, required this.color});

  final DateTime expiresAt;
  final Color color;

  @override
  State<_OfferExpiryCountdown> createState() => _OfferExpiryCountdownState();
}

class _OfferExpiryCountdownState extends State<_OfferExpiryCountdown> {
  Timer? _timer;
  late Duration _remaining;

  @override
  void initState() {
    super.initState();
    _remaining = widget.expiresAt.difference(DateTime.now());
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      final Duration next = widget.expiresAt.difference(DateTime.now());
      if (!mounted) return;
      setState(() => _remaining = next);
      if (next.isNegative) _timer?.cancel();
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_remaining.isNegative) return const SizedBox.shrink();
    final int totalSeconds = _remaining.inSeconds;
    final bool urgent = totalSeconds <= 10;
    final String label =
        '${(totalSeconds ~/ 60).toString().padLeft(1, '0')}:${(totalSeconds % 60).toString().padLeft(2, '0')}';
    return AnimatedDefaultTextStyle(
      duration: MotionDuration.normal,
      style: TextStyle(
        color: urgent ? Colors.red.shade700 : widget.color,
        fontWeight: FontWeight.w800,
        fontSize: 12,
      ),
      child: Text(label),
    );
  }
}
