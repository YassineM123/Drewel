import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../../common/colors.dart';
import '../../../data/apis/api_models/ride_message_model.dart';
import '../../../data/services/voice_player_manager.dart';

String formatVoiceDuration(Duration duration) {
  final int totalSeconds = duration.inSeconds.clamp(0, 5999);
  return '${totalSeconds ~/ 60}:${(totalSeconds % 60).toString().padLeft(2, '0')}';
}

/// Chat bubble for a voice note. Mirrors the text bubble geometry/colors so
/// sent and received notes keep the existing visual language.
class VoiceMessageBubble extends StatelessWidget {
  const VoiceMessageBubble({
    super.key,
    required this.message,
    required this.mine,
    required this.player,
    this.uploading = false,
    this.failed = false,
    this.onRetry,
  });

  final RideMessageModel message;
  final bool mine;
  final VoicePlayerManager player;
  final bool uploading;
  final bool failed;
  final VoidCallback? onRetry;

  static const Color _incomingBackground = Color(0xFFE7E7E7);

  @override
  Widget build(BuildContext context) {
    final Color background = mine ? primaryColor : _incomingBackground;
    final Color foreground = mine ? Colors.white : textColor;
    final Widget body;

    if (uploading) {
      body = _UploadingBody(background: background, foreground: foreground);
    } else if (failed) {
      body = _FailedBody(onRetry: onRetry);
    } else {
      body = _PlaybackBody(
        message: message,
        mine: mine,
        player: player,
        foreground: foreground,
      );
    }

    return Container(
      constraints: BoxConstraints(
        maxWidth: (MediaQuery.sizeOf(context).width * 0.72)
            .clamp(240.0, 420.0)
            .toDouble(),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.only(
          topLeft: const Radius.circular(22),
          topRight: const Radius.circular(22),
          bottomLeft: Radius.circular(mine ? 22 : 4),
          bottomRight: Radius.circular(mine ? 4 : 22),
        ),
      ),
      child: body,
    );
  }
}

class _UploadingBody extends StatelessWidget {
  const _UploadingBody({required this.background, required this.foreground});

  final Color background;
  final Color foreground;

  @override
  Widget build(BuildContext context) => Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          SizedBox.square(
            dimension: 18,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: foreground.withValues(alpha: 0.85),
            ),
          ),
          const SizedBox(width: 10),
          Text(
            'uploading'.tr,
            style: TextStyle(color: foreground, fontSize: 15),
          ),
        ],
      );
}

class _FailedBody extends StatelessWidget {
  const _FailedBody({this.onRetry});

  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) => Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          const Icon(Icons.error_outline_rounded, color: Colors.red, size: 20),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              'voice_message_failed_to_send'.tr,
              style: TextStyle(color: textColor.withValues(alpha: 0.8), fontSize: 15),
            ),
          ),
          const SizedBox(width: 6),
          GestureDetector(
            onTap: onRetry,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: primaryColor.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                'retry'.tr,
                style: const TextStyle(
                  color: primaryColor,
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
        ],
      );
}

class _PlaybackBody extends StatelessWidget {
  const _PlaybackBody({
    required this.message,
    required this.mine,
    required this.player,
    required this.foreground,
  });

  final RideMessageModel message;
  final bool mine;
  final VoicePlayerManager player;
  final Color foreground;

