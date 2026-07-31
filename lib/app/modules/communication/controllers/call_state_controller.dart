import 'dart:async';

import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../../common/socket_services.dart';

import '../../../data/apis/api_constants/api_key_constants.dart';
import '../../../data/apis/api_constants/api_url_constants.dart';
import '../../../data/apis/api_models/active_ride_model.dart';
import '../../../data/apis/api_models/call_session_model.dart';
import '../../../data/apis/communication_api_client.dart';
import '../../../data/repositories/active_ride_repository.dart';
import '../../../data/repositories/call_repository.dart';
import '../../../data/repositories/ride_message_repository.dart';
import '../../../data/services/agora_call_service.dart';
import '../../../routes/app_pages.dart';
import '../widgets/safety_dialog.dart';

class CallStateController extends GetxService with WidgetsBindingObserver {
  CallStateController({
    required ActiveRideRepository activeRideRepository,
    required CallRepository callRepository,
    required RideMessageRepository messageRepository,
    required AgoraCallService agoraService,
  })  : _activeRideRepository = activeRideRepository,
        callRepository = callRepository,
        messageRepository = messageRepository,
        _agoraService = agoraService;

  final ActiveRideRepository _activeRideRepository;
  final CallRepository callRepository;
  final RideMessageRepository messageRepository;
  final AgoraCallService _agoraService;
  final SocketService _socketService = SocketService();

  final Rxn<ActiveRideModel> activeRide = Rxn<ActiveRideModel>();
  final Rxn<CallSessionModel> currentCall = Rxn<CallSessionModel>();
  final Rxn<ActiveRideModel> pendingRide = Rxn<ActiveRideModel>();
  final Rx<AgoraConnectionState> connectionState =
      AgoraConnectionState.idle.obs;
  final RxBool isBusy = false.obs;
  final RxBool isMuted = false.obs;
  final RxBool isSpeakerEnabled = false.obs;
  final RxString contactingDriverId = ''.obs;
  final RxString userFacingError = ''.obs;
  StreamSubscription<AgoraConnectionState>? _connectionSubscription;
  Timer? _durationTimer;
  Timer? _outgoingPollTimer;
  bool _pollInFlight = false;
  bool _connectedAcknowledged = false;
  final RxInt connectedSeconds = 0.obs;
  String _role = 'user';
  String _selfId = '';
  String _sessionToken = '';
  bool _socketEventInFlight = false;

  bool get hasAuthorizedRide => activeRide.value?.canCommunicate == true;
  RideParticipantModel? get counterpart =>
      activeRide.value?.counterpartFor(_role);

  String get unavailableReason {
    if (pendingRide.value?.status == 'requested') {
      return 'Ride requested. Waiting for the driver to respond.';
    }
    if (activeRide.value == null) {
      return 'Message and Call become available after a driver is assigned.';
    }
    return 'Secure communication is unavailable for this ride status.';
  }

  Future<ActiveRideModel?> _createOrGetDriverContact(String driverId) async {
    final String normalizedId = driverId.trim();
    if (normalizedId.isEmpty || isBusy.value) return null;
    isBusy.value = true;
    contactingDriverId.value = normalizedId;
    userFacingError.value = '';
    try {
      final ActiveRideModel contact =
          await _activeRideRepository.createOrGetContact(normalizedId);
      if (!contact.canCommunicate) {
        userFacingError.value = 'This driver is no longer available.';
        return null;
      }
      activeRide.value = contact;
      pendingRide.value = null;
      return contact;
    } on CommunicationApiException catch (error) {
      userFacingError.value = error.statusCode == 409
          ? 'This driver is no longer available.'
          : error.message;
      return null;
    } finally {
      contactingDriverId.value = '';
      isBusy.value = false;
    }
  }

