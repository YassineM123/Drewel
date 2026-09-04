import 'package:flutter/material.dart';

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
        title: const Text('Cancel this ride?'),
        content: Form(
          key: formKey,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                const Text(
                  'The ride will remain in your history. Driver balance is not '
                  'automatically refunded after an accepted offer.',
                ),
                const SizedBox(height: 16),
                DropdownButtonFormField<String>(
                  initialValue: selectedReason,
                  isExpanded: true,
                  decoration: const InputDecoration(
                    labelText: 'Reason',
                    border: OutlineInputBorder(),
                  ),
                  items: reasons
                      .map(
                        (String reason) => DropdownMenuItem<String>(
                          value: reason,
                          child: Text(reason),
                        ),
                      )
                      .toList(growable: false),
                  onChanged: (String? value) =>
                      setState(() => selectedReason = value),
                  validator: (String? value) =>
                      value == null ? 'Select a cancellation reason.' : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: note,
                  maxLength: 500,
                  maxLines: 3,
                  decoration: const InputDecoration(
                    labelText: 'Additional note (optional)',
                    border: OutlineInputBorder(),
                  ),
                ),
              ],
            ),
          ),
        ),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Keep ride'),
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
            child: const Text('Cancel ride'),
          ),
        ],
      ),
    ),
  );
  note.dispose();
  return result;
}
