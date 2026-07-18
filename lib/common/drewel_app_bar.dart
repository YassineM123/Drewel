import 'dart:async';

import 'package:flutter/material.dart';

import 'colors.dart';
import 'drewel_navigation.dart';
import 'text_styles.dart';

class DrewelAppBar extends StatelessWidget implements PreferredSizeWidget {
  final String title;
  final Widget? titleWidget;
  final bool showBackButton;
  final bool showMenuButton;
  final String? fallbackRoute;
  final List<Widget>? actions;
  final FutureOr<void> Function()? onBack;
  final VoidCallback? onMenu;
  final Widget? backIcon;
  final Widget? menuIcon;

  const DrewelAppBar({
    super.key,
    required this.title,
    this.titleWidget,
    this.showBackButton = false,
    this.showMenuButton = false,
    this.fallbackRoute,
    this.actions,
    this.onBack,
    this.onMenu,
    this.backIcon,
    this.menuIcon,
  });

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context) {
    final bool displaysBack = showBackButton;
    final List<Widget> resolvedActions = <Widget>[
      ...?actions,
      if (showMenuButton)
        Builder(
          builder: (BuildContext buttonContext) => IconButton(
            tooltip: 'Menu',
            constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
            icon: menuIcon ?? const Icon(Icons.menu_rounded),
            onPressed:
                onMenu ?? () => Scaffold.of(buttonContext).openEndDrawer(),
          ),
        ),
    ];
    return AppBar(
      elevation: 0,
      shadowColor: primary3Color,
      surfaceTintColor: primary3Color,
      foregroundColor: Colors.black,
      backgroundColor: primaryColor,
      automaticallyImplyLeading: false,
      automaticallyImplyActions: false,
      leadingWidth: 56,
      leading: displaysBack
          ? IconButton(
              tooltip: 'Back',
              constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
              icon: backIcon ??
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: primary3Color.withValues(alpha: 0.92),
                      shape: BoxShape.circle,
                      boxShadow: const <BoxShadow>[
                        BoxShadow(
                          color: Color(0x22000000),
                          blurRadius: 6,
                          offset: Offset(0, 2),
                        ),
                      ],
                    ),
                    alignment: Alignment.center,
                    child: const Icon(
                      Icons.arrow_back_ios_new_rounded,
                      size: 20,
                    ),
                  ),
              onPressed: () async {
                if (onBack != null) {
                  await onBack!();
                } else {
                  await DrewelNavigation.back(
                    context,
                    fallbackRoute: fallbackRoute,
                  );
                }
              },
            )
          : null,
      centerTitle: true,
      title: titleWidget ??
          (title.isEmpty
              ? null
              : Text(title, style: MyTextStyle.titleStyle20bb)),
      actions: resolvedActions,
    );
  }
}
