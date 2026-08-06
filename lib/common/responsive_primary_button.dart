import 'package:flutter/material.dart';

class ResponsivePrimaryButton extends StatelessWidget {
  const ResponsivePrimaryButton({
    super.key,
    required this.child,
    required this.onPressed,
    this.isLoading = false,
    this.backgroundColor,
    this.foregroundColor,
    this.margin,
    this.height = 48,
    this.semanticLabel,
  });

  final Widget child;
  final VoidCallback? onPressed;
  final bool isLoading;
  final Color? backgroundColor;
  final Color? foregroundColor;
  final EdgeInsetsGeometry? margin;
  final double height;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final Color buttonColor =
        backgroundColor ?? Theme.of(context).colorScheme.primary;
    final Color contentColor =
        foregroundColor ?? Theme.of(context).colorScheme.onPrimary;

    return Semantics(
      button: true,
      label: semanticLabel,
      child: Padding(
        padding: margin ?? EdgeInsets.zero,
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: height, minWidth: 48),
          child: SizedBox(
            width: double.infinity,
            height: height,
            child: FilledButton(
              onPressed: isLoading ? null : onPressed,
              style: FilledButton.styleFrom(
                backgroundColor: buttonColor,
                foregroundColor: contentColor,
                disabledBackgroundColor: buttonColor.withValues(alpha: 0.7),
                disabledForegroundColor: contentColor,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: isLoading
                  ? SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation<Color>(contentColor),
                      ),
                    )
                  : child,
            ),
          ),
        ),
      ),
    );
  }
}
