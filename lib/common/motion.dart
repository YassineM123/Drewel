import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

/// Centralized motion system for Drewel — durations, curves and reusable
/// primitives so animations stay consistent instead of hand-rolled per screen.
class MotionDuration {
  static const instant = Duration(milliseconds: 100);
  static const fast = Duration(milliseconds: 160);
  static const normal = Duration(milliseconds: 220);
  static const deliberate = Duration(milliseconds: 300);
  static const major = Duration(milliseconds: 400);
}

class MotionCurve {
  static const standard = Curves.easeOutCubic;
  static const enter = Curves.easeOut;
  static const exit = Curves.easeIn;
  static const emphasized = Curves.easeOutBack;
}

/// True when the platform/user has requested reduced motion. Every motion
/// primitive below checks this and degrades to a short opacity-only fade.
bool reduceMotion(BuildContext context) =>
    MediaQuery.maybeOf(context)?.disableAnimations ?? false;

/// Entrance wrapper: opacity 0->1 + small translateY, used for screen
/// content and staggered card lists. `index` * `stagger` produces the
/// 30-60ms stagger recommended for list/card entrances.
class FadeSlideIn extends StatelessWidget {
  const FadeSlideIn({
    super.key,
    required this.child,
    this.index = 0,
    this.stagger = const Duration(milliseconds: 40),
    this.delay = Duration.zero,
    this.offsetY = 10,
    this.duration = MotionDuration.normal,
  });

  final Widget child;
  final int index;
  final Duration stagger;
  final Duration delay;
  final double offsetY;
  final Duration duration;

  @override
  Widget build(BuildContext context) {
    if (reduceMotion(context)) {
      return child;
    }
    final totalDelay = delay + stagger * index;
    return child
        .animate(delay: totalDelay)
        .fadeIn(duration: duration, curve: MotionCurve.enter)
        .slideY(
          begin: offsetY / 100,
          end: 0,
          duration: duration,
          curve: MotionCurve.standard,
        );
  }
}

/// Wraps any tappable child with the standard press-feedback scale
/// (0.97-0.985 down, spring back to 1 on release).
class AnimatedPressable extends StatefulWidget {
  const AnimatedPressable({
    super.key,
    required this.child,
    this.onTap,
    this.scaleDown = 0.97,
    this.borderRadius,
  });

  final Widget child;
  final VoidCallback? onTap;
  final double scaleDown;
  final BorderRadius? borderRadius;

  @override
  State<AnimatedPressable> createState() => _AnimatedPressableState();
}

class _AnimatedPressableState extends State<AnimatedPressable> {
  bool _pressed = false;

  void _setPressed(bool value) {
    if (_pressed == value) return;
    setState(() => _pressed = value);
  }

  @override
  Widget build(BuildContext context) {
    final scale = reduceMotion(context) ? 1.0 : (_pressed ? widget.scaleDown : 1.0);
    return GestureDetector(
      onTap: widget.onTap,
      onTapDown: (_) => _setPressed(true),
      onTapUp: (_) => _setPressed(false),
      onTapCancel: () => _setPressed(false),
      child: AnimatedScale(
        scale: scale,
        duration: MotionDuration.instant,
        curve: Curves.easeOut,
        child: widget.child,
      ),
    );
  }
}

/// Small "breathing" status dot — used for the driver online indicator.
/// A single soft pulse loop, never an aggressive radar/emergency effect.
class AnimatedStatusDot extends StatelessWidget {
  const AnimatedStatusDot({
    super.key,
    required this.color,
    this.size = 10,
  });

  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) {
    final dot = Container(
      width: size,
      height: size,
      decoration: BoxDecoration(color: color, shape: BoxShape.circle),
    );
    if (reduceMotion(context)) {
      return dot;
    }
    return dot
        .animate(onPlay: (c) => c.repeat(reverse: true))
        .fadeOut(
          begin: 1,
          duration: const Duration(milliseconds: 1100),
          curve: Curves.easeInOut,
        )
        .fadeIn(delay: const Duration(milliseconds: 1100));
  }
}

/// Animates a numeric label from its previous value to a new one (points
/// balance, KPI counters). Never animates from zero on first build.
class AnimatedNumber extends StatelessWidget {
  const AnimatedNumber({
    super.key,
    required this.value,
    required this.style,
    this.duration = MotionDuration.deliberate,
    this.builder,
  });

  final num value;
  final TextStyle? style;
  final Duration duration;
  final String Function(num)? builder;

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: value.toDouble(), end: value.toDouble()),
      duration: duration,
      curve: MotionCurve.standard,
      builder: (context, val, _) {
        final display = builder != null ? builder!(val.round()) : val.round().toString();
        return Text(display, style: style);
      },
    );
  }
}

/// Wraps a modal/bottom-sheet child with the standard scale+fade entrance
/// (backdrop opacity handled by the caller via showGeneralDialog barrier).
class MotionModal extends StatelessWidget {
  const MotionModal({super.key, required this.child, required this.animation});

  final Widget child;
  final Animation<double> animation;

  @override
  Widget build(BuildContext context) {
    final curved = CurvedAnimation(parent: animation, curve: MotionCurve.emphasized);
    return FadeTransition(
      opacity: animation,
      child: ScaleTransition(
        scale: Tween<double>(begin: 0.96, end: 1).animate(curved),
        child: child,
      ),
    );
  }
}

Future<T?> showMotionDialog<T>({
  required BuildContext context,
  required WidgetBuilder builder,
  bool barrierDismissible = true,
}) {
  return showGeneralDialog<T>(
    context: context,
    barrierDismissible: barrierDismissible,
    barrierLabel: 'dismiss',
    barrierColor: Colors.black54,
    transitionDuration: MotionDuration.deliberate,
    pageBuilder: (context, animation, secondaryAnimation) => builder(context),
    transitionBuilder: (context, animation, secondaryAnimation, child) {
      return MotionModal(animation: animation, child: child);
    },
  );
}
