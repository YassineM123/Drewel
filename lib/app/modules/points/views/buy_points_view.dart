import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../../common/colors.dart';
import '../../../../common/drewel_app_bar.dart';
import '../../../../common/responsive_primary_button.dart';
import '../../../../common/text_styles.dart';
import '../../../data/apis/api_models/driver_points_models.dart';
import '../../../routes/app_pages.dart';
import '../controllers/driver_points_controller.dart';

class BuyPointsView extends GetView<DriverPointsController> {
  const BuyPointsView({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: const Color(0xFFFCFCFC),
        appBar: DrewelAppBar(
          title: 'points.buy'.tr,
          showBackButton: true,
        ),
        body: SafeArea(
          child: Obx(
            () => RefreshIndicator(
              onRefresh: controller.refreshAll,
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: EdgeInsets.fromLTRB(
                  16,
                  16,
                  16,
                  16 + MediaQuery.of(context).padding.bottom,
                ),
                children: <Widget>[
                  Card(
                    color: primaryColor,
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: ListTile(
                      leading:
                          const Icon(Icons.toll_rounded, color: Colors.white),
                      title: Text(
                        'points.current_balance'.tr,
                        style: const TextStyle(color: Colors.white),
                      ),
                      trailing: Text(
                        '${controller.wallet.value?.availablePoints ?? '-'}',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  Text(
                    'points.packs'.tr,
                    style: MyTextStyle.titleStyle18bb,
                  ),
                  const SizedBox(height: 8),
                  if (controller.isLoadingPacks.value &&
                      controller.packs.isEmpty)
                    const _LoadingCard()
                  else if (controller.packsError.value.isNotEmpty &&
                      controller.packs.isEmpty)
                    _ErrorCard(
                      message: controller.packsError.value,
                      onRetry: controller.refreshPacks,
                    )
                  else if (controller.packs.isEmpty)
                    _MessageCard(
                      message: controller.packsError.value.isNotEmpty
                          ? controller.packsError.value
                          : 'points.no_packs'.tr,
                    )
                  else
                    ...controller.packs.map(
                      (pack) => _PointPackCard(
                        pack: pack,
                        loading: controller.isCreatingPurchaseRequest.value,
                        onRequest: () => _requestPack(context, pack),
                      ),
                    ),
                  const SizedBox(height: 20),
                  _CustomAmountCard(
                    loading: controller.isCreatingPurchaseRequest.value,
                    onRequest: (points) => _requestCustom(context, points),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    'points.requests'.tr,
                    style: MyTextStyle.titleStyle18bb,
                  ),
                  const SizedBox(height: 8),
                  if (controller.isLoadingPurchaseRequests.value &&
                      controller.purchaseRequests.isEmpty)
                    const _LoadingCard()
                  else if (controller.purchaseRequestsError.value.isNotEmpty &&
                      controller.purchaseRequests.isEmpty)
                    _ErrorCard(
                      message: controller.purchaseRequestsError.value,
                      onRetry: controller.refreshPurchaseRequests,
                    )
                  else if (controller.purchaseRequests.isEmpty)
                    _MessageCard(
                      message: controller.purchaseRequestsError.value.isNotEmpty
                          ? controller.purchaseRequestsError.value
                          : 'points.no_history'.tr,
                    )
                  else
                    ...controller.purchaseRequests.map(
                      (request) => _PurchaseRequestTile(request: request),
                    ),
                ],
              ),
            ),
          ),
        ),
      );

  Future<void> _requestPack(BuildContext context, PointPack pack) =>
      _handleRequest(context, controller.requestPack(pack));

  Future<void> _requestCustom(BuildContext context, int points) =>
      _handleRequest(context, controller.requestCustomPoints(points));

  Future<void> _handleRequest(
    BuildContext context,
    Future<PointPurchaseRequest?> pending,
  ) async {
    final request = await pending;
    if (!context.mounted) return;
    if (request == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('points.request_failed'.tr)),
      );
      return;
    }
    final bool openSupport = await showDialog<bool>(
          context: context,
          builder: (dialogContext) => AlertDialog(
            icon: const Icon(Icons.check_circle_rounded, color: Colors.green),
            title: Text('points.pending'.tr),
            content: SelectableText(
              'points.request_reference'.trParams(
                {'reference': request.reference},
              ),
            ),
            actions: <Widget>[
              TextButton(
                onPressed: () => Navigator.pop(dialogContext, false),
                child: Text('points.cancel'.tr),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(dialogContext, true),
                child: Text('points.request'.tr),
              ),
            ],
          ),
        ) ??
        false;
    if (openSupport) {
      Get.toNamed(
        Routes.SUPPORT_CHAT,
        arguments: <String, String>{
          'purchaseRequestId': request.id,
          'reference': request.reference,
        },
      );
    }
  }
}

class _PointPackCard extends StatelessWidget {
  const _PointPackCard({
    required this.pack,
    required this.loading,
    required this.onRequest,
  });

  final PointPack pack;
  final bool loading;
  final VoidCallback onRequest;

