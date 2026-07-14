import 'package:flutter/material.dart';

class MThemeData {
  static ThemeData themeData() {
    return ThemeData(
      fontFamily: 'FontBold',
      primarySwatch: Colors.red,
      // primarySwatch:  Colors.lightBlue,
      primaryColor: const Color(0xFFBE1B2C),
      secondaryHeaderColor: const Color(0xFFBE1B2C),
      hintColor: const Color(0xFFBE1B2C),
      focusColor: const Color(0xFFBE1B2C), // TextColor
      hoverColor: const Color(0xFFBE1B2C),
      highlightColor: const Color(0xFFBE1B2C), // primary3Color
      unselectedWidgetColor: const Color(0xFFBE1B2C),
      cardColor: const Color(0xFFFFFFFF),
      cardTheme: const CardThemeData(
        surfaceTintColor: Colors.white,
      ), // primary3Color
    );
  }
}
