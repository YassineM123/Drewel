import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../routes/app_pages.dart';
import '../controllers/call_state_controller.dart';

class SafetyDialog extends GetView<CallStateController> {
  const SafetyDialog({super.key});

  Future<void> _requestReason(
    BuildContext context, {
    required String title,
    required String confirmLabel,
    required Future<bool> Function(String reason) submit,
    required bool destructive,
  }) async {
    final TextEditingController reasonController = TextEditingController();
    final bool? confirmed = await showDialog<bool>(
      context: context,
      builder: (BuildContext dialogContext) => AlertDialog(
        title: Text(title),
        content: TextField(
          controller: reasonController,
          autofocus: true,
          maxLength: 500,
          minLines: 2,
          maxLines: 4,
          decoration: InputDecoration(
            labelText: 'reason'.tr,
            hintText: 'tell_support_what_happened'.tr,
            border: const OutlineInputBorder(),
          ),
        ),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: Text('cancel'.tr),
          ),
          FilledButton(
            style: destructive
                ? FilledButton.styleFrom(backgroundColor: Colors.red)
                : null,
            onPressed: () {
              if (reasonController.text.trim().isEmpty) return;
              Navigator.pop(dialogContext, true);
            },
            child: Text(confirmLabel),
          ),
        ],
      ),
    );
    final String reason = reasonController.text;
    reasonController.dispose();
    if (confirmed != true) return;
    final bool success = await submit(reason);
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(success
            ? 'submitted_to_drewel'.trParams({'label': confirmLabel})
            : 'unable_to_submit_retry'.tr),
      ),
    );
    if (success && Get.isDialogOpen == true) Get.back<void>();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: Row(
          children: <Widget>[
            const Icon(Icons.shield_rounded),
            const SizedBox(width: 8),
            Text('safety'.tr),
          ],
        ),
        content: Text(
          controller.activeRide.value == null
              ? 'no_active_ride_safety'.tr
              : 'safety_dialog_description'.tr,
        ),
        actions: <Widget>[
          TextButton(
            onPressed: () {
              Get.back<void>();
              Get.toNamed(Routes.SUPPORT);
            },
            child: Text('support'.tr),
          ),
          if (controller.activeRide.value != null)
            TextButton(
              onPressed: () => _requestReason(
                context,
                title: 'report_this_ride_question'.tr,
                confirmLabel: 'report'.tr,
                submit: controller.reportRide,
                destructive: false,
              ),
              child: Text('report'.tr),
            ),
          if (controller.activeRide.value != null)
            FilledButton(
              style: FilledButton.styleFrom(backgroundColor: Colors.red),
              onPressed: () => _requestReason(
                context,
                title: 'block_this_participant_question'.tr,
                confirmLabel: 'block'.tr,
                submit: controller.blockRide,
                destructive: true,
              ),
              child: Text('block'.tr),
            ),
        ],
      );
}