  @override
  Widget build(BuildContext context) => Obx(() {
        final VoicePlaybackState state = player.state.value;
        final bool isActive = state.isActive(message.id);
        final bool playing =
            isActive && state.status == VoicePlaybackStatus.playing;
        final bool loading =
            isActive && state.status == VoicePlaybackStatus.loading;
        final Duration total = isActive && state.duration > Duration.zero
            ? state.duration
            : Duration(milliseconds: ((message.audioDuration ?? 0) * 1000).round());
        final Duration position = isActive ? state.position : Duration.zero;
        final double progress = total > Duration.zero
            ? (position.inMilliseconds / total.inMilliseconds).clamp(0.0, 1.0)
            : 0.0;

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Row(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                GestureDetector(
                  onTap: loading
                      ? null
                      : () => player.toggle(message.id, message.audioUrl ?? ''),
                  child: Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      color: foreground.withValues(alpha: 0.15),
                      shape: BoxShape.circle,
                    ),
                    child: loading
                        ? Padding(
                            padding: const EdgeInsets.all(10),
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: foreground,
                            ),
                          )
                        : Icon(
                            playing
                                ? Icons.pause_rounded
                                : Icons.play_arrow_rounded,
                            color: foreground,
                            size: 26,
                          ),
                  ),
                ),
                const SizedBox(width: 8),
                Flexible(
                  child: _VoiceWaveform(
                    progress: progress,
                    color: foreground,
                    animate: playing,
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  playing || (isActive && position > Duration.zero)
                      ? formatVoiceDuration(total - position)
                      : formatVoiceDuration(total),
                  style: TextStyle(
                    color: foreground.withValues(alpha: 0.9),
                    fontSize: 13,
                    fontFeatures: const <FontFeature>[FontFeature.tabularFigures()],
                  ),
                ),
              ],
            ),
            if (isActive) ...<Widget>[
              SliderTheme(
                data: SliderTheme.of(context).copyWith(
                  trackHeight: 2,
                  thumbShape:
                      const RoundSliderThumbShape(enabledThumbRadius: 6),
                  overlayShape: const RoundSliderOverlayShape(overlayRadius: 10),
                  padding: EdgeInsets.zero,
                ),
                child: Slider(
                  value: progress,
                  onChanged: (double value) => player.seek(
                    message.id,
                    Duration(
                      milliseconds:
                          (value * total.inMilliseconds).round(),
                    ),
                  ),
                  activeColor: foreground,
                  inactiveColor: foreground.withValues(alpha: 0.25),
                ),
              ),
              Align(
                alignment: Alignment.centerRight,
                child: InkWell(
                  borderRadius: BorderRadius.circular(10),
                  onTap: () => player.cycleSpeed(message.id),
                  child: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: foreground.withValues(alpha: 0.14),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      '${state.speed.toStringAsFixed(1)}x',
                      style: TextStyle(
                        color: foreground,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ],
        );
      });
}

class _VoiceWaveform extends StatelessWidget {
  const _VoiceWaveform({
    required this.progress,
    required this.color,
    required this.animate,
  });

  final double progress;
  final Color color;
  final bool animate;

  static const List<double> _bars = <double>[
    0.35, 0.55, 0.75, 0.45, 0.9, 0.65, 0.4, 0.8, 0.55, 0.95,
    0.5, 0.7, 0.35, 0.85, 0.6, 0.45, 0.75, 0.55, 0.9, 0.4,
  ];

  @override
  Widget build(BuildContext context) => SizedBox(
        height: 26,
        child: CustomPaint(
          size: const Size(double.infinity, 26),
          painter: _WaveformPainter(
            bars: _bars,
            progress: progress,
            color: color,
            animate: animate,
          ),
        ),
      );
}

class _WaveformPainter extends CustomPainter {
  _WaveformPainter({
    required this.bars,
    required this.progress,
    required this.color,
    required this.animate,
  });

  final List<double> bars;
  final double progress;
  final Color color;
  final bool animate;

  @override
  void paint(Canvas canvas, Size size) {
    const double barWidth = 3;
    const double gap = 3;
    final Paint playedPaint = Paint()..color = color;
    final Paint remainingPaint = Paint()
      ..color = color.withValues(alpha: 0.32);
    final int totalBars = bars.length;
    const double step = barWidth + gap;
    final double playableWidth =
        size.width - (totalBars * barWidth + (totalBars - 1) * gap);
    for (int i = 0; i < totalBars; i++) {
      final double x = i * step + (playableWidth > 0 ? playableWidth / 2 : 0);
      double heightFactor = bars[i];
      if (animate && progress > 0 && progress < 1) {
        // Subtle pulse near the playhead keeps the bar alive while playing.
        final double head = progress * totalBars;
        if ((i - head).abs() < 1) heightFactor *= 1.25;
      }
      final double barHeight = size.height * heightFactor.clamp(0.15, 1.0);
      final RRect bar = RRect.fromRectAndRadius(
        Rect.fromLTWH(
          x,
          (size.height - barHeight) / 2,
          barWidth,
          barHeight,
        ),
        const Radius.circular(2),
      );
      canvas.drawRRect(bar, i / totalBars <= progress ? playedPaint : remainingPaint);
    }
  }

  @override
  bool shouldRepaint(_WaveformPainter oldDelegate) =>
      oldDelegate.progress != progress ||
      oldDelegate.color != color ||
      oldDelegate.animate != animate;
}
