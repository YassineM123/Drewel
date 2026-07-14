import 'package:flutter/widgets.dart';

class ResponsiveSize {
  static const double figmaScreenWidth = 430; // Replace with Figma width
  static const double figmaScreenHeight = 932; // Replace with Figma height

  static double width(BuildContext context, double figmaWidth) {
    double screenWidth = MediaQuery.of(context).size.width;
    return (figmaWidth / figmaScreenWidth) * screenWidth;
  }

  /// Calculate responsive height based on Figma design
  static double height(BuildContext context, double figmaHeight) {
    double screenHeight = MediaQuery.of(context).size.height;
    return (figmaHeight / figmaScreenHeight) * screenHeight;
  }
}
