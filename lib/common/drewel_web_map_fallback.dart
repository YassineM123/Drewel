import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../app/data/config/app_config.dart';
import 'google_maps_web_auth_stub.dart'
    if (dart.library.html) 'google_maps_web_auth_web.dart';

class DrewelWebMapFallback extends StatefulWidget {
  const DrewelWebMapFallback({
    super.key,
    required this.googleMap,
    required this.openStreetMap,
  });

  final Widget googleMap;
  final Widget openStreetMap;

  @override
  State<DrewelWebMapFallback> createState() => _DrewelWebMapFallbackState();
}

class _DrewelWebMapFallbackState extends State<DrewelWebMapFallback> {
  StreamSubscription<void>? _authFailureSubscription;
  late bool _showOpenStreetMap;

  @override
  void initState() {
    super.initState();
    _showOpenStreetMap = AppConfig.useOpenStreetMapForCurrentPlatform ||
        (kIsWeb && googleMapsAuthenticationFailed());
    if (kIsWeb && !_showOpenStreetMap) {
      _authFailureSubscription = googleMapsAuthenticationFailures().listen((_) {
        if (mounted) setState(() => _showOpenStreetMap = true);
      });
    }
  }

  @override
  void dispose() {
    _authFailureSubscription?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) =>
      _showOpenStreetMap ? widget.openStreetMap : widget.googleMap;
}