  Future<void> openDriverChat(String driverId) async {
    final ActiveRideModel? contact = await _createOrGetDriverContact(driverId);
    if (contact != null) {
      Get.toNamed(Routes.RIDE_CHAT);
    } else {
      _showContactError();
    }
  }

  Future<void> initiateDriverCall(String driverId) async {
    final ActiveRideModel? contact = await _createOrGetDriverContact(driverId);
    if (contact != null) {
      await initiateCall();
    } else {
      _showContactError();
    }
  }

  Future<bool> confirmDrewelCall(String displayName) async {
    final BuildContext? context = Get.context;
    final bool arabic = context != null &&
        Localizations.localeOf(context).languageCode.toLowerCase() == 'ar';
    final String name = displayName.trim().isEmpty
        ? (arabic ? 'السائق' : 'Driver')
        : displayName.trim();
    return await Get.dialog<bool>(
          AlertDialog(
            title: Text(arabic ? 'مكالمة عبر Drewel' : 'Drewel call'),
            content: Text(
              arabic
                  ? 'هل تريد الاتصال بـ $name عبر Drewel؟'
                  : 'Call $name through Drewel?',
            ),
            actions: <Widget>[
              TextButton(
                onPressed: () => Get.back<bool>(result: false),
                child: Text(arabic ? 'إلغاء' : 'Cancel'),
              ),
              FilledButton(
                onPressed: () => Get.back<bool>(result: true),
                child: Text(arabic ? 'اتصال' : 'Call'),
              ),
            ],
          ),
        ) ??
        false;
  }

  void _showContactError() {
    final String message = userFacingError.value.trim();
    if (message.isEmpty) return;
    Get.snackbar(
      'Drewel',
      message,
      snackPosition: SnackPosition.BOTTOM,
      duration: const Duration(seconds: 3),
    );
  }

  Future<bool> confirmMission({
    required Map<String, dynamic> pickup,
    required Map<String, dynamic> destination,
    String? vehicleType,
    double? price,
  }) async {
    final ActiveRideModel? contact = activeRide.value;
    if (contact == null || contact.status != 'contacting' || isBusy.value) {
      return false;
    }
    isBusy.value = true;
    userFacingError.value = '';
    try {
      activeRide.value = await _activeRideRepository.confirmMission(
        contact.id,
        pickup: pickup,
        destination: destination,
        vehicleType: vehicleType,
        price: price,
      );
      return true;
    } on CommunicationApiException catch (error) {
      userFacingError.value = error.message;
      return false;
    } finally {
      isBusy.value = false;
    }
  }

  Future<List<ActiveRideModel>> listRequestedRides() =>
      _activeRideRepository.listMine(status: 'requested');

  Future<void> transitionRide(String rideId, String status) async {
    await _activeRideRepository.transitionRide(rideId, status);
    await refreshActiveRide();
  }

