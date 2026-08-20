import 'dart:async';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:get/get.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../../common/colors.dart';
import '../../../../common/motion.dart';
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

  String get _chatTitle {
    final RideConversationModel? conversation = _conversation;
    final String name = conversation?.counterpart?.displayName.trim() ?? '';
    if (name.isNotEmpty) return name;
    final String fallback = _communication.counterpart?.firstName.trim() ?? '';
    return fallback.isNotEmpty ? fallback : 'Drewel secure chat';
  }

  void _openCounterpartProfile(BuildContext context) {
    final ConversationCounterpartModel? counterpart =
        _conversation?.counterpart;
    if (counterpart == null) return;
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (BuildContext sheetContext) =>
          _CounterpartProfileSheet(counterpart: counterpart),
    );
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
        _messages.addAll(messages.where(
          (RideMessageModel message) => !message.isCancelledTripRequest,
        ));
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
          title: InkWell(
            borderRadius: BorderRadius.circular(20),
            onTap: () => _openCounterpartProfile(context),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 4),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  _CounterpartAvatar(
                    imageUrl: _conversation?.counterpart?.profileImageUrl,
                    radius: 18,
                  ),
                  const SizedBox(width: 10),
                  Flexible(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Text(
                          _chatTitle,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
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
                  ),
                ],
              ),
            ),
          ),
          actions: <Widget>[
            IconButton(
              tooltip: 'Safety',
              onPressed: _showSafetyActions,
              icon: const Icon(Icons.shield_outlined, color: primaryColor),
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
                        onRefresh: () => _load(showLoader: false),
                        onDetails: _showTripRequestDetails,
                        onConfirm: _confirmTripRequest,
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
                      canSendTripRequest: _role != ApiKeyConstants.driver &&
                          _routeRide?.status == 'contacting',
                      onSend: _send,
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

  Future<void> _showTripRequestDetails(RideMessageModel message) async {
    final Map<String, dynamic>? pickup = _messagePoint(message, 'pickup');
    final Map<String, dynamic>? destination =
        _messagePoint(message, 'destination');
    final Object? price = message.metadata?['proposedPrice'];
    final String currency =
        (message.metadata?['currency'] ?? '').toString().trim();
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
              Text(
                'Trip request',
                style: Theme.of(sheetContext).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
              ),
              const SizedBox(height: 16),
              _OfferLocationRow(
                icon: Icons.my_location_rounded,
                label: 'PICKUP',
                value: _pointAddress(pickup, 'Pickup location'),
              ),
              _OfferLocationRow(
                icon: Icons.location_on_rounded,
                label: 'DESTINATION',
                value: _pointAddress(destination, 'Destination'),
              ),
              if (price != null) ...<Widget>[
                const Divider(height: 24),
                Text(
                  '$price $currency'.trim(),
                  style:
                      Theme.of(sheetContext).textTheme.headlineSmall?.copyWith(
                            color: primaryColor,
                            fontWeight: FontWeight.w800,
                          ),
                ),
              ],
              if ((message.metadata?['note'] ?? '')
                  .toString()
                  .trim()
                  .isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: Text(message.metadata!['note'].toString()),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _confirmTripRequest(RideMessageModel message) async {
    if (_role != ApiKeyConstants.driver) return;
    final Map<String, dynamic>? pickup = _messagePoint(message, 'pickup');
    final Map<String, dynamic>? destination =
        _messagePoint(message, 'destination');
    if (pickup == null || destination == null) {
      setState(() => _error = 'Trip request route is missing.');
      return;
    }
    final double price =
        double.tryParse('${message.metadata?['proposedPrice'] ?? ''}') ?? 0;
    final String currency = (message.metadata?['currency'] ?? 'AED')
        .toString()
        .trim()
        .toUpperCase();
    if (_points == null) {
      DriverPointsBinding().dependencies();
      _points = Get.find<DriverPointsController>();
    }
    final bool confirmed = await showOfferReservationConfirmation(
      context,
      _points!,
    );
    if (!confirmed || !mounted) return;
    final SendOfferResult result = await _points!.sendOffer(
      TripOfferDraft(
        contactRideId: message.rideId,
        pickup: pickup,
        destination: destination,
        offeredPrice: price,
        currency: currency.isEmpty ? 'AED' : currency,
        vehicleType: _routeRide?.vehicleType ?? '',
        note: (message.metadata?['note'] ?? '').toString(),
      ),
    );
    if (!mounted) return;
    if (result == SendOfferResult.sent) {
      setState(() {
        _messages.removeWhere((RideMessageModel item) =>
            item.isTripRequest && item.rideId == message.rideId);
      });
      unawaited(_load(showLoader: false));
    }
    final String feedback = switch (result) {
      SendOfferResult.sent => 'Trip offer sent.',
      SendOfferResult.insufficientPoints => 'points.insufficient'.tr,
      SendOfferResult.failed =>
        _points!.lastSendOfferError ?? 'Unable to send the offer.',
    };
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(feedback)),
    );
  }

  Map<String, dynamic>? _messagePoint(RideMessageModel message, String key) {
    final Object? raw = message.metadata?[key];
    return raw is Map ? Map<String, dynamic>.from(raw) : null;
  }

  String _pointAddress(Map<String, dynamic>? point, String fallback) {
    final String address = (point?['address'] ?? '').toString().trim();
    return address.isEmpty ? fallback : address;
  }

  Future<void> _showPassengerTripRequest() async {
    if (_role == ApiKeyConstants.driver) return;
    final String? rideId = _rideId;
    if (rideId == null || _sending) return;

    final RideCoordinateModel? existingPickup = _routeRide?.pickup;
    LatLng pickup;
    String pickupAddress;
    if (existingPickup?.isValid == true) {
      pickup = LatLng(existingPickup!.latitude, existingPickup.longitude);
      pickupAddress = existingPickup.address;
    } else {
      try {
        final Position position = await Geolocator.getCurrentPosition(
          locationSettings: const LocationSettings(
            accuracy: LocationAccuracy.high,
            timeLimit: Duration(seconds: 12),
          ),
        );
        pickup = LatLng(position.latitude, position.longitude);
        pickupAddress = 'Current location';
      } catch (_) {
        if (!mounted) return;
        setState(() => _error = 'Unable to read your location.');
        return;
      }
    }

    if (!mounted) return;
    final TripRouteRequest? route = await showTripRequestMapSheet(
      context,
      pickup: pickup,
      pickupAddress: pickupAddress,
    );
    if (route == null || !mounted) return;

    final _TripRequestDetails? details = await showDialog<_TripRequestDetails>(
      context: context,
      builder: (BuildContext dialogContext) =>
          const _TripRequestDetailsDialog(),
    );
    if (details == null || !mounted) return;

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
        proposedPrice: details.price,
        currency: details.currency,
        note: details.note,
      );
      if (!mounted) return;
      setState(() => _messages.add(sent));
    } on CommunicationApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'Trip request not sent.');
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _showSafetyActions() async {
    final String? rideId = _rideId;
    if (rideId == null || rideId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'No active ride to report. Please use Help & Support instead.',
          ),
        ),
      );
      return;
    }
    final String? action = await showDialog<String>(
      context: context,
      builder: (BuildContext dialogContext) => AlertDialog(
        title: const Row(
          children: <Widget>[
            Icon(Icons.shield_rounded),
            SizedBox(width: 8),
            Text('Safety'),
          ],
        ),
        content: const Text(
          'Report a safety concern or block the participant in this '
          'conversation. Drewel support reviews every report.',
        ),
        actions: <Widget>[
          TextButton(
            onPressed: () {
              Navigator.pop(dialogContext);
              Get.toNamed(Routes.SUPPORT);
            },
            child: const Text('Support'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, 'report'),
            child: const Text('Report'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(dialogContext, 'block'),
            child: const Text('Block'),
          ),
        ],
      ),
    );
    if (action == null || !mounted) return;
    if (action == 'report') {
      await _requestSafetyAction(
        title: 'Report this ride?',
        confirmLabel: 'Report',
        destructive: false,
        submit: (String reason) =>
            _rideRepository.report(rideId, reason.trim()),
      );
    } else if (action == 'block') {
      await _requestSafetyAction(
        title: 'Block this participant?',
        confirmLabel: 'Block',
        destructive: true,
        submit: (String reason) => _rideRepository.block(rideId, reason.trim()),
      );
    }
  }

  Future<void> _requestSafetyAction({
    required String title,
    required String confirmLabel,
    required bool destructive,
    required Future<void> Function(String reason) submit,
  }) async {
    final TextEditingController reasonController = TextEditingController();
    final bool? confirmed = await showDialog<bool>(
      context: context,
      builder: (BuildContext dialogContext) => AlertDialog(
        title: Text(title),
        content: TextField(
          controller: reasonController,
          autofocus: true,
          maxLength: 500,
          minLines: 2,
          maxLines: 4,
          decoration: const InputDecoration(
            labelText: 'Reason',
            hintText: 'Tell Drewel support what happened',
            border: OutlineInputBorder(),
          ),
        ),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: destructive
                ? FilledButton.styleFrom(backgroundColor: Colors.red)
                : null,
            onPressed: () {
              if (reasonController.text.trim().isEmpty) return;
              Navigator.pop(dialogContext, true);
            },
            child: Text(confirmLabel),
          ),
        ],
      ),
    );
    final String reason = reasonController.text;
    reasonController.dispose();
    if (confirmed != true) return;
    bool success = false;
    String? failureMessage;
    try {
      await submit(reason);
      success = true;
    } on CommunicationApiException catch (error) {
      failureMessage = error.message;
    } catch (_) {
      failureMessage = 'Unable to submit. Please retry or contact support.';
    }
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(success
            ? '$confirmLabel submitted to Drewel.'
            : failureMessage ??
                'Unable to submit. Please retry or contact support.'),
      ),
    );
  }
}

