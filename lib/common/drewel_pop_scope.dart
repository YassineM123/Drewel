import 'package:flutter/material.dart';

import 'drewel_navigation.dart';

class DrewelPopScope extends StatefulWidget {
  final Widget child;
  final String? fallbackRoute;
  final bool hasUnsavedChanges;
  final Future<bool> Function()? confirmDiscard;
  final Future<void> Function()? onBack;

  const DrewelPopScope({
    super.key,
    required this.child,
    this.fallbackRoute,
    this.hasUnsavedChanges = false,
    this.confirmDiscard,
    this.onBack,
  });

  @override
  State<DrewelPopScope> createState() => _DrewelPopScopeState();
}

class _DrewelPopScopeState extends State<DrewelPopScope> {
  bool _isLeaving = false;

  Future<bool> _confirmDiscard() async {
    if (widget.confirmDiscard != null) {
      return widget.confirmDiscard!();
    }
    return await showDialog<bool>(
          context: context,
          builder: (BuildContext dialogContext) => AlertDialog(
            title: const Text('Discard changes?'),
            content: const Text(
              'You have unsaved changes. Are you sure you want to leave?',
            ),
            actions: <Widget>[
              TextButton(
                onPressed: () => Navigator.pop(dialogContext, false),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(dialogContext, true),
                child: const Text('Discard'),
              ),
            ],
          ),
        ) ??
        false;
  }

  Future<void> _requestPop() async {
    if (_isLeaving) return;
    if (widget.hasUnsavedChanges && !await _confirmDiscard()) return;
    if (mounted) {
      setState(() => _isLeaving = true);
    }
    if (!mounted) return;

    if (widget.onBack != null) {
      await widget.onBack!();
      return;
    }

    final NavigatorState navigator = Navigator.of(context);
    if (navigator.canPop()) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (navigator.mounted) navigator.pop();
      });
      return;
    }

    await DrewelNavigation.back(
      context,
      fallbackRoute: widget.fallbackRoute,
    );
    if (mounted) {
      setState(() => _isLeaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bool canPop = _isLeaving ||
        (!widget.hasUnsavedChanges && Navigator.of(context).canPop());
    return PopScope<Object?>(
      canPop: canPop,
      onPopInvokedWithResult: (bool didPop, Object? result) async {
        if (!didPop) await _requestPop();
      },
      child: widget.child,
    );
  }
}
