import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:get/get.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../../common/colors.dart';
import '../../../data/apis/api_constants/api_key_constants.dart';
import '../../../data/apis/api_models/ride_message_model.dart';
import '../../../data/apis/api_models/ride_conversation_model.dart';
import '../../../data/apis/api_models/active_ride_model.dart';
import '../../../data/apis/api_models/driver_points_models.dart';
import '../../../data/apis/communication_api_client.dart';
import '../../../data/repositories/driver_points_repository.dart';
import '../../../data/repositories/active_ride_repository.dart';
import '../../../data/repositories/ride_message_repository.dart';
import '../../../routes/app_pages.dart';
import '../../active_ride/controllers/active_ride_controller.dart';
import '../../points/bindings/driver_points_binding.dart';
import '../../points/controllers/driver_points_controller.dart';
import '../../points/widgets/trip_offer_points.dart';
import '../../user_home/widgets/trip_request_map_sheet.dart';
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
  late final ActiveRideRepository _rideRepository =
      ActiveRideRepository(CommunicationApiClient());
  final List<TripOffer> _incomingOffers = <TripOffer>[];
  String? _offerActionLoading;
  RideConversationModel? _conversation;
  ActiveRideModel? _routeRide;
  String _selfId = '';
  String _role = '';
  bool _loading = true;
  bool _sending = false;
  String? _error;
  String? _failedMessageText;
  String? _failedClientMessageId;
  Timer? _refreshTimer;
  bool _refreshing = false;

  static const List<String> _quickMessages = <String>[
    "I'm here",
    'On my way',
    'Call me',
    "I'm waiting",
  ];

  String? get _rideId {
    final Object? arguments = Get.arguments;
    if (arguments is Map && arguments['rideId'] != null) {
      return arguments['rideId'].toString();
    }
    return _communication.activeRide.value?.id;
  }

  /// Authorization is fetched for this exact thread. Never borrow permission
  /// from an unrelated global active ride, and never make a valid contact chat
  /// read-only just because that global controller has not refreshed yet.
  // `contactAllowed` is the backend policy result for this exact ride. It
  // intentionally supports the server-defined post-completion grace period.
  bool get _canChat => _routeRide?.canCommunicate == true;

  bool get _isDesktopPlatform =>
      !kIsWeb &&
      <TargetPlatform>{
        TargetPlatform.windows,
        TargetPlatform.macOS,
        TargetPlatform.linux,
      }.contains(defaultTargetPlatform);

  String get _chatTitle {
    final RideConversationModel? conversation = _conversation;
    final String name = conversation?.counterpart?.displayName.trim() ?? '';
    if (name.isNotEmpty) return name;
    final String fallback = _communication.counterpart?.firstName.trim() ?? '';
    return fallback.isNotEmpty ? fallback : 'Drewel secure chat';
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load({bool showLoader = true}) async {
    if (_refreshing) return;
    _refreshing = true;
    final String? rideId = _rideId;
    if (rideId == null) {
      setState(() {
        _loading = false;
        _error = _communication.unavailableReason;
      });
      _refreshing = false;
      return;
    }
    try {
      ActiveRideModel? routeRide;
      try {
        routeRide = await _rideRepository.getRide(rideId);
      } on CommunicationApiException {
        // A historical conversation remains readable when its ride cannot be
        // refreshed; it deliberately remains read-only in that case.
      }
      final List<RideMessageModel> messages =
          await _communication.messageRepository.list(rideId);
      RideConversationModel? conversation;
      try {
        conversation = await _communication.conversationRepository.get(rideId);
        await _communication.markConversationRead(rideId);
      } catch (_) {
        // Header falls back to the active ride participant.
      }
      if (!mounted) return;
      final SharedPreferences preferences =
          await SharedPreferences.getInstance();
      final String selfId = preferences.getString(ApiKeyConstants.userId) ?? '';
      final String role = preferences.getString(ApiKeyConstants.type) ?? '';
      if (role == ApiKeyConstants.driver && _points == null) {
        DriverPointsBinding().dependencies();
        _points = Get.find<DriverPointsController>();
      }
      List<TripOffer> incoming = const <TripOffer>[];
      if (role != ApiKeyConstants.driver) {
        try {
          incoming = (await _offerRepository.getIncomingOffers())
              .where((TripOffer offer) =>
                  offer.contactRideId == rideId && offer.status == 'pending')
              .toList(growable: false);
        } on CommunicationApiException {
          // Keep the authorized conversation available if the independent
          // offer refresh is temporarily unavailable.
        }
      }
      if (!mounted) return;
      setState(() {
        _selfId = selfId;
        _role = role;
        _conversation = conversation;
        _routeRide = routeRide;
        _messages.clear();
        _messages.addAll(messages);
        _incomingOffers
          ..clear()
          ..addAll(incoming);
        if (_failedMessageText == null) _error = null;
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

  Future<void> _send([String? quickMessage, String? clientMessageId]) async {
    final String text = (quickMessage ?? _textController.text).trim();
    final String? rideId = _rideId;
    if (text.isEmpty || rideId == null || _sending) return;
    final String idempotencyKey =
        clientMessageId ?? RideMessageRepository.newClientMessageId();
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      final RideMessageModel sent = await _communication.messageRepository.send(
        rideId,
        text,
        clientMessageId: idempotencyKey,
      );
      if (!mounted) return;
      setState(() {
        _messages.add(sent);
        _textController.clear();
        _failedMessageText = null;
        _failedClientMessageId = null;
      });
    } on CommunicationApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _failedMessageText = text;
        _failedClientMessageId = idempotencyKey;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Message not sent. Please retry.';
        _failedMessageText = text;
        _failedClientMessageId = idempotencyKey;
      });
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  void _retryFailedMessage() {
    final String? text = _failedMessageText;
    if (text == null) {
      _load(showLoader: false);
      return;
    }
    _send(text, _failedClientMessageId);
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    _textController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: const Color(0xFFFCFCFC),
        appBar: AppBar(
          backgroundColor: const Color(0xFFFCFCFC),
          elevation: 0,
          scrolledUnderElevation: 0,
          centerTitle: true,
          leading: IconButton(
            tooltip: 'Back',
            onPressed: Get.back,
            icon: const Icon(Icons.arrow_back_rounded, color: primaryColor),
          ),
          title: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Text(
                _chatTitle,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: textColor,
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 3),
              _CounterpartSubtitle(
                conversation: _conversation,
                contactAllowed: _canChat,
              ),
            ],
          ),
          actions: <Widget>[
            if (_role == ApiKeyConstants.driver &&
                _routeRide?.status == 'contacting')
              IconButton(
                tooltip: 'points.send_trip_offer'.tr,
                onPressed: _showMissionConfirmation,
                icon: const Icon(Icons.local_offer_outlined),
              ),
            if (_canChat)
              IconButton(
                tooltip: 'Call',
                onPressed: () => _callParticipant(context),
                icon: const Icon(
                  Icons.phone_in_talk_outlined,
                  color: primaryColor,
                ),
              ),
            const SizedBox(width: 6),
          ],
          bottom: PreferredSize(
            preferredSize: const Size.fromHeight(1),
            child: Divider(
              height: 1,
              thickness: 1,
              color: primaryColor.withValues(alpha: 0.18),
            ),
          ),
        ),
        body: SafeArea(
          child: Column(
            children: <Widget>[
              if (_points != null)
                Obx(() {
                  final String rideId = _rideId ?? '';
                  final TripOffer? offer = _points!.offerForRide(rideId);
                  return offer == null
                      ? const SizedBox.shrink()
                      : TripOfferStatusCard(
                          offer: offer,
                        );
                }),
              for (final TripOffer offer in _incomingOffers)
                _IncomingOfferCard(
                  offer: offer,
                  loading: _offerActionLoading == offer.id,
                  onDetails: () => _showOfferDetails(offer),
                  onAccept: () => _respondToOffer(offer, accept: true),
                  onDecline: () => _respondToOffer(offer, accept: false),
                ),
              if (_error != null)
                MaterialBanner(
                  content: Text(_error!),
                  actions: <Widget>[
                    TextButton(
                      onPressed: _retryFailedMessage,
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              Expanded(
                child: _loading
                    ? const Center(child: CircularProgressIndicator())
                    : _MessageList(
                        messages: _messages,
                        selfId: _selfId,
                        role: _role,
                        conversation: _conversation,
                        routeRide: _routeRide,
                        onRefresh: () => _load(showLoader: false),
                        onSendOfferFromRequest: _role == ApiKeyConstants.driver
                            ? _sendOfferFromTripRequest
                            : null,
                      ),
              ),
              _canChat
                  ? _QuickReplyBar(
                      quickMessages: _quickMessages,
                      sending: _sending,
                      onSend: _send,
                    )
                  : const _ReadOnlyConversationNotice(),
              _canChat
                  ? _ChatComposer(
                      textController: _textController,
                      hintText: 'Message $_chatTitle...',
                      sending: _sending,
                      role: _role,
                      rideStatus: _routeRide?.status,
                      onSend: _send,
                      onOffer: _showMissionConfirmation,
                      onTripRequest: _showPassengerTripRequest,
                    )
                  : const SizedBox.shrink(),
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
            icon: CircleAvatar(
              backgroundColor:
                  (accept ? primaryColor : text2Color).withValues(alpha: 0.12),
              child: Icon(
                accept ? Icons.verified_rounded : Icons.close_rounded,
                color: accept ? primaryColor : text2Color,
              ),
            ),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(24),
            ),
            title: Text(accept ? 'Confirm this drive?' : 'Decline this offer?'),
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
                child: Text(accept ? 'Confirm drive' : 'Decline offer'),
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
          content: Text(accept
              ? 'Drive confirmed. Your ride is ready.'
              : 'Trip offer declined.'),
        ),
      );
      if (accept) {
        // The offer service has already created the active ride on the server.
        // Move straight into its live route/status view; GPS tracking begins
        // only when the driver starts navigation, never from a client guess.
        Get.offNamed(Routes.ACTIVE_RIDE);
      }
    } on CommunicationApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _offerActionLoading = null);
    }
  }

  Future<void> _showOfferDetails(TripOffer offer) async {
    String address(Map<String, dynamic>? location, String fallback) =>
        (location?['address'] ?? fallback).toString();
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      backgroundColor: const Color(0xFFFFFBFC),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (BuildContext sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text('Trip details',
                  style: Theme.of(sheetContext).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w800,
                      )),
              const SizedBox(height: 16),
              _OfferLocationRow(
                icon: Icons.radio_button_checked_rounded,
                label: 'PICKUP',
                value: address(offer.pickup, 'Pickup location'),
              ),
              _OfferLocationRow(
                icon: Icons.location_on_rounded,
                label: 'DESTINATION',
                value: address(offer.destination, 'Destination'),
              ),
              if (offer.offeredPrice != null) ...<Widget>[
                const Divider(height: 24),
                Text(
                  '${offer.offeredPrice!.toStringAsFixed(2)} ${offer.currency ?? ''}',
                  style: Theme.of(sheetContext)
                      .textTheme
                      .headlineSmall
                      ?.copyWith(
                          color: primaryColor, fontWeight: FontWeight.w800),
                ),
              ],
              if (offer.note?.trim().isNotEmpty == true) ...<Widget>[
                const SizedBox(height: 12),
                Text(offer.note!),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _showPassengerTripRequest() async {
    if (_role == ApiKeyConstants.driver) return;
    final String? rideId = _rideId;
    if (rideId == null || _sending) return;
    final RideCoordinateModel? existingPickup = _routeRide?.pickup;
    TripRouteRequest? route;
    if (existingPickup?.isValid != true && _isDesktopPlatform) {
      route = await _showManualTripRouteDialog();
    } else {
      LatLng pickup;
      String pickupAddress;
      if (existingPickup?.isValid == true) {
        pickup = LatLng(existingPickup!.latitude, existingPickup.longitude);
        pickupAddress = existingPickup.address;
      } else {
        final Position? position = await _currentPassengerPosition();
        if (position == null || !mounted) return;
        pickup = LatLng(position.latitude, position.longitude);
        pickupAddress = 'Current location';
      }
      route = await showTripRequestMapSheet(
        context,
        pickup: pickup,
        pickupAddress: pickupAddress,
      );
    }
    if (route == null && _isDesktopPlatform && mounted) {
      route = await _showManualTripRouteDialog();
    }
    if (route == null || !mounted) return;
    final TextEditingController price = TextEditingController();
    final TextEditingController currency = TextEditingController(text: 'AED');
    final TextEditingController note = TextEditingController();
    final bool? confirmed = await showDialog<bool>(
      context: context,
      builder: (BuildContext dialogContext) => AlertDialog(
        icon: const CircleAvatar(
          backgroundColor: Color(0x1FBE1B2C),
          child: Icon(Icons.add_road_rounded, color: primaryColor),
        ),
        title: const Text('Send trip request'),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            TextField(
              controller: price,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(labelText: 'Proposed price'),
            ),
            TextField(
              controller: currency,
              textCapitalization: TextCapitalization.characters,
              maxLength: 3,
              decoration: const InputDecoration(labelText: 'Currency'),
            ),
            TextField(
              controller: note,
              maxLength: 240,
              maxLines: 2,
              decoration: const InputDecoration(
                labelText: 'Note for the driver (optional)',
                counterText: '',
              ),
            ),
          ],
        ),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              final double? parsed = double.tryParse(price.text.trim());
              if (parsed == null ||
                  parsed < 0 ||
                  currency.text.trim().length != 3) {
                return;
              }
              Navigator.pop(dialogContext, true);
            },
            child: const Text('Send'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) {
      _disposeControllers(<TextEditingController>[price, currency, note]);
      return;
    }
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      final RideMessageModel sent =
          await _communication.messageRepository.sendTripRequest(
        rideId,
        pickup: route.pickup,
        destination: route.destination,
        proposedPrice: double.parse(price.text.trim()),
        currency: currency.text.trim().toUpperCase(),
        note: note.text.trim(),
      );
      if (!mounted) return;
      setState(() {
        _cancelOlderTripRequests(sent);
        _messages.add(sent);
      });
      try {
        _routeRide = await _rideRepository.getRide(rideId);
      } catch (_) {}
    } on CommunicationApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      _disposeControllers(<TextEditingController>[price, currency, note]);
      if (mounted) setState(() => _sending = false);
    }
  }

  void _cancelOlderTripRequests(RideMessageModel latest) {
    for (int index = 0; index < _messages.length; index += 1) {
      final RideMessageModel message = _messages[index];
      if (!message.isTripRequest ||
          message.rideId != latest.rideId ||
          message.id == latest.id ||
          message.isCancelledTripRequest) {
        continue;
      }
      final Map<String, dynamic> metadata = Map<String, dynamic>.from(
          message.metadata ?? const <String, dynamic>{});
      metadata['tripRequestStatus'] = 'cancelled';
      metadata['cancellationReason'] = 'superseded';
      metadata['supersededByMessageId'] = latest.id;
      _messages[index] = message.copyWith(metadata: metadata);
    }
  }

  Future<TripRouteRequest?> _showManualTripRouteDialog() async {
    final TextEditingController pickup = TextEditingController(
      text: _routeRide?.pickup?.address ?? '',
    );
    final TextEditingController pickupLat = TextEditingController(
      text: _routeRide?.pickup?.isValid == true
          ? _routeRide!.pickup!.latitude.toStringAsFixed(6)
          : '',
    );
    final TextEditingController pickupLong = TextEditingController(
      text: _routeRide?.pickup?.isValid == true
          ? _routeRide!.pickup!.longitude.toStringAsFixed(6)
          : '',
    );
    final TextEditingController destination = TextEditingController(
      text: _routeRide?.destination?.address ?? '',
    );
    final TextEditingController destinationLat = TextEditingController(
      text: _routeRide?.destination?.isValid == true
          ? _routeRide!.destination!.latitude.toStringAsFixed(6)
          : '',
    );
    final TextEditingController destinationLong = TextEditingController(
      text: _routeRide?.destination?.isValid == true
          ? _routeRide!.destination!.longitude.toStringAsFixed(6)
          : '',
    );
    final bool? confirmed = await showDialog<bool>(
      context: context,
      builder: (BuildContext dialogContext) => AlertDialog(
        icon: const CircleAvatar(
          backgroundColor: Color(0x1FBE1B2C),
          child: Icon(Icons.route_rounded, color: primaryColor),
        ),
        title: const Text('Trip route'),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              TextField(
                controller: pickup,
                decoration: const InputDecoration(labelText: 'Pickup address'),
              ),
              Row(
                children: <Widget>[
                  Expanded(
                    child: TextField(
                      controller: pickupLat,
                      keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                      decoration:
                          const InputDecoration(labelText: 'Pickup lat'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextField(
                      controller: pickupLong,
                      keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                      decoration:
                          const InputDecoration(labelText: 'Pickup long'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              TextField(
                controller: destination,
                decoration:
                    const InputDecoration(labelText: 'Destination address'),
              ),
              Row(
                children: <Widget>[
                  Expanded(
                    child: TextField(
                      controller: destinationLat,
                      keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                      decoration:
                          const InputDecoration(labelText: 'Destination lat'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextField(
                      controller: destinationLong,
                      keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                      decoration:
                          const InputDecoration(labelText: 'Destination long'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              final bool valid = pickup.text.trim().isNotEmpty &&
                  destination.text.trim().isNotEmpty &&
                  double.tryParse(pickupLat.text.trim()) != null &&
                  double.tryParse(pickupLong.text.trim()) != null &&
                  double.tryParse(destinationLat.text.trim()) != null &&
                  double.tryParse(destinationLong.text.trim()) != null;
              if (!valid) return;
              Navigator.pop(dialogContext, true);
            },
            child: const Text('Continue'),
          ),
        ],
      ),
    );
    if (confirmed != true) {
      _disposeControllers(<TextEditingController>[
        pickup,
        pickupLat,
        pickupLong,
        destination,
        destinationLat,
        destinationLong,
      ]);
      return null;
    }
    final TripRouteRequest route = TripRouteRequest(
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
    );
    _disposeControllers(<TextEditingController>[
      pickup,
      pickupLat,
      pickupLong,
      destination,
      destinationLat,
      destinationLong,
    ]);
    return route;
  }

  Future<Position?> _currentPassengerPosition() async {
    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
        setState(() => _error = 'Enable location to choose pickup.');
        return null;
      }
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        setState(() => _error = 'Location permission is required.');
        return null;
      }
      return Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
        ),
      );
    } catch (_) {
      if (mounted) setState(() => _error = 'Unable to read your location.');
      return null;
    }
  }

  Future<void> _sendOfferFromTripRequest(RideMessageModel message) async {
    final DriverPointsController? pointsController = _points;
    final Map<String, dynamic> metadata =
        message.metadata ?? const <String, dynamic>{};
    if (pointsController == null) return;
    if (metadata['pickup'] is! Map || metadata['destination'] is! Map) {
      await _load(showLoader: false);
    }
    final RideCoordinateModel? ridePickup = _routeRide?.pickup;
    final RideCoordinateModel? rideDestination = _routeRide?.destination;
    final Map<String, dynamic>? pickup = metadata['pickup'] is Map
        ? Map<String, dynamic>.from(metadata['pickup'] as Map)
        : _tripRequestPointFromText(message.text, 'Pickup') ??
            (ridePickup?.isValid == true ? ridePickup!.toJson() : null);
    final Map<String, dynamic>? destination = metadata['destination'] is Map
        ? Map<String, dynamic>.from(metadata['destination'] as Map)
        : _tripRequestPointFromText(message.text, 'Destination') ??
            (rideDestination?.isValid == true
                ? rideDestination!.toJson()
                : null);
    final double? proposedPrice = metadata['proposedPrice'] is num
        ? (metadata['proposedPrice'] as num).toDouble()
        : double.tryParse((metadata['proposedPrice'] ?? '').toString()) ??
            _tripRequestPriceFromText(message.text);
    final String currency = (metadata['currency'] ??
            _tripRequestCurrencyFromText(message.text) ??
            'AED')
        .toString()
        .trim()
        .toUpperCase();
    final _CompletedTripRequest? completed = await _completeTripRequestForOffer(
      initialPickup: pickup,
      initialDestination: destination,
      initialPrice: proposedPrice,
      initialCurrency: currency,
      initialNote: (metadata['note'] ?? '').toString(),
    );
    if (completed == null || !mounted) {
      return;
    }
    final bool send =
        await showOfferReservationConfirmation(context, pointsController);
    if (!send || !mounted) return;
    final SendOfferResult result = await pointsController.sendOffer(
      TripOfferDraft(
        contactRideId: _rideId ?? '',
        pickup: completed.pickup,
        destination: completed.destination,
        offeredPrice: completed.price,
        currency: completed.currency,
        vehicleType: _routeRide?.vehicleType ?? '',
        note: completed.note,
      ),
    );
    if (!mounted) return;
    if (result != SendOfferResult.sent) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            result == SendOfferResult.insufficientPoints
                ? 'points.insufficient'.tr
                : pointsController.lastSendOfferError?.trim().isNotEmpty == true
                    ? pointsController.lastSendOfferError!.trim()
                    : 'points.send_failed'.tr,
          ),
        ),
      );
      return;
    }
    await _openConfirmedRide();
  }

  Future<void> _openConfirmedRide() async {
    if (Get.isRegistered<ActiveRideController>()) {
      await Get.find<ActiveRideController>().recover(showLoader: false);
    }
    await _communication.refreshActiveRide();
    if (mounted) {
      Get.offNamed(Routes.ACTIVE_RIDE);
    }
  }

  Future<_CompletedTripRequest?> _completeTripRequestForOffer({
    required Map<String, dynamic>? initialPickup,
    required Map<String, dynamic>? initialDestination,
    required double? initialPrice,
    required String initialCurrency,
    required String initialNote,
  }) async {
    Map<String, dynamic>? pickup = initialPickup;
    Map<String, dynamic>? destination = initialDestination;

    if (pickup == null || destination == null) {
      await _showMissingPassengerRouteDialog();
      return null;
    }

    if (initialPrice != null) {
      return _CompletedTripRequest(
        pickup: pickup,
        destination: destination,
        price: initialPrice,
        currency: initialCurrency,
        note: initialNote.trim(),
      );
    }

    final TextEditingController price = TextEditingController(
      text: initialPrice == null ? '' : initialPrice.toStringAsFixed(2),
    );
    final TextEditingController currency = TextEditingController(
      text: initialCurrency.trim().isEmpty ? 'AED' : initialCurrency,
    );
    final TextEditingController note =
        TextEditingController(text: initialNote.trim());
    if (!mounted) {
      _disposeControllers(<TextEditingController>[price, currency, note]);
      return null;
    }
    final bool? confirmed = await showDialog<bool>(
      context: context,
      builder: (BuildContext dialogContext) => AlertDialog(
        icon: const CircleAvatar(
          backgroundColor: Color(0x1FBE1B2C),
          child: Icon(Icons.local_offer_rounded, color: primaryColor),
        ),
        title: const Text('Complete trip offer'),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            TextField(
              controller: price,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(labelText: 'Offered price'),
            ),
            TextField(
              controller: currency,
              textCapitalization: TextCapitalization.characters,
              maxLength: 3,
              decoration: const InputDecoration(labelText: 'Currency'),
            ),
            TextField(
              controller: note,
              maxLength: 240,
              maxLines: 2,
              decoration: const InputDecoration(
                labelText: 'A note for the passenger (optional)',
                counterText: '',
              ),
            ),
          ],
        ),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              final double? parsed = double.tryParse(price.text.trim());
              if (parsed == null ||
                  parsed < 0 ||
                  currency.text.trim().length != 3) {
                return;
              }
              Navigator.pop(dialogContext, true);
            },
            child: const Text('Continue'),
          ),
        ],
      ),
    );
    final double? parsedPrice = double.tryParse(price.text.trim());
    final String parsedCurrency = currency.text.trim().toUpperCase();
    final String parsedNote = note.text.trim();
    _disposeControllers(<TextEditingController>[price, currency, note]);
    if (confirmed != true ||
        parsedPrice == null ||
        parsedCurrency.length != 3) {
      return null;
    }
    return _CompletedTripRequest(
      pickup: pickup,
      destination: destination,
      price: parsedPrice,
      currency: parsedCurrency,
      note: parsedNote,
    );
  }

  Future<void> _showMissingPassengerRouteDialog() async {
    if (!mounted) return;
    final bool askPassenger = await showDialog<bool>(
          context: context,
          builder: (BuildContext dialogContext) => AlertDialog(
            icon: const CircleAvatar(
              backgroundColor: Color(0x1FBE1B2C),
              child: Icon(Icons.route_rounded, color: primaryColor),
            ),
            title: const Text('Passenger route required'),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(24),
            ),
            content: const Text(
              'This request was sent without pickup and destination. Ask the '
              'passenger to send the trip request again from the + button.',
            ),
            actions: <Widget>[
              TextButton(
                onPressed: () => Navigator.pop(dialogContext, false),
                child: const Text('Close'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(dialogContext, true),
                child: const Text('Ask passenger'),
              ),
            ],
          ),
        ) ??
        false;
    if (askPassenger && mounted) {
      await _send(
          'Please resend the trip request with pickup and destination.');
    }
  }

  static final RegExp _tripRequestTextPattern = RegExp(
    r'^trip request:\s*([0-9]+(?:[.,][0-9]+)?)\s*([a-zA-Z]{3})?',
    caseSensitive: false,
  );

  static double? _tripRequestPriceFromText(String text) {
    final RegExpMatch? match = _tripRequestTextPattern.firstMatch(text.trim());
    if (match == null) return null;
    return double.tryParse((match.group(1) ?? '').replaceAll(',', '.'));
  }

  static String? _tripRequestCurrencyFromText(String text) {
    final RegExpMatch? match = _tripRequestTextPattern.firstMatch(text.trim());
    final String? currency = match?.group(2)?.trim();
    return currency == null || currency.isEmpty ? null : currency;
  }

  static Map<String, dynamic>? _tripRequestPointFromText(
    String text,
    String label,
  ) {
    final RegExp pattern = RegExp(
      '^$label:\\s*(.*?)\\s*\\((-?\\d+(?:\\.\\d+)?),\\s*(-?\\d+(?:\\.\\d+)?)\\)\\s*\$',
      caseSensitive: false,
      multiLine: true,
    );
    final RegExpMatch? match = pattern.firstMatch(text);
    if (match == null) return null;
    final double? lat = double.tryParse(match.group(2) ?? '');
    final double? long = double.tryParse(match.group(3) ?? '');
    if (lat == null || long == null) return null;
    return <String, dynamic>{
      'address': (match.group(1) ?? '').trim(),
      'lat': lat,
      'long': long,
    };
  }

  Future<void> _callParticipant(BuildContext context) async {
    final String name = _communication.counterpart?.firstName ??
        _conversation?.counterpart?.fullName ??
        'ride participant';
    if (await _communication.confirmDrewelCall(name)) {
      await _communication.initiateCall();
    }
  }

  Future<void> _showMissionConfirmation() async {
    final DriverPointsController? pointsController = _points;
    if (pointsController == null) return;
    final ActiveRideModel? ride = _routeRide ?? _communication.activeRide.value;
    final RideCoordinateModel? ridePickup = ride?.pickup;
    final RideCoordinateModel? rideDestination = ride?.destination;
    final TextEditingController pickup =
        TextEditingController(text: ridePickup?.address ?? '');
    final TextEditingController pickupLat = TextEditingController(
      text: ridePickup?.isValid == true ? '${ridePickup!.latitude}' : '',
    );
    final TextEditingController pickupLong = TextEditingController(
      text: ridePickup?.isValid == true ? '${ridePickup!.longitude}' : '',
    );
    final TextEditingController destination =
        TextEditingController(text: rideDestination?.address ?? '');
    final TextEditingController destinationLat = TextEditingController(
      text: rideDestination?.isValid == true
          ? '${rideDestination!.latitude}'
          : '',
    );
    final TextEditingController destinationLong = TextEditingController(
      text: rideDestination?.isValid == true
          ? '${rideDestination!.longitude}'
          : '',
    );
    final TextEditingController price = TextEditingController();
    final TextEditingController currency = TextEditingController(text: 'AED');
    final TextEditingController note = TextEditingController();
    final bool? confirmed = await showDialog<bool>(
      context: context,
      builder: (BuildContext dialogContext) => AlertDialog(
        icon: const CircleAvatar(
          backgroundColor: Color(0x1FBE1B2C),
          child: Icon(Icons.local_offer_rounded, color: primaryColor),
        ),
        title: Text('points.send_trip_offer'.tr),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              TextField(
                controller: pickup,
                readOnly: true,
                decoration: InputDecoration(labelText: 'points.pickup'.tr),
              ),
              Row(
                children: <Widget>[
                  Expanded(
                    child: TextField(
                      controller: pickupLat,
                      readOnly: true,
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
                      readOnly: true,
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
                readOnly: true,
                decoration: InputDecoration(labelText: 'points.destination'.tr),
              ),
              Row(
                children: <Widget>[
                  Expanded(
                    child: TextField(
                      controller: destinationLat,
                      readOnly: true,
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
                      readOnly: true,
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
              TextField(
                controller: note,
                maxLength: 240,
                maxLines: 2,
                decoration: const InputDecoration(
                  labelText: 'A note for the passenger (optional)',
                  counterText: '',
                ),
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
      _disposeControllers(<TextEditingController>[
        pickup,
        pickupLat,
        pickupLong,
        destination,
        destinationLat,
        destinationLong,
        price,
        currency,
        note,
      ]);
      return;
    }
    final draft = TripOfferDraft(
      contactRideId: _rideId ?? '',
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
      vehicleType: ride?.vehicleType ?? '',
      note: note.text.trim(),
    );
    final bool send =
        await showOfferReservationConfirmation(context, pointsController);
    _disposeControllers(<TextEditingController>[
      pickup,
      pickupLat,
      pickupLong,
      destination,
      destinationLat,
      destinationLong,
      price,
      currency,
      note,
    ]);
    if (!send || !mounted) return;
    final SendOfferResult result = await pointsController.sendOffer(draft);
    if (!mounted) return;
    // Successful reservations are already shown by the offer status card and
    // the deduplicated realtime notification. Only surface failures here.
    if (result != SendOfferResult.sent) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            result == SendOfferResult.insufficientPoints
                ? 'points.insufficient'.tr
                : pointsController.lastSendOfferError?.trim().isNotEmpty == true
                    ? pointsController.lastSendOfferError!.trim()
                    : 'points.send_failed'.tr,
          ),
        ),
      );
      return;
    }
    await _openConfirmedRide();
  }

  void _disposeControllers(List<TextEditingController> controllers) {
    for (final TextEditingController controller in controllers) {
      controller.dispose();
    }
  }
}

class _CounterpartSubtitle extends StatelessWidget {
  const _CounterpartSubtitle({
    required this.conversation,
    required this.contactAllowed,
  });

  final RideConversationModel? conversation;
  final bool contactAllowed;

  @override
  Widget build(BuildContext context) {
    if (contactAllowed) {
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          const Icon(Icons.circle, color: Color(0xFF087A3B), size: 9),
          const SizedBox(width: 5),
          Flexible(
            child: Text(
              'Online',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    color: const Color(0xFF087A3B),
                    fontSize: 16,
                    fontWeight: FontWeight.w500,
                  ),
            ),
          ),
        ],
      );
    }
    final ConversationCounterpartModel? counterpart = conversation?.counterpart;
    final String? vehicle = counterpart?.role == 'driver'
        ? <String?>[
            counterpart?.vehicleType,
            counterpart?.vehicleModel,
          ]
            .where((String? value) => value != null && value.isNotEmpty)
            .join(' - ')
        : null;
    final String subtitle =
        vehicle != null && vehicle.isNotEmpty ? vehicle : 'Secure chat';
    final String? reference = conversation?.rideReference;
    return Text(
      reference != null && reference.isNotEmpty
          ? '$subtitle - $reference'
          : subtitle,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: Theme.of(context).textTheme.labelSmall?.copyWith(
            color: text2Color,
          ),
    );
  }
}

class _CompletedTripRequest {
  const _CompletedTripRequest({
    required this.pickup,
    required this.destination,
    required this.price,
    required this.currency,
    required this.note,
  });

  final Map<String, dynamic> pickup;
  final Map<String, dynamic> destination;
  final double price;
  final String currency;
  final String note;
}

class _QuickReplyBar extends StatelessWidget {
  const _QuickReplyBar({
    required this.quickMessages,
    required this.sending,
    required this.onSend,
  });

  final List<String> quickMessages;
  final bool sending;
  final void Function(String message) onSend;

  @override
  Widget build(BuildContext context) => Container(
        height: 64,
        decoration: BoxDecoration(
          color: const Color(0xFFFCFCFC),
          border: Border(
            top: BorderSide(color: primaryColor.withValues(alpha: 0.16)),
            bottom: BorderSide(color: primaryColor.withValues(alpha: 0.10)),
          ),
        ),
        child: ListView.separated(
          padding: const EdgeInsets.fromLTRB(18, 10, 18, 10),
          scrollDirection: Axis.horizontal,
          itemCount: quickMessages.length,
          separatorBuilder: (_, __) => const SizedBox(width: 10),
          itemBuilder: (_, int index) => ActionChip(
            visualDensity: VisualDensity.compact,
            backgroundColor: const Color(0xFFFCFCFC),
            disabledColor: const Color(0xFFF2F2F2),
            side: BorderSide(color: primaryColor.withValues(alpha: 0.22)),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(22),
            ),
            labelPadding: const EdgeInsets.symmetric(horizontal: 12),
            label: Text(
              quickMessages[index],
              style: const TextStyle(
                color: Color(0xFF4B3F42),
                fontSize: 15,
                fontWeight: FontWeight.w500,
              ),
            ),
            onPressed: sending ? null : () => onSend(quickMessages[index]),
          ),
        ),
      );
}

