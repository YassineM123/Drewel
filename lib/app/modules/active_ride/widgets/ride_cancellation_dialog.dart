import 'package:flutter/material.dart';
import 'package:get/get.dart';

class RideCancellationResult {
  const RideCancellationResult({required this.reason, required this.note});

  final String reason;
  final String note;
}

Future<RideCancellationResult?> showRideCancellationDialog(
  BuildContext context,
) async {
  const List<String> reasons = <String>[
    'User unavailable',
    'Driver unavailable',
    'Wrong pickup',
    'Wrong destination',
    'Vehicle problem',
    'Technical problem',
    'Agreement not reached',
    'Other',
  ];
  String? selectedReason;
  final TextEditingController note = TextEditingController();
  final GlobalKey<FormState> formKey = GlobalKey<FormState>();
  final RideCancellationResult? result =
      await showDialog<RideCancellationResult>(
    context: context,
    barrierDismissible: false,
    builder: (BuildContext dialogContext) => StatefulBuilder(
      builder: (BuildContext context, StateSetter setState) => AlertDialog(
        title: Text('cancel_ride_q'.tr),
        content: Form(
          key: formKey,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  'The ride will remain in your history. Driver balance is not '
                  'automatically refunded after an accepted offer.'.tr,
                ),
                const SizedBox(height: 16),
                DropdownButtonFormField<String>(
                  initialValue: selectedReason,
                  isExpanded: true,
                  decoration: InputDecoration(
                    labelText: 'reason'.tr,
                    border: const OutlineInputBorder(),
                  ),
                  items: reasons
                      .map(
                        (String reason) => DropdownMenuItem<String>(
                          value: reason,
                          child: Text(reason.tr),
                        ),
                      )
                      .toList(growable: false),
                  onChanged: (String? value) =>
                      setState(() => selectedReason = value),
                  validator: (String? value) =>
                      value == null ? 'select_cancellation_reason'.tr : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: note,
                  maxLength: 500,
                  maxLines: 3,
                  decoration: InputDecoration(
                    labelText: 'additional_note'.tr,
                    border: const OutlineInputBorder(),
                  ),
                ),
              ],
            ),
          ),
        ),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: Text('keep_ride'.tr),
          ),
          FilledButton(
            onPressed: () {
              if (formKey.currentState?.validate() != true) return;
              Navigator.pop(
                dialogContext,
                RideCancellationResult(
                  reason: selectedReason!,
                  note: note.text.trim(),
                ),
              );
            },
            child: Text('cancel_ride'.tr),
          ),
        ],
      ),
    ),
  );
  note.dispose();
  return result;
}
