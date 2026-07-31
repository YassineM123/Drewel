import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../../common/colors.dart';
import '../../../data/apis/api_models/driver_points_models.dart';
import '../../../routes/app_pages.dart';
import '../controllers/driver_points_controller.dart';

class MyPointsView extends GetView<DriverPointsController> {
  const MyPointsView({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: Text('points.my_points'.tr)),
        body: SafeArea(
          child: Obx(() {
            final wallet = controller.wallet.value;
            if (wallet == null &&
                (controller.state.value == PointsLoadState.loading ||
                    controller.state.value == PointsLoadState.initial)) {
              return const _WalletSkeleton();
            }
            if (wallet == null) {
              return _PointsErrorState(
                offline: controller.state.value == PointsLoadState.offline,
                onRetry: controller.refreshAll,
              );
            }
            return RefreshIndicator(
              onRefresh: controller.refreshAll,
              child: ListView(
                key: const Key('my-points-list'),
                padding: const EdgeInsets.all(16),
                children: <Widget>[
                  _BalanceCard(wallet: wallet),
                  const SizedBox(height: 12),
                  if (wallet.welcomeBonusGranted)
                    Card(
                      child: ListTile(
                        leading: const CircleAvatar(
                          backgroundColor: Color(0x1FBE1B2C),
                          child: Icon(Icons.card_giftcard_rounded,
                              color: primaryColor),
                        ),
                        title: Text('points.welcome'.tr),
                        subtitle: Text('points.welcome_received'.tr),
                        trailing: const Icon(Icons.check_circle_rounded,
                            color: Colors.green),
                      ),
                    ),
                  const SizedBox(height: 12),
                  Semantics(
                    button: true,
                    label: 'points.buy'.tr,
                    child: SizedBox(
                      height: 52,
                      child: FilledButton.icon(
                        key: const Key('buy-points-button'),
                        onPressed: () => Get.toNamed(Routes.BUY_POINTS),
                        icon: const Icon(Icons.add_card_rounded),
                        label: Text('points.buy'.tr),
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    'points.history'.tr,
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                  ),
                  const SizedBox(height: 8),
                  if (controller.transactions.isEmpty)
                    _EmptyCard(message: 'points.no_history'.tr)
                  else
                    ...controller.transactions.map(
                      (transaction) =>
                          _TransactionTile(transaction: transaction),
                    ),
                ],
              ),
            );
          }),
        ),
      );
}

class _BalanceCard extends StatelessWidget {
  const _BalanceCard({required this.wallet});

  final DriverPointsWallet wallet;

  @override
  Widget build(BuildContext context) => Card(
        color: primaryColor,
        elevation: 4,
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Column(
            children: <Widget>[
              _BalanceRow(
                label: 'points.available'.tr,
                value: '${wallet.availablePoints}',
                emphasized: true,
              ),
              const Divider(color: Colors.white38),
              _BalanceRow(
                label: 'points.reserved'.tr,
                value: '${wallet.reservedPoints}',
              ),
              _BalanceRow(
                label: 'points.available_rides'.tr,
                value: '${wallet.equivalentAvailableRides}',
              ),
              _BalanceRow(
                label: 'points.purchased'.tr,
                value: '${wallet.purchasedPoints}',
              ),
            ],
          ),
        ),
      );
}

class _BalanceRow extends StatelessWidget {
  const _BalanceRow({
    required this.label,
    required this.value,
    this.emphasized = false,
  });

  final String label;
  final String value;
  final bool emphasized;

  @override
  Widget build(BuildContext context) => Semantics(
        label: '$label: $value',
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 7),
          child: Row(
            children: <Widget>[
              Expanded(
                child: Text(
                  label,
                  style: const TextStyle(color: Colors.white),
                ),
              ),
              Text(
                value,
                key: Key('balance-${label.hashCode}'),
                style: TextStyle(
                  color: Colors.white,
                  fontSize: emphasized ? 28 : 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
        ),
      );
}

class _TransactionTile extends StatelessWidget {
  const _TransactionTile({required this.transaction});

  final PointTransaction transaction;

  String get _title => switch (transaction.type) {
        'WELCOME_BONUS' => 'points.welcome_bonus'.tr,
        'RIDE_CHARGE' => 'points.ride_charge'.trParams(
            {'reference': transaction.rideId ?? ''},
          ),
        'POINTS_PURCHASE' => 'points.purchase'.tr,
        'OFFER_RESERVE' => 'points.offer_reserved'.tr,
        'OFFER_RELEASE' => 'points.offer_released'.tr,
        'TECHNICAL_REFUND' => 'points.technical_refund'.tr,
        'ADMIN_CREDIT' => 'points.admin_credit'.tr,
        'ADMIN_DEBIT' || 'PENALTY' || 'CORRECTION' => 'points.admin_debit'.tr,
        _ => transaction.type.replaceAll('_', ' '),
      };

  @override
  Widget build(BuildContext context) {
    final String amount = transaction.isRelease
        ? 'points.released'.trParams({'points': '${transaction.points}'})
        : '${transaction.isDebit ? '−' : '+'}${transaction.points}';
    final Color amountColor = transaction.isDebit
        ? primaryColor
        : transaction.isRelease
            ? Colors.orange.shade800
            : Colors.green.shade700;
    final String? reference = transaction.rideId ?? transaction.offerId;
    return Card(
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: amountColor.withValues(alpha: 0.12),
          child: Icon(Icons.toll_rounded, color: amountColor),
        ),
        title: Text(_title),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            if (transaction.createdAt != null)
              Text(MaterialLocalizations.of(context)
                  .formatMediumDate(transaction.createdAt!)),
            if (reference?.isNotEmpty == true) Text('#$reference'),
            Text('points.status'.trParams(
              {'status': transaction.status.toLowerCase()},
            )),
            if (transaction.reason?.trim().isNotEmpty == true)
              Text(transaction.reason!.trim()),
          ],
        ),
        trailing: Text(
          amount,
          style: TextStyle(
            color: amountColor,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
    );
  }
}

class _WalletSkeleton extends StatelessWidget {
  const _WalletSkeleton();

  @override
  Widget build(BuildContext context) => Semantics(
        label: 'points.loading'.tr,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: List<Widget>.generate(
            5,
            (index) => Container(
              height: index == 0 ? 190 : 72,
              margin: const EdgeInsets.only(bottom: 12),
              decoration: BoxDecoration(
                color: Colors.grey.shade200,
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
        ),
      );
}

class _PointsErrorState extends StatelessWidget {
  const _PointsErrorState({required this.offline, required this.onRetry});

  final bool offline;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Icon(
                offline ? Icons.cloud_off_rounded : Icons.error_outline_rounded,
                size: 44,
                color: primaryColor,
              ),
              const SizedBox(height: 12),
              Text(
                offline ? 'points.offline'.tr : 'points.error'.tr,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: onRetry,
                child: Text('points.retry'.tr),
              ),
            ],
          ),
        ),
      );
}

class _EmptyCard extends StatelessWidget {
  const _EmptyCard({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) => Card(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Center(child: Text(message)),
        ),
      );
}