class _ChatComposer extends StatelessWidget {
  const _ChatComposer({
    required this.textController,
    required this.hintText,
    required this.sending,
    required this.role,
    required this.rideStatus,
    required this.onSend,
    required this.onOffer,
    required this.onTripRequest,
  });

  final TextEditingController textController;
  final String hintText;
  final bool sending;
  final String role;
  final String? rideStatus;
  final VoidCallback onSend;
  final VoidCallback onOffer;
  final VoidCallback onTripRequest;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.fromLTRB(12, 12, 12, 14),
        color: const Color(0xFFFCFCFC),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: <Widget>[
            PopupMenuButton<String>(
              tooltip: 'Chat actions',
              icon: const Icon(
                Icons.add_circle_outline_rounded,
                color: Color(0xFF5E3D40),
                size: 30,
              ),
              onSelected: (String action) {
                if (action == 'offer') onOffer();
                if (action == 'trip_request') onTripRequest();
              },
              itemBuilder: (BuildContext context) => <PopupMenuEntry<String>>[
                if (role != ApiKeyConstants.driver &&
                    rideStatus == 'contacting')
                  const PopupMenuItem<String>(
                    value: 'trip_request',
                    child: ListTile(
                      leading:
                          Icon(Icons.add_road_rounded, color: primaryColor),
                      title: Text('Trip request'),
                      contentPadding: EdgeInsets.zero,
                    ),
                  ),
                if (role == ApiKeyConstants.driver &&
                    rideStatus == 'contacting')
                  const PopupMenuItem<String>(
                    value: 'offer',
                    child: ListTile(
                      leading:
                          Icon(Icons.local_offer_rounded, color: primaryColor),
                      title: Text('Send trip offer'),
                      contentPadding: EdgeInsets.zero,
                    ),
                  ),
                const PopupMenuItem<String>(
                  enabled: false,
                  child: Text('More attachments coming soon'),
                ),
              ],
            ),
            const SizedBox(width: 6),
            Expanded(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: const Color(0xFFF4F4F4),
                  borderRadius: BorderRadius.circular(30),
                  boxShadow: <BoxShadow>[
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.04),
                      blurRadius: 12,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: TextField(
                  controller: textController,
                  maxLength: 1000,
                  minLines: 1,
                  maxLines: 4,
                  textInputAction: TextInputAction.send,
                  onSubmitted: (_) => onSend(),
                  decoration: InputDecoration(
                    hintText: hintText,
                    hintStyle: const TextStyle(
                      color: Color(0xFF767A86),
                      fontSize: 16,
                    ),
                    counterText: '',
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 20,
                      vertical: 15,
                    ),
                    border: InputBorder.none,
                    suffixIcon: const Icon(
                      Icons.sentiment_satisfied_alt_rounded,
                      color: Color(0xFF5E3D40),
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 10),
            SizedBox.square(
              dimension: 58,
              child: IconButton.filled(
                style: IconButton.styleFrom(
                  backgroundColor: primaryColor,
                  foregroundColor: Colors.white,
                  disabledBackgroundColor: primaryColor.withValues(alpha: 0.45),
                  shape: const CircleBorder(),
                  elevation: 4,
                  shadowColor: primaryColor.withValues(alpha: 0.28),
                ),
                tooltip: 'Send message',
                onPressed: sending ? null : onSend,
                icon: sending
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.send_rounded, size: 28),
              ),
            ),
          ],
        ),
      );
}

