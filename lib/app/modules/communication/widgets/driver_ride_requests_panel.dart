import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../data/apis/api_models/active_ride_model.dart';
import '../controllers/call_state_controller.dart';

class DriverRideRequestsPanel extends StatefulWidget {
  const DriverRideRequestsPanel({super.key});

  @override
  State<DriverRideRequestsPanel> createState() =>
      _DriverRideRequestsPanelState();
}

class _DriverRideRequestsPanelState extends State<DriverRideRequestsPanel> {
  final CallStateController _controller = Get.find<CallStateController>();
  List<ActiveRideModel> _requests = const <ActiveRideModel>[];
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (_loading) return;
    setState(() => _loading = true);
    try {
      final requests = await _controller.listRequestedRides();
      if (mounted) setState(() => _requests = requests);
    } catch (_) {
      // The backend may not expose ride requests until the account is a driver.
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _transition(ActiveRideModel ride, String status) async {
    setState(() => _loading = true);
    try {
      await _controller.transitionRide(ride.id, status);
      if (mounted) {
        setState(() => _requests = _requests
            .where((ActiveRideModel item) => item.id != ride.id)
            .toList(growable: false));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    if (_requests.isEmpty) return const SizedBox.shrink();
    final ActiveRideModel ride = _requests.first;
    return Material(
      elevation: 6,
      child: Padding(
        padding: const EdgeInsets.all(10),
        child: Row(
          children: <Widget>[
            Expanded(
              child: Text(
                '${ride.passenger?.firstName ?? 'Passenger'} requested a ride',
              ),
            ),
            TextButton(
              onPressed: _loading ? null : () => _transition(ride, 'cancelled'),
              child: const Text('Decline'),
            ),
            FilledButton(
              onPressed: _loading ? null : () => _transition(ride, 'accepted'),
              child: const Text('Accept'),
            ),
          ],
        ),
      ),
    );
  }
}
