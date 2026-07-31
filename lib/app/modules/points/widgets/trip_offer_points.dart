import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../../common/colors.dart';
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
            Text(
              'points.points_value'.trParams({'points': '$value'}),
              style: TextStyle(
                fontWeight: FontWeight.bold,
                color: emphasized ? primaryColor : Colors.black87,
              ),
            ),
          ],
        ),
      );
}

class TripOfferStatusCard extends StatelessWidget {
  const TripOfferStatusCard({super.key, required this.offer});

  final TripOffer offer;

  @override
  Widget build(BuildContext context) {
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
    return Material(
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
            ],
          ),
        ),
      ),
    );
  }
}