class _MessageList extends StatelessWidget {
  const _MessageList({
    required this.messages,
    required this.selfId,
    required this.role,
    required this.onRefresh,
    this.conversation,
    this.routeRide,
    this.onSendOfferFromRequest,
  });

  final List<RideMessageModel> messages;
  final String selfId;
  final String role;
  final VoidCallback onRefresh;
  final RideConversationModel? conversation;
  final ActiveRideModel? routeRide;
  final ValueChanged<RideMessageModel>? onSendOfferFromRequest;

  @override
  Widget build(BuildContext context) {
    if (messages.isEmpty) {
      return RefreshIndicator(
        onRefresh: () async => onRefresh(),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: const <Widget>[
            SizedBox(height: 160),
            Icon(Icons.chat_bubble_outline_rounded,
                size: 48, color: Color(0xFFC9C9C9)),
            SizedBox(height: 12),
            Center(
              child: Text(
                'No messages yet. Say hello to your ride participant.',
                textAlign: TextAlign.center,
                style: TextStyle(color: text2Color),
              ),
            ),
          ],
        ),
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(0, 12, 0, 20),
      physics: const AlwaysScrollableScrollPhysics(),
      itemCount: messages.length,
      itemBuilder: (BuildContext context, int index) {
        final RideMessageModel message = messages[index];
        final bool mine = message.senderId == selfId;
        final bool requestCancelled = message.isCancelledTripRequest;
        final DateTime? previousTime =
            index > 0 ? messages[index - 1].createdAt : null;
        final DateTime? currentTime = message.createdAt;
        final bool showDayHeader =
            index == 0 || !_sameDay(previousTime, currentTime);
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            if (showDayHeader) _DayHeader(at: currentTime),
            if (message.isTripRequest)
              _TripRequestMessageCard(
                message: message,
                mine: mine,
                canSendOffer: role == ApiKeyConstants.driver &&
                    !mine &&
                    !requestCancelled &&
                    routeRide?.rideStatus.acceptsTripOfferFromRequest == true,
                counterpartImageUrl:
                    mine ? null : conversation?.counterpart?.profileImageUrl,
                routeRide: routeRide,
                onSendOffer: onSendOfferFromRequest == null
                    ? null
                    : () => onSendOfferFromRequest!(message),
              )
            else
              _MessageBubble(
                message: message,
                mine: mine,
                counterpartImageUrl:
                    mine ? null : conversation?.counterpart?.profileImageUrl,
              ),
          ],
        );
      },
    );
  }

  bool _sameDay(DateTime? a, DateTime? b) {
    if (a == null || b == null) return true;
    return a.year == b.year && a.month == b.month && a.day == b.day;
  }
}

