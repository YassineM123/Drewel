import 'dart:math';

import 'package:flutter/material.dart';

class CircularIndicatorPainter extends CustomPainter {
  final List<Color> colors = [
    Colors.red, // User cancel order
    Colors.orange, // Vendor cancel order
    Colors.green, // Order complete
    Colors.blue, // Order cancel due to error
  ];

  final List<double> percentages = [
    25, // User cancel order
    35, // Vendor cancel order
    38, // Order complete
    2, // Order cancel due to error
  ];

  @override
  void paint(Canvas canvas, Size size) {
    final Paint paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 20
      ..strokeCap = StrokeCap.round;

    const double total = 100;
    double startAngle = -pi / 2;
    final double radius = size.width / 2;

    for (int i = 0; i < percentages.length; i++) {
      final sweepAngle = (percentages[i] / total) * 2 * pi;
      paint.color = colors[i];
      canvas.drawArc(
        Rect.fromCircle(center: Offset(radius, radius), radius: radius),
        startAngle,
        sweepAngle,
        false,
        paint,
      );
      startAngle += sweepAngle;
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