class _CounterpartAvatar extends StatelessWidget {
  const _CounterpartAvatar({required this.imageUrl, required this.radius});

  final String? imageUrl;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final bool hasImage = imageUrl != null && imageUrl!.isNotEmpty;
    return CircleAvatar(
      radius: radius,
      backgroundColor: primaryColor.withValues(alpha: 0.12),
      backgroundImage: hasImage ? NetworkImage(imageUrl!) : null,
      child: hasImage
          ? null
          : Icon(Icons.person_rounded, size: radius, color: primaryColor),
    );
  }
}

class _CounterpartProfileSheet extends StatelessWidget {
  const _CounterpartProfileSheet({required this.counterpart});

  final ConversationCounterpartModel counterpart;

  @override
  Widget build(BuildContext context) {
    final bool isDriver = counterpart.role == 'driver';
    final String vehicle = <String?>[
      counterpart.vehicleType,
      counterpart.vehicleModel,
    ].where((String? value) => value != null && value.isNotEmpty).join(' - ');
    return SafeArea(
      top: false,
      child: Container(
        margin: const EdgeInsets.fromLTRB(12, 0, 12, 12),
        padding: const EdgeInsets.fromLTRB(24, 14, 24, 24),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(28),
          boxShadow: <BoxShadow>[
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.08),
              blurRadius: 24,
              offset: const Offset(0, -4),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: editTextButton,
                borderRadius: BorderRadius.circular(4),
              ),
            ),
            const SizedBox(height: 22),
            _CounterpartAvatar(imageUrl: counterpart.profileImageUrl, radius: 44),
            const SizedBox(height: 14),
            Text(
              counterpart.displayName.isNotEmpty
                  ? counterpart.displayName
                  : (isDriver ? 'Driver' : 'Passenger'),
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: textColor,
                fontSize: 21,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: primaryColor.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                isDriver ? 'Driver' : 'Passenger',
                style: const TextStyle(
                  color: primaryColor,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            if (isDriver && counterpart.rating != null) ...<Widget>[
              const SizedBox(height: 14),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  const Icon(Icons.star_rounded, color: amberColor, size: 22),
                  const SizedBox(width: 4),
                  Text(
                    counterpart.rating!.toStringAsFixed(1),
                    style: const TextStyle(
                      color: textColor,
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(width: 6),
                  const Text(
                    'rating',
                    style: TextStyle(color: text2Color, fontSize: 14),
                  ),
                ],
              ),
            ],
            if (isDriver && (vehicle.isNotEmpty || (counterpart.registration ?? '').isNotEmpty)) ...<Widget>[
              const SizedBox(height: 20),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                decoration: BoxDecoration(
                  color: cartColor,
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    if (vehicle.isNotEmpty)
                      Row(
                        children: <Widget>[
                          const Icon(Icons.directions_car_rounded,
                              color: primaryColor, size: 20),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              vehicle,
                              style: const TextStyle(
                                color: textColor,
                                fontSize: 15,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                      ),
                    if (vehicle.isNotEmpty &&
                        (counterpart.registration ?? '').isNotEmpty)
                      const SizedBox(height: 10),
                    if ((counterpart.registration ?? '').isNotEmpty)
                      Row(
                        children: <Widget>[
                          const Icon(Icons.pin_rounded,
                              color: primaryColor, size: 20),
                          const SizedBox(width: 10),
                          Text(
                            counterpart.registration!,
                            style: const TextStyle(
                              color: textColor,
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ],
                      ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 22),
            SizedBox(
              width: double.infinity,
              height: 48,
              child: OutlinedButton(
                onPressed: () => Navigator.of(context).pop(),
                style: OutlinedButton.styleFrom(
                  foregroundColor: primaryColor,
                  side: const BorderSide(color: primaryColor),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                child: const Text(
                  'Close',
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
            ),
          ],
        ),
      ),
    );
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
          ].where((String? value) => value != null && value.isNotEmpty).join(
              ' - ',
            )
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

class _TripRequestDetails {
  const _TripRequestDetails({
    required this.price,
    required this.currency,
    required this.note,
  });

  final double price;
  final String currency;
  final String note;
}

class _TripRequestDetailsDialog extends StatefulWidget {
  const _TripRequestDetailsDialog();

  @override
  State<_TripRequestDetailsDialog> createState() =>
      _TripRequestDetailsDialogState();
}

class _TripRequestDetailsDialogState extends State<_TripRequestDetailsDialog> {
  final TextEditingController _price = TextEditingController();
  final TextEditingController _currency = TextEditingController(text: 'AED');
  final TextEditingController _note = TextEditingController();

  @override
  void dispose() {
    _price.dispose();
    _currency.dispose();
    _note.dispose();
    super.dispose();
  }

  void _submit() {
    final double? parsed = double.tryParse(_price.text.trim());
    final String currency = _currency.text.trim().toUpperCase();
    if (parsed == null || parsed < 0 || currency.length != 3) return;
    FocusScope.of(context).unfocus();
    Navigator.pop(
      context,
      _TripRequestDetails(
        price: parsed,
        currency: currency,
        note: _note.text.trim(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
        icon: const CircleAvatar(
          backgroundColor: Color(0x1FBE1B2C),
          child: Icon(Icons.add_road_rounded, color: primaryColor),
        ),
        title: const Text('Send trip request'),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        scrollable: true,
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            TextField(
              controller: _price,
              autofocus: true,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(labelText: 'Proposed price'),
            ),
            TextField(
              controller: _currency,
              textCapitalization: TextCapitalization.characters,
              maxLength: 3,
              decoration: const InputDecoration(labelText: 'Currency'),
            ),
            TextField(
              controller: _note,
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
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          FilledButton(onPressed: _submit, child: const Text('Send')),
        ],
      );
}

class _ChatComposer extends StatelessWidget {
  const _ChatComposer({
    required this.textController,
    required this.hintText,
    required this.sending,
    required this.canSendTripRequest,
    required this.onSend,
    required this.onTripRequest,
  });

  final TextEditingController textController;
  final String hintText;
  final bool sending;
  final bool canSendTripRequest;
  final VoidCallback onSend;
  final VoidCallback onTripRequest;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.fromLTRB(12, 12, 12, 14),
        color: const Color(0xFFFCFCFC),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: <Widget>[
            if (canSendTripRequest)
              SizedBox(
                width: 54,
                height: 58,
                child: IconButton(
                  tooltip: 'Trip request',
                  onPressed: sending ? null : onTripRequest,
                  iconSize: 36,
                  color: primaryColor,
                  disabledColor: primaryColor.withValues(alpha: 0.35),
                  icon: const Icon(Icons.playlist_add_rounded),
                ),
              ),
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
    required this.onDetails,
    required this.onConfirm,
    this.conversation,
  });

  final List<RideMessageModel> messages;
  final String selfId;
  final String role;
  final VoidCallback onRefresh;
  final void Function(RideMessageModel message) onDetails;
  final void Function(RideMessageModel message) onConfirm;
  final RideConversationModel? conversation;

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
        final DateTime? previousTime =
            index > 0 ? messages[index - 1].createdAt : null;
        final DateTime? currentTime = message.createdAt;
        final bool showDayHeader =
            index == 0 || !_sameDay(previousTime, currentTime);
        final Widget bubble = message.isTripRequest
            ? _TripRequestCard(
                message: message,
                mine: mine,
                canConfirm: role == ApiKeyConstants.driver,
                counterpartImageUrl:
                    mine ? null : conversation?.counterpart?.profileImageUrl,
                onDetails: () => onDetails(message),
                onConfirm: () => onConfirm(message),
              )
            : _MessageBubble(
                message: message,
                mine: mine,
                counterpartImageUrl:
                    mine ? null : conversation?.counterpart?.profileImageUrl,
              );
        final bool isNewest = index == messages.length - 1;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            if (showDayHeader) _DayHeader(at: currentTime),
            isNewest ? FadeSlideIn(offsetY: 8, child: bubble) : bubble,
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

class _TripRequestCard extends StatelessWidget {
  const _TripRequestCard({
    required this.message,
    required this.mine,
    required this.canConfirm,
    required this.onDetails,
    required this.onConfirm,
    this.counterpartImageUrl,
  });

  final RideMessageModel message;
  final bool mine;
  final bool canConfirm;
  final VoidCallback onDetails;
  final VoidCallback onConfirm;
  final String? counterpartImageUrl;

  @override
  Widget build(BuildContext context) {
    final Map<String, dynamic>? pickup = _point('pickup');
    final Map<String, dynamic>? destination = _point('destination');
    final Widget card = Container(
      constraints: BoxConstraints(
        maxWidth: (MediaQuery.sizeOf(context).width * 0.78)
            .clamp(280.0, 520.0)
            .toDouble(),
      ),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFDFD),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: primaryColor.withValues(alpha: 0.28)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          const Padding(
            padding: EdgeInsets.fromLTRB(18, 14, 18, 12),
            child: Row(
              children: <Widget>[
                Expanded(
                  child: Text(
                    'Trip Update',
                    style: TextStyle(
                      color: primaryColor,
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                Icon(Icons.local_taxi_rounded,
                    color: Color(0xFF5E3D40), size: 24),
              ],
            ),
          ),
          Divider(height: 1, color: primaryColor.withValues(alpha: 0.20)),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 18),
            child: Column(
              children: <Widget>[
                _TripRequestLocationLine(
                  icon: Icons.my_location_rounded,
                  title: 'Pickup',
                  address: _address(pickup, 'Pickup location'),
                ),
                const SizedBox(height: 16),
                _TripRequestLocationLine(
                  icon: Icons.location_on_rounded,
                  title: 'Destination',
                  address: _address(destination, 'Destination'),
                ),
              ],
            ),
          ),
          Divider(height: 1, color: primaryColor.withValues(alpha: 0.20)),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 12, 18, 14),
            child: Row(
              children: <Widget>[
                Expanded(
                  child: OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: textColor,
                      side: BorderSide(
                        color: const Color(0xFF5E3D40).withValues(alpha: 0.65),
                      ),
                      minimumSize: const Size.fromHeight(46),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(28),
                      ),
                    ),
                    onPressed: onDetails,
                    child: const Text('Details'),
                  ),
                ),
                if (canConfirm) ...<Widget>[
                  const SizedBox(width: 14),
                  Expanded(
                    child: FilledButton(
                      style: FilledButton.styleFrom(
                        backgroundColor: primaryColor,
                        foregroundColor: Colors.white,
                        minimumSize: const Size.fromHeight(46),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(28),
                        ),
                      ),
                      onPressed: onConfirm,
                      child: const Text('Confirm'),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
    final Widget? timeLabel = message.createdAt == null
        ? null
        : Text(
            DateFormat.Hm().format(message.createdAt!.toLocal()),
            style: const TextStyle(color: text2Color, fontSize: 11),
          );
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
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
          Flexible(child: card),
          if (timeLabel != null) ...<Widget>[
            const SizedBox(width: 6),
            timeLabel,
          ],
        ],
      ),
    );
  }

  Map<String, dynamic>? _point(String key) {
    final Object? raw = message.metadata?[key];
    return raw is Map ? Map<String, dynamic>.from(raw) : null;
  }

  String _address(Map<String, dynamic>? point, String fallback) {
    final String address = (point?['address'] ?? '').toString().trim();
    return address.isEmpty ? fallback : address;
  }
}

class _TripRequestLocationLine extends StatelessWidget {
  const _TripRequestLocationLine({
    required this.icon,
    required this.title,
    required this.address,
  });

  final IconData icon;
  final String title;
  final String address;

  @override
  Widget build(BuildContext context) => Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Icon(icon, color: primaryColor, size: 28),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  title,
                  style: const TextStyle(
                    color: textColor,
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  address,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Color(0xFF5E3D40),
                    fontSize: 15,
                    height: 1.25,
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