class _DayHeader extends StatelessWidget {
  const _DayHeader({required this.at});

  final DateTime? at;

  @override
  Widget build(BuildContext context) {
    final DateTime time = at?.toLocal() ?? DateTime.now();
    final DateTime now = DateTime.now();
    final bool isToday =
        time.year == now.year && time.month == now.month && time.day == now.day;
    final String day = isToday
        ? 'Today'
        : time.year == now.year
            ? DateFormat.MMMd().format(time)
            : DateFormat.yMMMd().format(time);
    final String label = '$day, ${DateFormat.jm().format(time)}';
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Center(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
          decoration: BoxDecoration(
            color: const Color(0xFFF1F1F1),
            borderRadius: BorderRadius.circular(18),
          ),
          child: Text(
            label,
            style: const TextStyle(
              color: Color(0xFF5E3D40),
              fontSize: 15,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
      ),
    );
  }
}

class _TripRequestMessageCard extends StatelessWidget {
  const _TripRequestMessageCard({
    required this.message,
    required this.mine,
    required this.canSendOffer,
    this.counterpartImageUrl,
    this.routeRide,
    this.onSendOffer,
  });

  final RideMessageModel message;
  final bool mine;
  final bool canSendOffer;
  final String? counterpartImageUrl;
  final ActiveRideModel? routeRide;
  final VoidCallback? onSendOffer;

