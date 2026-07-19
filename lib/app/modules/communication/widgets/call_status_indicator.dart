import 'package:flutter/material.dart';

import '../../../data/apis/api_models/call_session_model.dart';
import '../../../data/services/agora_call_service.dart';

class CallStatusIndicator extends StatelessWidget {
  const CallStatusIndicator({
    super.key,
    required this.status,
    required this.connectionState,
  });

  final CallSessionStatus status;
  final AgoraConnectionState connectionState;

  @override
  Widget build(BuildContext context) {
    final String label = switch (connectionState) {
      AgoraConnectionState.connecting => 'Connecting securely…',
      AgoraConnectionState.connected => 'Drewel secure call',
      AgoraConnectionState.reconnecting => 'Reconnecting…',
      AgoraConnectionState.failed => 'Unable to connect',
      AgoraConnectionState.idle => switch (status) {
          CallSessionStatus.initiating => 'Calling…',
          CallSessionStatus.ringing => 'Ringing…',
          CallSessionStatus.accepted => 'Call accepted',
          _ => status.name,
        },
    };
    return Semantics(
      liveRegion: true,
      label: label,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          if (connectionState == AgoraConnectionState.connecting ||
              connectionState == AgoraConnectionState.reconnecting)
            const Padding(
              padding: EdgeInsets.only(right: 8),
              child: SizedBox.square(
                dimension: 14,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            ),
          Text(label),
        ],
      ),
    );
  }
}