  @override
  Future<void> onInit() async {
    super.onInit();
    WidgetsBinding.instance.addObserver(this);
    _agoraService.setTokenRenewalHandler(_renewAgoraToken);
    await configureSession();
    await refreshActiveRide();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.hidden ||
        state == AppLifecycleState.paused ||
        state == AppLifecycleState.detached) {
      _socketService.disconnect();
      return;
    }
    if (state == AppLifecycleState.resumed) {
      // disconnect() disposes the old Socket.IO manager. Force the session
      // setup to create a new socket and restore its event listeners.
      _sessionToken = '';
      unawaited(configureSession());
      unawaited(refreshActiveRide());
    }
  }

  Future<void> _renewAgoraToken() async {
    final CallSessionModel? call = currentCall.value;
    if (call == null || !call.status.isActive) return;
    try {
      final AgoraCredentialsModel credentials =
          await callRepository.getToken(call.id);
      currentCall.value = call.copyWith(credentials: credentials);
      await _agoraService.renewToken(credentials);
    } on CommunicationApiException catch (error) {
      userFacingError.value = error.message;
    }
  }

  Future<void> configureSession() async {
    final SharedPreferences preferences = await SharedPreferences.getInstance();
    _role = preferences.getString(ApiKeyConstants.type) ?? 'user';
    _selfId = preferences.getString(ApiKeyConstants.userId) ?? '';
    final String token = preferences.getString(ApiKeyConstants.token) ?? '';
    _connectionSubscription ??= _agoraService.connectionStates.listen((state) {
      connectionState.value = state;
      if (state == AgoraConnectionState.connected) {
        if (_durationTimer == null) _startDurationTimer();
        _acknowledgeConnected();
      }
    });
    if (token.isNotEmpty && token != _sessionToken) {
      _socketService.disconnect();
      _sessionToken = token;
      _socketService.connect(ApiUrlConstants.socketUrl, token);
      _socketService.off('call:state');
      _socketService.off('ride:state');
      _socketService.off('driver:contact');
      _socketService.on('call:state', _handleCallStateEvent);
      _socketService.on('ride:state', (_) => refreshActiveRide());
      _socketService.on('driver:contact', (_) => refreshActiveRide());
    }
  }

  Future<void> _handleCallStateEvent(dynamic data) async {
    if (_socketEventInFlight || data is! Map) return;
    final String callId = (data['callId'] ?? '').toString();
    if (callId.isEmpty) return;
    _socketEventInFlight = true;
    try {
      final CallSessionModel latest = await callRepository.getCall(callId);
      if (latest.status == CallSessionStatus.ringing &&
          latest.receiverId == _selfId) {
        await showIncomingCall(latest);
        return;
      }
      if (currentCall.value?.id != latest.id) return;
      currentCall.value = latest;
      if (latest.status == CallSessionStatus.accepted &&
          Get.currentRoute == Routes.OUTGOING_CALL) {
        await connectOutgoingWhenAccepted();
      } else if (!latest.status.isActive) {
        await _terminateLocalCall();
        if (Get.currentRoute == Routes.ACTIVE_CALL ||
            Get.currentRoute == Routes.INCOMING_CALL ||
            Get.currentRoute == Routes.OUTGOING_CALL) {
          Get.back<void>();
        }
      }
    } on CommunicationApiException catch (error) {
      userFacingError.value = error.message;
    } finally {
      _socketEventInFlight = false;
    }
  }

  Future<void> refreshActiveRide() async {
    await configureSession();
    try {
      activeRide.value = await _activeRideRepository.getActiveRide();
      if (activeRide.value?.canCommunicate != true) {
        await _terminateLocalCall();
      }
    } catch (error) {
      debugPrint('Active ride refresh failed: ${error.runtimeType}');
      activeRide.value = null;
    }
  }

  Future<void> initiateCall() async {
    if (isBusy.value || currentCall.value?.status.isActive == true) return;
    final ActiveRideModel? ride = activeRide.value;
    if (ride == null || !ride.canCommunicate) {
      userFacingError.value = unavailableReason;
      return;
    }
    isBusy.value = true;
    userFacingError.value = '';
    try {
      await _agoraService.ensureMicrophonePermission();
      final CallSessionModel call = await callRepository.initiate(ride.id);
      currentCall.value = call;
      _startOutgoingPolling();
      isBusy.value = false;
      Get.toNamed(Routes.OUTGOING_CALL);
    } on MicrophonePermissionDenied {
      userFacingError.value =
          'Microphone access is required for secure Drewel calls.';
    } on CommunicationApiException catch (error) {
      userFacingError.value = error.message;
    } finally {
      isBusy.value = false;
    }
  }

  Future<void> showIncomingCall(CallSessionModel call) async {
    if (!hasAuthorizedRide || call.rideId != activeRide.value?.id) return;
    currentCall.value = call;
    if (Get.currentRoute != Routes.INCOMING_CALL) {
      await Get.toNamed(Routes.INCOMING_CALL);
    }
  }

  Future<void> acceptCall() async {
    final CallSessionModel? current = currentCall.value;
    if (current == null || isBusy.value || !hasAuthorizedRide) return;
    isBusy.value = true;
    try {
      await _agoraService.ensureMicrophonePermission();
      CallSessionModel accepted = await callRepository.accept(current.id);
      final AgoraCredentialsModel credentials =
          accepted.credentials ?? await callRepository.getToken(current.id);
      accepted = accepted.copyWith(credentials: credentials);
      currentCall.value = accepted;
      try {
        await _agoraService.join(credentials);
      } catch (_) {
        await callRepository.end(current.id);
        await _terminateLocalCall();
        userFacingError.value =
            'The secure call could not connect. Please retry.';
        return;
      }
      isBusy.value = false;
      Get.offNamed(Routes.ACTIVE_CALL);
    } on MicrophonePermissionDenied {
      userFacingError.value =
          'Microphone access is required for secure Drewel calls.';
    } on CommunicationApiException catch (error) {
      userFacingError.value = error.message;
    } finally {
      isBusy.value = false;
    }
  }

  Future<void> connectOutgoingWhenAccepted() async {
    final CallSessionModel? current = currentCall.value;
    if (current == null || current.status != CallSessionStatus.accepted) return;
    try {
      final AgoraCredentialsModel credentials =
          current.credentials ?? await callRepository.getToken(current.id);
      currentCall.value = current.copyWith(credentials: credentials);
      await _agoraService.join(credentials);
      isBusy.value = false;
      Get.offNamed(Routes.ACTIVE_CALL);
    } on MicrophonePermissionDenied {
      await callRepository.end(current.id);
      await _terminateLocalCall();
      userFacingError.value =
          'Microphone access is required for secure Drewel calls.';
      if (Get.currentRoute == Routes.OUTGOING_CALL) Get.back<void>();
    } catch (_) {
      await callRepository.end(current.id);
      await _terminateLocalCall();
      userFacingError.value =
          'The secure call could not connect. Please retry.';
      if (Get.currentRoute == Routes.OUTGOING_CALL) Get.back<void>();
    }
  }

  void _startOutgoingPolling() {
    _outgoingPollTimer?.cancel();
    _outgoingPollTimer = Timer.periodic(
      const Duration(seconds: 2),
      (_) => _pollOutgoingCall(),
    );
    _pollOutgoingCall();
  }

  Future<void> _pollOutgoingCall() async {
    final CallSessionModel? local = currentCall.value;
    if (local == null ||
        _pollInFlight ||
        (local.status != CallSessionStatus.initiating &&
            local.status != CallSessionStatus.ringing)) {
      return;
    }
    _pollInFlight = true;
    try {
      final CallSessionModel latest = await callRepository.getCall(local.id);
      if (currentCall.value?.id != latest.id) return;
      currentCall.value = latest;
      if (latest.status == CallSessionStatus.accepted) {
        _outgoingPollTimer?.cancel();
        await connectOutgoingWhenAccepted();
      } else if (!latest.status.isActive) {
        _outgoingPollTimer?.cancel();
        userFacingError.value = switch (latest.status) {
          CallSessionStatus.declined => 'The call was declined.',
          CallSessionStatus.missed => 'The call was not answered.',
          _ => 'The call ended.',
        };
        await _terminateLocalCall();
        if (Get.currentRoute == Routes.OUTGOING_CALL) Get.back<void>();
      }
    } on CommunicationApiException catch (error) {
      userFacingError.value = error.message;
    } finally {
      _pollInFlight = false;
    }
  }

  Future<void> _acknowledgeConnected() async {
    final CallSessionModel? call = currentCall.value;
    if (call == null || _connectedAcknowledged) return;
    _connectedAcknowledged = true;
    try {
      currentCall.value = await callRepository.connected(call.id);
    } on CommunicationApiException catch (error) {
      _connectedAcknowledged = false;
      userFacingError.value = error.message;
    }
  }

  Future<void> declineCall() => _finishRemoteAction(callRepository.decline);
  Future<void> cancelCall() => _finishRemoteAction(callRepository.cancel);
  Future<void> endCall() => _finishRemoteAction(callRepository.end);

  Future<void> _finishRemoteAction(
    Future<CallSessionModel> Function(String callId) action,
  ) async {
    final CallSessionModel? call = currentCall.value;
    if (call == null || isBusy.value) return;
    isBusy.value = true;
    bool succeeded = false;
    try {
      currentCall.value = await action(call.id);
      succeeded = true;
    } on CommunicationApiException catch (error) {
      userFacingError.value = error.message;
    } finally {
      isBusy.value = false;
    }
    if (succeeded) {
      await _terminateLocalCall();
      if (Get.currentRoute == Routes.ACTIVE_CALL ||
          Get.currentRoute == Routes.INCOMING_CALL ||
          Get.currentRoute == Routes.OUTGOING_CALL) {
        Get.back<void>();
      }
    }
  }

  Future<void> toggleMute() async {
    isMuted.toggle();
    await _agoraService.setMuted(isMuted.value);
  }

  Future<void> toggleSpeaker() async {
    isSpeakerEnabled.toggle();
    await _agoraService.setSpeakerEnabled(isSpeakerEnabled.value);
  }

  void openRideChat() {
    if (!hasAuthorizedRide) {
      userFacingError.value = unavailableReason;
      return;
    }
    Get.toNamed(Routes.RIDE_CHAT);
  }

  void openSafety() {
    Get.dialog<void>(const SafetyDialog());
  }

  Future<bool> reportRide(String reason) async {
    final ActiveRideModel? ride = activeRide.value;
    if (ride == null || reason.trim().isEmpty) return false;
    try {
      await _activeRideRepository.report(ride.id, reason.trim());
      return true;
    } on CommunicationApiException catch (error) {
      userFacingError.value = error.message;
      return false;
    }
  }

  Future<bool> blockRide(String reason) async {
    final ActiveRideModel? ride = activeRide.value;
    if (ride == null || reason.trim().isEmpty) return false;
    try {
      await _activeRideRepository.block(ride.id, reason.trim());
      await _terminateLocalCall();
      await refreshActiveRide();
      return true;
    } on CommunicationApiException catch (error) {
      userFacingError.value = error.message;
      return false;
    }
  }

  void _startDurationTimer() {
    _durationTimer?.cancel();
    connectedSeconds.value = 0;
    _durationTimer = Timer.periodic(
      const Duration(seconds: 1),
      (_) => connectedSeconds.value++,
    );
  }

  Future<void> _terminateLocalCall() async {
    _outgoingPollTimer?.cancel();
    _outgoingPollTimer = null;
    _pollInFlight = false;
    _connectedAcknowledged = false;
    _durationTimer?.cancel();
    _durationTimer = null;
    connectedSeconds.value = 0;
    isMuted.value = false;
    isSpeakerEnabled.value = false;
    await _agoraService.leave();
    currentCall.value = null;
  }

  @override
  void onClose() {
    WidgetsBinding.instance.removeObserver(this);
    _durationTimer?.cancel();
    _outgoingPollTimer?.cancel();
    _connectionSubscription?.cancel();
    _socketService.disconnect();
    _agoraService.dispose();
    super.onClose();
  }
}

class CommunicationBinding extends Bindings {
  @override
  void dependencies() {
    if (Get.isRegistered<CallStateController>()) return;
    final CommunicationApiClient api = CommunicationApiClient();
    Get.put<CallStateController>(
      CallStateController(
        activeRideRepository: ActiveRideRepository(api),
        callRepository: CallRepository(api),
        messageRepository: RideMessageRepository(api),
        agoraService: AgoraCallService(),
      ),
      permanent: true,
    );
  }
}