  static final RegExp _tripRequestTextPattern = RegExp(
    r'^trip request:\s*([0-9]+(?:[.,][0-9]+)?)\s*([a-zA-Z]{3})?',
    caseSensitive: false,
  );

  static double? _priceFromText(String text) {
    final RegExpMatch? match = _tripRequestTextPattern.firstMatch(text.trim());
    if (match == null) return null;
    return double.tryParse((match.group(1) ?? '').replaceAll(',', '.'));
  }

  static String? _currencyFromText(String text) {
    final RegExpMatch? match = _tripRequestTextPattern.firstMatch(text.trim());
    final String? currency = match?.group(2)?.trim();
    return currency == null || currency.isEmpty ? null : currency;
  }

  @override
  Widget build(BuildContext context) {
    final Map<String, dynamic> metadata =
        message.metadata ?? const <String, dynamic>{};
    final double? price = metadata['proposedPrice'] is num
        ? (metadata['proposedPrice'] as num).toDouble()
        : double.tryParse((metadata['proposedPrice'] ?? '').toString()) ??
            _priceFromText(message.text);
    final String currency =
        (metadata['currency'] ?? _currencyFromText(message.text) ?? 'AED')
            .toString()
            .trim()
            .toUpperCase();
    final String note = (metadata['note'] ?? '').toString().trim();
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: Padding(
        padding: EdgeInsets.only(bottom: mine ? 0 : 10),
        child: Stack(
          clipBehavior: Clip.none,
          children: <Widget>[
            _buildCard(context, metadata, price, currency, note),
            if (!mine)
              Positioned(
                left: 20,
                bottom: -10,
                child: CircleAvatar(
                  radius: 14,
                  backgroundColor: Colors.white,
                  child: CircleAvatar(
                    radius: 12,
                    backgroundColor: primaryColor.withValues(alpha: 0.12),
                    backgroundImage: counterpartImageUrl != null &&
                            counterpartImageUrl!.isNotEmpty
                        ? NetworkImage(counterpartImageUrl!)
                        : null,
                    child: counterpartImageUrl == null ||
                            counterpartImageUrl!.isEmpty
                        ? const Icon(Icons.person_rounded,
                            size: 14, color: primaryColor)
                        : null,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildCard(
    BuildContext context,
    Map<String, dynamic> metadata,
    double? price,
    String currency,
    String note,
  ) {
    String address(Object? value, String fallback) {
      if (value is Map) {
        final String text = (value['address'] ?? '').toString().trim();
        if (text.isNotEmpty) return text;
      }
      return fallback;
    }

    final Map<String, dynamic>? textPickup =
        _RideChatScreenState._tripRequestPointFromText(message.text, 'Pickup');
    final Map<String, dynamic>? textDestination =
        _RideChatScreenState._tripRequestPointFromText(
      message.text,
      'Destination',
    );
    final String pickup = address(
      metadata['pickup'] ?? textPickup,
      routeRide?.pickup?.address.trim().isNotEmpty == true
          ? routeRide!.pickup!.address
          : 'Pickup location',
    );
    final String destination = address(
      metadata['destination'] ?? textDestination,
      routeRide?.destination?.address.trim().isNotEmpty == true
          ? routeRide!.destination!.address
          : 'Destination',
    );
    final bool cancelled = message.isCancelledTripRequest;
    final double cardWidth =
        (MediaQuery.sizeOf(context).width - 92).clamp(280.0, 560.0).toDouble();
    return Container(
      width: cardWidth,
      margin: EdgeInsets.fromLTRB(mine ? 12 : 58, 6, mine ? 18 : 12, 18),
      decoration: BoxDecoration(
        color: const Color(0xFFFCFCFC),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: primaryColor.withValues(alpha: 0.22)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Container(
            height: 54,
            padding: const EdgeInsets.symmetric(horizontal: 20),
            decoration: BoxDecoration(
              color: const Color(0xFFFCFCFC),
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(22),
              ),
              border: Border(
                bottom: BorderSide(
                  color: primaryColor.withValues(alpha: 0.18),
                ),
              ),
            ),
            child: const Row(
              children: <Widget>[
                Expanded(
                  child: Text(
                    'Trip Update',
                    style: TextStyle(
                      color: primaryColor,
                      fontWeight: FontWeight.w500,
                      fontSize: 20,
                    ),
                  ),
                ),
                Icon(Icons.directions_car_filled_rounded,
                    color: Color(0xFF5E3D40), size: 24),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 22, 20, 20),
            child: Column(
              children: <Widget>[
                _TripUpdateRouteRow(
                  icon: Icons.my_location_rounded,
                  title: 'Pickup',
                  value: pickup,
                ),
                const SizedBox(height: 10),
                _TripUpdateRouteRow(
                  icon: Icons.location_on_outlined,
                  title: 'Destination',
                  value: destination,
                ),
                if (price != null || note.isNotEmpty) ...<Widget>[
                  const SizedBox(height: 10),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      const SizedBox(width: 38),
                      Expanded(
                        child: Text(
                          <String>[
                            if (price != null)
                              '${price.toStringAsFixed(2)} $currency',
                            if (note.isNotEmpty) note,
                          ].join(' - '),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: text2Color,
                            fontSize: 12,
                            height: 1.25,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
          if (cancelled)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 14),
              decoration: BoxDecoration(
                border: Border(
                  top: BorderSide(
                    color: primaryColor.withValues(alpha: 0.18),
                  ),
                ),
              ),
              child: Row(
                children: <Widget>[
                  Icon(
                    Icons.block_rounded,
                    size: 18,
                    color: text2Color.withValues(alpha: 0.9),
                  ),
                  const SizedBox(width: 8),
                  const Expanded(
                    child: Text(
                      'Cancelled by new request',
                      style: TextStyle(
                        color: text2Color,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            )
          else if (canSendOffer)
            Container(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 18),
              decoration: BoxDecoration(
                border: Border(
                  top: BorderSide(
                    color: primaryColor.withValues(alpha: 0.18),
                  ),
                ),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: <Widget>[
                  OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: textColor,
                      minimumSize: const Size(116, 48),
                      side: BorderSide(
                        color: primaryColor.withValues(alpha: 0.48),
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(26),
                      ),
                    ),
                    onPressed: () => _showTripRequestDetails(
                      context,
                      pickup: pickup,
                      destination: destination,
                      price: price,
                      currency: currency,
                      note: note,
                    ),
                    child: const Text('Details'),
                  ),
                  const SizedBox(width: 10),
                  FilledButton(
                    style: FilledButton.styleFrom(
                      backgroundColor: primaryColor,
                      foregroundColor: Colors.white,
                      minimumSize: const Size(116, 48),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(26),
                      ),
                    ),
                    onPressed: onSendOffer,
                    child: const Text('Confirm'),
                  ),
                ],
              ),
            ),
          if (message.createdAt != null) ...<Widget>[
            Padding(
              padding: EdgeInsets.fromLTRB(
                12,
                canSendOffer ? 0 : 0,
                12,
                canSendOffer ? 8 : 10,
              ),
              child: Align(
                alignment: Alignment.centerRight,
                child: Text(
                  DateFormat.Hm().format(message.createdAt!.toLocal()),
                  style: const TextStyle(color: text2Color, fontSize: 11),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  void _showTripRequestDetails(
    BuildContext context, {
    required String pickup,
    required String destination,
    required double? price,
    required String currency,
    required String note,
  }) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (BuildContext sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(
                'Trip Update',
                style: Theme.of(sheetContext).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
              ),
              const SizedBox(height: 16),
              _TripUpdateRouteRow(
                icon: Icons.my_location_rounded,
                title: 'Pickup',
                value: pickup,
              ),
              const SizedBox(height: 12),
              _TripUpdateRouteRow(
                icon: Icons.location_on_outlined,
                title: 'Destination',
                value: destination,
              ),
              if (price != null) ...<Widget>[
                const SizedBox(height: 16),
                Text(
                  '${price.toStringAsFixed(2)} $currency',
                  style: Theme.of(sheetContext).textTheme.titleMedium?.copyWith(
                        color: primaryColor,
                        fontWeight: FontWeight.w800,
                      ),
                ),
              ],
              if (note.isNotEmpty) ...<Widget>[
                const SizedBox(height: 10),
                Text(note),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _TripUpdateRouteRow extends StatelessWidget {
  const _TripUpdateRouteRow({
    required this.icon,
    required this.title,
    required this.value,
  });

  final IconData icon;
  final String title;
  final String value;

  @override
  Widget build(BuildContext context) => Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          SizedBox(
            width: 30,
            child: Icon(icon, color: primaryColor, size: 30),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  title,
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 18,
                    color: textColor,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  value,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Color(0xFF4B3F42),
                    fontSize: 15,
                    height: 1.2,
                  ),
                ),
              ],
            ),
          ),
        ],
      );
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({
    required this.message,
    required this.mine,
    this.counterpartImageUrl,
  });

  final RideMessageModel message;
  final bool mine;
  final String? counterpartImageUrl;

  @override
  Widget build(BuildContext context) {
    final double maxBubbleWidth = (MediaQuery.sizeOf(context).width * 0.64)
        .clamp(220.0, 420.0)
        .toDouble();
    final Widget bubble = Container(
      constraints: BoxConstraints(maxWidth: maxBubbleWidth),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      decoration: BoxDecoration(
        color: mine ? primaryColor : const Color(0xFFE7E7E7),
        borderRadius: BorderRadius.only(
          topLeft: const Radius.circular(22),
          topRight: const Radius.circular(22),
          bottomLeft: Radius.circular(mine ? 22 : 4),
          bottomRight: Radius.circular(mine ? 4 : 22),
        ),
      ),
      child: Text(
        message.text,
        style: TextStyle(
          color: mine ? Colors.white : textColor,
          fontSize: 17,
          height: 1.35,
        ),
      ),
    );
    final Widget? timeLabel = message.createdAt == null
        ? null
        : Text(
            DateFormat.Hm().format(message.createdAt!.toLocal()),
            style: const TextStyle(color: text2Color, fontSize: 11),
          );
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 6),
      child: Row(
        mainAxisAlignment:
            mine ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: <Widget>[
          if (!mine) ...<Widget>[
            CircleAvatar(
              radius: 16,
              backgroundColor: primaryColor.withValues(alpha: 0.12),
              backgroundImage:
                  counterpartImageUrl != null && counterpartImageUrl!.isNotEmpty
                      ? NetworkImage(counterpartImageUrl!)
                      : null,
              child: counterpartImageUrl == null || counterpartImageUrl!.isEmpty
                  ? const Icon(Icons.person_rounded,
                      size: 16, color: primaryColor)
                  : null,
            ),
            const SizedBox(width: 8),
          ],
          if (mine && timeLabel != null) ...<Widget>[
            Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: <Widget>[
                _StatusIcon(status: message.status),
                const SizedBox(height: 2),
                timeLabel,
              ],
            ),
            const SizedBox(width: 6),
          ],
          Flexible(child: bubble),
          if (!mine && timeLabel != null) ...<Widget>[
            const SizedBox(width: 6),
            timeLabel,
          ],
        ],
      ),
    );
  }
}

class _StatusIcon extends StatelessWidget {
  const _StatusIcon({required this.status});

  final RideMessageStatus status;

  @override
  Widget build(BuildContext context) {
    return Icon(
      switch (status) {
        RideMessageStatus.sent => Icons.check_rounded,
        RideMessageStatus.delivered => Icons.done_all_rounded,
        RideMessageStatus.read => Icons.done_all_rounded,
      },
      size: 14,
      color: switch (status) {
        RideMessageStatus.sent => primaryColor.withValues(alpha: 0.55),
        RideMessageStatus.delivered => primaryColor.withValues(alpha: 0.82),
        RideMessageStatus.read => amberColor,
      },
    );
  }
}

class _IncomingOfferCard extends StatelessWidget {
  const _IncomingOfferCard({
    required this.offer,
    required this.loading,
    required this.onDetails,
    required this.onAccept,
    required this.onDecline,
  });

  final TripOffer offer;
  final bool loading;
  final VoidCallback onDetails;
  final VoidCallback onAccept;
  final VoidCallback onDecline;

  @override
  Widget build(BuildContext context) {
    String address(Map<String, dynamic>? location, String fallback) =>
        (location?['address'] ?? fallback).toString();
    final String price = offer.offeredPrice == null
        ? 'Price to be confirmed'
        : '${offer.offeredPrice!.toStringAsFixed(2)} ${offer.currency ?? ''}';
    final bool canRespond = offer.status == 'pending';
    return Card(
      margin: const EdgeInsets.fromLTRB(12, 8, 12, 0),
      elevation: 0,
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(
          color: primaryColor.withValues(alpha: 0.14),
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Row(
              children: <Widget>[
                const CircleAvatar(
                  radius: 20,
                  backgroundColor: Color(0x1AFFC136),
                  child: Icon(Icons.local_offer_rounded, color: primaryColor),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Trip proposal',
                    style: Theme.of(context)
                        .textTheme
                        .titleMedium
                        ?.copyWith(fontWeight: FontWeight.w700),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Text(
              price,
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    color: primaryColor,
                    fontWeight: FontWeight.w800,
                  ),
            ),
            const SizedBox(height: 12),
            _OfferLocationRow(
              icon: Icons.radio_button_checked_rounded,
              label: 'PICKUP',
              value: address(offer.pickup, 'Pickup location'),
            ),
            _OfferLocationRow(
              icon: Icons.location_on_rounded,
              label: 'DESTINATION',
              value: address(offer.destination, 'Destination'),
            ),
            if (offer.note?.trim().isNotEmpty == true) ...<Widget>[
              const SizedBox(height: 8),
              Text(offer.note!, style: const TextStyle(color: text2Color)),
            ],
            const SizedBox(height: 16),
            if (canRespond) ...<Widget>[
              Row(
                children: <Widget>[
                  Expanded(
                    child: OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        minimumSize: const Size.fromHeight(48),
                        foregroundColor: textColor,
                        side: const BorderSide(color: Color(0xFFD9D1D3)),
                      ),
                      onPressed: loading ? null : onDetails,
                      child: const Text('Details'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: FilledButton(
                      style: FilledButton.styleFrom(
                        backgroundColor: primaryColor,
                        foregroundColor: Colors.white,
                        minimumSize: const Size.fromHeight(48),
                      ),
                      onPressed: loading ? null : onAccept,
                      child: loading
                          ? const SizedBox.square(
                              dimension: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Text('Confirm drive'),
                    ),
                  ),
                ],
              ),
              TextButton(
                onPressed: loading ? null : onDecline,
                child: const Text('Decline this offer'),
              ),
            ] else
              FilledButton.icon(
                style: FilledButton.styleFrom(
                  backgroundColor: primaryColor,
                  foregroundColor: Colors.white,
                  minimumSize: const Size.fromHeight(48),
                ),
                onPressed: onDetails,
                icon: const Icon(Icons.check_circle_rounded),
                label: const Text('Ride confirmed'),
              ),
          ],
        ),
      ),
    );
  }
}

class _OfferLocationRow extends StatelessWidget {
  const _OfferLocationRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Icon(icon, size: 18, color: primaryColor),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(label,
                      style: const TextStyle(
                        fontSize: 10,
                        letterSpacing: 0,
                        color: text2Color,
                        fontWeight: FontWeight.w700,
                      )),
                  const SizedBox(height: 2),
                  Text(value, maxLines: 2, overflow: TextOverflow.ellipsis),
                ],
              ),
            ),
          ],
        ),
      );
}

class _ReadOnlyConversationNotice extends StatelessWidget {
  const _ReadOnlyConversationNotice();

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        margin: const EdgeInsets.fromLTRB(16, 4, 16, 12),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: const Color(0xFFF6F1F2),
          borderRadius: BorderRadius.circular(14),
        ),
        child: const Row(
          children: <Widget>[
            Icon(Icons.lock_outline_rounded, color: primaryColor, size: 18),
            SizedBox(width: 8),
            Expanded(
              child: Text(
                'This conversation is saved securely. Messaging is closed for this ride.',
                style: TextStyle(color: text2Color, fontSize: 12),
              ),
            ),
          ],
        ),
      );
}