  @override
  Widget build(BuildContext context) => Card(
        elevation: 0,
        color: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
          side: BorderSide(color: Colors.black.withValues(alpha: 0.06)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: LayoutBuilder(
            builder: (BuildContext context, BoxConstraints constraints) {
              final bool compact = constraints.maxWidth < 420;
              final Widget info = Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      pack.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                    Text('${pack.points} ${'points.available'.tr}'),
                    Text('points.arranged_directly'.tr),
                  ],
                ),
              );

              final Widget action = ResponsivePrimaryButton(
                key: Key('request-pack-${pack.id}'),
                semanticLabel: '${'points.request'.tr}: ${pack.name}',
                onPressed: loading ? null : onRequest,
                isLoading: loading,
                child: Text('points.request'.tr),
              );

              if (compact) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        const CircleAvatar(
                          backgroundColor: Color(0x1FBE1B2C),
                          child: Icon(Icons.toll_rounded, color: primaryColor),
                        ),
                        const SizedBox(width: 12),
                        info,
                      ],
                    ),
                    const SizedBox(height: 12),
                    action,
                  ],
                );
              }

              return Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: <Widget>[
                  const CircleAvatar(
                    backgroundColor: Color(0x1FBE1B2C),
                    child: Icon(Icons.toll_rounded, color: primaryColor),
                  ),
                  const SizedBox(width: 12),
                  info,
                  const SizedBox(width: 12),
                  SizedBox(width: 160, child: action),
                ],
              );
            },
          ),
        ),
      );
}

class _PurchaseRequestTile extends StatelessWidget {
  const _PurchaseRequestTile({required this.request});

  final PointPurchaseRequest request;

  String get statusLabel => switch (request.status) {
        'contacted' => 'points.contacted'.tr,
        'payment_pending' => 'points.payment_pending'.tr,
        'payment_verified' => 'points.payment_verified'.tr,
        'credited' => 'points.credited'.tr,
        'rejected' => 'points.rejected'.tr,
        'cancelled' => 'points.cancelled'.tr,
        _ => 'points.pending'.tr,
      };

  @override
  Widget build(BuildContext context) => Card(
        elevation: 0,
        color: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
          side: BorderSide(color: Colors.black.withValues(alpha: 0.06)),
        ),
        child: ListTile(
          leading: const Icon(Icons.receipt_long_rounded),
          title: Text(
            request.packName?.isNotEmpty == true
                ? request.packName!
                : '${request.points} ${'points.available'.tr}',
          ),
          subtitle: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(request.reference),
              if (request.createdAt != null)
                Text(MaterialLocalizations.of(context)
                    .formatMediumDate(request.createdAt!)),
            ],
          ),
          trailing: Chip(label: Text(statusLabel)),
        ),
      );
}

class _MessageCard extends StatelessWidget {
  const _MessageCard({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) => Card(
        elevation: 0,
        color: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
          side: BorderSide(color: Colors.black.withValues(alpha: 0.06)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Center(child: Text(message)),
        ),
      );
}

class _CustomAmountCard extends StatefulWidget {
  const _CustomAmountCard({required this.loading, required this.onRequest});

  final bool loading;
  final ValueChanged<int> onRequest;

  @override
  State<_CustomAmountCard> createState() => _CustomAmountCardState();
}

class _CustomAmountCardState extends State<_CustomAmountCard> {
  final TextEditingController _controller = TextEditingController();
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() {
    final int? points = int.tryParse(_controller.text.trim());
    if (points == null || points <= 0) {
      setState(() => _error = 'points.custom_amount_invalid'.tr);
      return;
    }
    setState(() => _error = null);
    widget.onRequest(points);
  }

  @override
  Widget build(BuildContext context) => Card(
        elevation: 0,
        color: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
          side: BorderSide(color: Colors.black.withValues(alpha: 0.06)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: LayoutBuilder(
            builder: (BuildContext context, BoxConstraints constraints) {
              final bool compact = constraints.maxWidth < 420;
              final Widget form = Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    'points.custom_amount'.tr,
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    key: const Key('custom-points-input'),
                    controller: _controller,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(
                      labelText: 'points.custom_amount_label'.tr,
                      hintText: 'points.custom_amount_hint'.tr,
                      errorText: _error,
                      isDense: true,
                    ),
                  ),
                ],
              );

              final Widget button = ResponsivePrimaryButton(
                key: const Key('request-custom-points'),
                onPressed: widget.loading ? null : _submit,
                isLoading: widget.loading,
                semanticLabel: 'points.request'.tr,
                child: Text('points.request'.tr),
              );

              if (compact) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    const CircleAvatar(
                      backgroundColor: Color(0x1FBE1B2C),
                      child: Icon(Icons.edit_rounded, color: primaryColor),
                    ),
                    const SizedBox(height: 12),
                    form,
                    const SizedBox(height: 12),
                    button,
                  ],
                );
              }

              return Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  const CircleAvatar(
                    backgroundColor: Color(0x1FBE1B2C),
                    child: Icon(Icons.edit_rounded, color: primaryColor),
                  ),
                  const SizedBox(width: 12),
                  Expanded(child: form),
                  const SizedBox(width: 12),
                  SizedBox(width: 160, child: button),
                ],
              );
            },
          ),
        ),
      );
}

class _LoadingCard extends StatelessWidget {
  const _LoadingCard();

  @override
  Widget build(BuildContext context) => Card(
        elevation: 0,
        color: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
          side: BorderSide(color: Colors.black.withValues(alpha: 0.06)),
        ),
        child: const Padding(
          padding: EdgeInsets.all(20),
          child: Center(child: CircularProgressIndicator()),
        ),
      );
}

class _ErrorCard extends StatelessWidget {
  const _ErrorCard({required this.message, required this.onRetry});

  final String message;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) => Card(
        elevation: 0,
        color: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
          side: BorderSide(color: Colors.black.withValues(alpha: 0.06)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            children: <Widget>[
              Text(message, textAlign: TextAlign.center),
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
