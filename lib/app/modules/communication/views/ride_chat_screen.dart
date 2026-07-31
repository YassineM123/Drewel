import 'dart:async';

import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../data/apis/api_constants/api_key_constants.dart';
import '../../../data/apis/api_models/ride_message_model.dart';
import '../../../data/apis/api_models/driver_points_models.dart';
import '../../../data/apis/communication_api_client.dart';
import '../../../data/repositories/driver_points_repository.dart';
import '../../active_ride/controllers/active_ride_controller.dart';
import '../../points/bindings/driver_points_binding.dart';
import '../../points/controllers/driver_points_controller.dart';
import '../../points/widgets/trip_offer_points.dart';
import '../controllers/call_state_controller.dart';

class RideChatScreen extends StatefulWidget {
  const RideChatScreen({super.key});

  @override
  State<RideChatScreen> createState() => _RideChatScreenState();
}

class _RideChatScreenState extends State<RideChatScreen> {
  final CallStateController _communication = Get.find<CallStateController>();
  DriverPointsController? _points;
  final TextEditingController _textController = TextEditingController();
  final List<RideMessageModel> _messages = <RideMessageModel>[];
  late final ApiDriverPointsRepository _offerRepository =
      ApiDriverPointsRepository(CommunicationApiClient());
  final List<TripOffer> _incomingOffers = <TripOffer>[];
  String? _offerActionLoading;
  String _selfId = '';
  String _role = '';
  bool _loading = true;
  bool _sending = false;
  String? _error;
  Timer? _refreshTimer;
  bool _refreshing = false;

