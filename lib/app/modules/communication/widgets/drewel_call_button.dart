import 'package:flutter/material.dart';

class DrewelCallButton extends StatelessWidget {
  const DrewelCallButton({
    super.key,
    required this.onPressed,
    this.enabled = true,
    this.loading = false,
    this.label = 'Call',
  });

  final VoidCallback onPressed;
  final bool enabled;
  final bool loading;
  final String label;

  @override
  Widget build(BuildContext context) => Semantics(
        button: true,
        enabled: enabled && !loading,
        label: label,
        child: SizedBox(
          height: 48,
          child: FilledButton.icon(
            onPressed: enabled && !loading ? onPressed : null,
            icon: loading
                ? const SizedBox.square(
                    dimension: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.call_rounded),
            label: Text(label),
          ),
        ),
      );
}
