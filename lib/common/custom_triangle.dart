import 'package:flutter/material.dart';

class CustomTriangle extends CustomPainter {
  final bool showRightSide;
  CustomTriangle({required this.showRightSide});
  @override
  void paint(Canvas canvas, Size size) {
    final double width = size.width;
    final double height = size.height;

    final path = Path();
    path.moveTo(0, 0); // Top left corner

    path.lineTo(width, 0);
    showRightSide
        ? path.lineTo(0, height)
        : path.lineTo(width, height); // Top right corner
    path.lineTo(0, 0); // Top left corner
    path.close();

    final paint = Paint()..color = Colors.blue;

    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(CustomPainter oldDelegate) {
    return false;
  }
}