  static const List<String> _quickMessages = <String>[
    'I have arrived',
    'Where are you?',
    "I'll be there in 5 minutes",
    'Please call me',
  ];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load({bool showLoader = true}) async {
    if (_refreshing) return;
    _refreshing = true;
    final String? rideId = _communication.activeRide.value?.id;
    if (rideId == null || !_communication.hasAuthorizedRide) {
      setState(() {
        _loading = false;
        _error = _communication.unavailableReason;
      });
      _refreshing = false;
      return;
    }
    try {
      final SharedPreferences preferences =
          await SharedPreferences.getInstance();
      final List<RideMessageModel> messages =
          await _communication.messageRepository.list(rideId);
      if (!mounted) return;
      final String selfId = preferences.getString(ApiKeyConstants.userId) ?? '';
      final String role = preferences.getString(ApiKeyConstants.type) ?? '';
      if (role == ApiKeyConstants.driver && _points == null) {
        DriverPointsBinding().dependencies();
        _points = Get.find<DriverPointsController>();
      }
      List<TripOffer> incoming = const <TripOffer>[];
      if (role != ApiKeyConstants.driver) {
        incoming = (await _offerRepository.getIncomingOffers())
            .where((TripOffer offer) =>
                offer.contactRideId == rideId && offer.status == 'pending')
            .toList(growable: false);
      }
      if (!mounted) return;
      setState(() {
        _selfId = selfId;
        _role = role;
        _messages.clear();
        _messages.addAll(messages);
        _incomingOffers
          ..clear()
          ..addAll(incoming);
        if (showLoader) _loading = false;
      });
      for (final RideMessageModel message in messages.where(
        (RideMessageModel message) =>
            message.senderId != selfId &&
            message.status != RideMessageStatus.read,
      )) {
        await _communication.messageRepository.markReceipt(
          rideId,
          message.id,
          RideMessageStatus.read,
        );
      }
      _refreshTimer ??= Timer.periodic(
        const Duration(seconds: 5),
        (_) => _load(showLoader: false),
      );
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'Unable to load messages. Please retry.';
      });
    } finally {
      _refreshing = false;
    }
  }

  Future<void> _send([String? quickMessage]) async {
    final String text = (quickMessage ?? _textController.text).trim();
    final String? rideId = _communication.activeRide.value?.id;
    if (text.isEmpty || rideId == null || _sending) return;
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      final RideMessageModel sent =
          await _communication.messageRepository.send(rideId, text);
      if (!mounted) return;
      setState(() {
        _messages.add(sent);
        _textController.clear();
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'Message not sent. Please retry.');
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    _textController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(
          title: const Text('Drewel secure messages'),
          actions: <Widget>[
            if (_role == ApiKeyConstants.driver &&
                _communication.activeRide.value?.status == 'contacting')
              IconButton(
                tooltip: 'points.send_trip_offer'.tr,
                onPressed: _showMissionConfirmation,
                icon: const Icon(Icons.local_offer_outlined),
              ),
          ],
        ),
        body: SafeArea(
          child: Column(
            children: <Widget>[
              if (_points != null)
                Obx(() {
                  final rideId = _communication.activeRide.value?.id ?? '';
                  final offer = _points!.offerForRide(rideId);
                  return offer == null
                      ? const SizedBox.shrink()
                      : TripOfferStatusCard(offer: offer);
                }),
              for (final TripOffer offer in _incomingOffers)
                _IncomingOfferCard(
                  offer: offer,
                  loading: _offerActionLoading == offer.id,
                  onAccept: () => _respondToOffer(offer, accept: true),
                  onDecline: () => _respondToOffer(offer, accept: false),
                ),
              if (_error != null)
                MaterialBanner(
                  content: Text(_error!),
                  actions: <Widget>[
                    TextButton(onPressed: _load, child: const Text('Retry')),
                  ],
                ),
              Expanded(
                child: _loading
                    ? const Center(child: CircularProgressIndicator())
                    : ListView.builder(
                        padding: const EdgeInsets.all(12),
                        itemCount: _messages.length,
                        itemBuilder: (BuildContext context, int index) {
                          final RideMessageModel message = _messages[index];
                          final bool mine = message.senderId == _selfId;
                          return Align(
                            alignment: mine
                                ? Alignment.centerRight
                                : Alignment.centerLeft,
                            child: Container(
                              constraints: const BoxConstraints(maxWidth: 320),
                              margin: const EdgeInsets.symmetric(vertical: 4),
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: mine
                                    ? Theme.of(context)
                                        .colorScheme
                                        .primaryContainer
                                    : Theme.of(context)
                                        .colorScheme
                                        .surfaceContainerHighest,
                                borderRadius: BorderRadius.circular(14),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: <Widget>[
                                  Text(message.text),
                                  Text(
                                    message.status.name,
                                    style:
                                        Theme.of(context).textTheme.labelSmall,
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
              ),
              if (_communication.hasAuthorizedRide) ...<Widget>[
                SizedBox(
                  height: 42,
                  child: ListView.separated(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    scrollDirection: Axis.horizontal,
                    itemCount: _quickMessages.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 8),
                    itemBuilder: (_, int index) => ActionChip(
                      label: Text(_quickMessages[index]),
                      onPressed:
                          _sending ? null : () => _send(_quickMessages[index]),
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
                  child: Row(
                    children: <Widget>[
                      Expanded(
                        child: TextField(
                          controller: _textController,
                          maxLength: 1000,
                          minLines: 1,
                          maxLines: 4,
                          decoration: const InputDecoration(
                            hintText: 'Message your ride participant',
                            counterText: '',
                            border: OutlineInputBorder(),
                          ),
                        ),
                      ),
                      IconButton.filled(
                        tooltip: 'Send message',
                        onPressed: _sending ? null : _send,
                        icon: _sending
                            ? const SizedBox.square(
                                dimension: 18,
                                child:
                                    CircularProgressIndicator(strokeWidth: 2),
                              )
                            : const Icon(Icons.send_rounded),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      );

  Future<void> _respondToOffer(
    TripOffer offer, {
    required bool accept,
  }) async {
    if (_offerActionLoading != null) return;
    final bool confirmed = await showDialog<bool>(
          context: context,
          builder: (BuildContext dialogContext) => AlertDialog(
            title: Text(accept ? 'Accept trip offer?' : 'Decline trip offer?'),
            content: Text(
              accept
                  ? 'Accepting creates your active ride and confirms the '
                      'driver’s offer.'
                  : 'The driver’s reserved points will be released.',
            ),
            actions: <Widget>[
              TextButton(
                onPressed: () => Navigator.pop(dialogContext, false),
                child: const Text('Back'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(dialogContext, true),
                child: Text(accept ? 'Accept offer' : 'Decline offer'),
              ),
            ],
          ),
        ) ??
        false;
    if (!confirmed || !mounted) return;
    setState(() => _offerActionLoading = offer.id);
    final String key = 'offer:${offer.id}:${accept ? 'accept' : 'decline'}:'
        '${DateTime.now().microsecondsSinceEpoch}';
    try {
      if (accept) {
        await _offerRepository.acceptOffer(offer.id, idempotencyKey: key);
      } else {
        await _offerRepository.declineOffer(offer.id, idempotencyKey: key);
      }
      if (Get.isRegistered<ActiveRideController>()) {
        await Get.find<ActiveRideController>().recover(showLoader: false);
      }
      await _communication.refreshActiveRide();
      if (!mounted) return;
      setState(() => _incomingOffers.removeWhere(
            (TripOffer candidate) => candidate.id == offer.id,
          ));
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content:
              Text(accept ? 'Trip offer accepted.' : 'Trip offer declined.'),
        ),
      );
    } on CommunicationApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _offerActionLoading = null);
    }
  }

  Future<void> _showMissionConfirmation() async {
    final DriverPointsController? pointsController = _points;
    if (pointsController == null) return;
    final TextEditingController pickup = TextEditingController();
    final TextEditingController pickupLat = TextEditingController();
    final TextEditingController pickupLong = TextEditingController();
    final TextEditingController destination = TextEditingController();
    final TextEditingController destinationLat = TextEditingController();
    final TextEditingController destinationLong = TextEditingController();
    final TextEditingController price = TextEditingController();
    final TextEditingController currency = TextEditingController(text: 'AED');
    final bool? confirmed = await showDialog<bool>(
      context: context,
      builder: (BuildContext dialogContext) => AlertDialog(
        title: Text('points.send_trip_offer'.tr),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              TextField(
                controller: pickup,
                decoration: InputDecoration(labelText: 'points.pickup'.tr),
              ),
              Row(
                children: <Widget>[
                  Expanded(
                    child: TextField(
                      controller: pickupLat,
                      keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                      decoration:
                          InputDecoration(labelText: 'points.pickup_lat'.tr),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      controller: pickupLong,
                      keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                      decoration:
                          InputDecoration(labelText: 'points.pickup_long'.tr),
                    ),
                  ),
                ],
              ),
              TextField(
                controller: destination,
                decoration: InputDecoration(labelText: 'points.destination'.tr),
              ),
              Row(
                children: <Widget>[
                  Expanded(
                    child: TextField(
                      controller: destinationLat,
                      keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                      decoration: InputDecoration(
                        labelText: 'points.destination_lat'.tr,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      controller: destinationLong,
                      keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                      decoration: InputDecoration(
                        labelText: 'points.destination_long'.tr,
                      ),
                    ),
                  ),
                ],
              ),
              TextField(
                controller: price,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration:
                    InputDecoration(labelText: 'points.offered_price'.tr),
              ),
              TextField(
                controller: currency,
                textCapitalization: TextCapitalization.characters,
                maxLength: 3,
                decoration: InputDecoration(labelText: 'points.currency'.tr),
              ),
            ],
          ),
        ),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: Text('points.cancel'.tr),
          ),
          FilledButton(
            onPressed: () {
              if (pickup.text.trim().isEmpty ||
                  destination.text.trim().isEmpty ||
                  double.tryParse(pickupLat.text.trim()) == null ||
                  double.tryParse(pickupLong.text.trim()) == null ||
                  double.tryParse(destinationLat.text.trim()) == null ||
                  double.tryParse(destinationLong.text.trim()) == null ||
                  double.tryParse(price.text.trim()) == null ||
                  currency.text.trim().length != 3) {
                return;
              }
              Navigator.pop(dialogContext, true);
            },
            child: Text('points.continue'.tr),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) {
      pickup.dispose();
      pickupLat.dispose();
      pickupLong.dispose();
      destination.dispose();
      destinationLat.dispose();
      destinationLong.dispose();
      price.dispose();
      currency.dispose();
      return;
    }
    final draft = TripOfferDraft(
      contactRideId: _communication.activeRide.value?.id ?? '',
      pickup: <String, dynamic>{
        'address': pickup.text.trim(),
        'lat': double.parse(pickupLat.text.trim()),
        'long': double.parse(pickupLong.text.trim()),
      },
      destination: <String, dynamic>{
        'address': destination.text.trim(),
        'lat': double.parse(destinationLat.text.trim()),
        'long': double.parse(destinationLong.text.trim()),
      },
      offeredPrice: double.parse(price.text.trim()),
      currency: currency.text.trim().toUpperCase(),
    );
    final bool send =
        await showOfferReservationConfirmation(context, pointsController);
    if (!send || !mounted) {
      pickup.dispose();
      pickupLat.dispose();
      pickupLong.dispose();
      destination.dispose();
      destinationLat.dispose();
      destinationLong.dispose();
      price.dispose();
      currency.dispose();
      return;
    }
    final SendOfferResult result = await pointsController.sendOffer(draft);
    pickup.dispose();
    pickupLat.dispose();
    pickupLong.dispose();
    destination.dispose();
    destinationLat.dispose();
    destinationLong.dispose();
    price.dispose();
    currency.dispose();
    if (!mounted) return;
    // Successful reservations are already shown by the offer status card and
    // the deduplicated realtime notification. Only surface failures here.
    if (result != SendOfferResult.sent) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            result == SendOfferResult.insufficientPoints
                ? 'points.insufficient'.tr
                : 'points.send_failed'.tr,
          ),
        ),
      );
    }
  }
}

class _IncomingOfferCard extends StatelessWidget {
  const _IncomingOfferCard({
    required this.offer,
    required this.loading,
    required this.onAccept,
    required this.onDecline,
  });

  final TripOffer offer;
  final bool loading;
  final VoidCallback onAccept;
  final VoidCallback onDecline;

  @override
  Widget build(BuildContext context) {
    String address(Map<String, dynamic>? location, String fallback) =>
        (location?['address'] ?? fallback).toString();
    return Card(
      margin: const EdgeInsets.fromLTRB(12, 8, 12, 0),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Row(
              children: <Widget>[
                const Icon(Icons.local_offer_outlined),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Trip offer',
                    style: Theme.of(context)
                        .textTheme
                        .titleMedium
                        ?.copyWith(fontWeight: FontWeight.w700),
                  ),
                ),
                if (offer.offeredPrice != null)
                  Text(
                    '${offer.offeredPrice!.toStringAsFixed(2)} '
                    '${offer.currency ?? ''}',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
              ],
            ),
            const SizedBox(height: 10),
            Text('Pickup: ${address(offer.pickup, 'Pickup location')}'),
            Text(
              'Destination: ${address(offer.destination, 'Destination')}',
            ),
            if (offer.note?.trim().isNotEmpty == true) Text(offer.note!),
            const SizedBox(height: 12),
            Row(
              children: <Widget>[
                Expanded(
                  child: OutlinedButton(
                    onPressed: loading ? null : onDecline,
                    child: const Text('Decline'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: FilledButton(
                    onPressed: loading ? null : onAccept,
                    child: loading
                        ? const SizedBox.square(
                            dimension: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Text('Accept'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
