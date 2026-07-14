import 'package:flutter/cupertino.dart';

class CommonMethods {
  static const String cur = '\$';

  static void unFocsKeyBoard() {
    FocusManager.instance.primaryFocus?.unfocus();
  }
}
