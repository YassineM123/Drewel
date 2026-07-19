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
          decoration: const InputDecoration(
            labelText: 'Reason',
            hintText: 'Tell Drewel support what happened',
            border: OutlineInputBorder(),
          ),
        ),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Cancel'),
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
            ? '$confirmLabel submitted to Drewel.'
            : 'Unable to submit. Please retry or contact support.'),
      ),
    );
    if (success && Get.isDialogOpen == true) Get.back<void>();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: const Row(
          children: <Widget>[
            Icon(Icons.shield_rounded),
            SizedBox(width: 8),
            Text('Safety'),
          ],
        ),
        content: Text(
          controller.activeRide.value == null
              ? 'No active ride is available. Drewel support can still help.'
              : 'Report a safety concern, block your assigned ride participant, or contact Drewel support.',
        ),
        actions: <Widget>[
          TextButton(
            onPressed: () {
              Get.back<void>();
              Get.toNamed(Routes.SUPPORT);
            },
            child: const Text('Support'),
          ),
          if (controller.activeRide.value != null)
            TextButton(
              onPressed: () => _requestReason(
                context,
                title: 'Report this ride?',
                confirmLabel: 'Report',
                submit: controller.reportRide,
                destructive: false,
              ),
              child: const Text('Report'),
            ),
          if (controller.activeRide.value != null)
            FilledButton(
              style: FilledButton.styleFrom(backgroundColor: Colors.red),
              onPressed: () => _requestReason(
                context,
                title: 'Block this participant?',
                confirmLabel: 'Block',
                submit: controller.blockRide,
                destructive: true,
              ),
              child: const Text('Block'),
            ),
        ],
      );
}
