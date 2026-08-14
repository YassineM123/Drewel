import 'dart:async';

import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../../common/socket_services.dart';
import '../../../../common/notification_sound_service.dart';
import '../../../../common/push_notification_service.dart';
import '../../../../common/deep_link_service.dart';

import '../../../data/apis/api_constants/api_key_constants.dart';
import '../../../data/apis/api_constants/api_url_constants.dart';
import '../../../data/apis/api_models/active_ride_model.dart';
import '../../../data/apis/api_models/app_notification_model.dart';
import '../../../data/apis/api_models/call_session_model.dart';
import '../../../data/apis/api_models/ride_conversation_model.dart';
import '../../../data/apis/communication_api_client.dart';
import '../../../data/repositories/active_ride_repository.dart';
import '../../../data/repositories/call_repository.dart';
import '../../../data/repositories/conversation_repository.dart';
import '../../../data/repositories/notification_repository.dart';
import '../../../data/repositories/ride_message_repository.dart';
import '../../../data/services/agora_call_service.dart';
import '../../../routes/app_pages.dart';
import '../widgets/safety_dialog.dart';

class CallStateController extends GetxService with WidgetsBindingObserver {
  CallStateController({
    required ActiveRideRepository activeRideRepository,
    required this.callRepository,
    required this.messageRepository,
    required this.conversationRepository,
    required this.notificationRepository,
    required AgoraCallService agoraService,
    SocketService? socketService,
  })  : _activeRideRepository = activeRideRepository,
        _agoraService = agoraService,
        _socketService = socketService ?? SocketService();

  final ActiveRideRepository _activeRideRepository;
  final CallRepository callRepository;
  final RideMessageRepository messageRepository;
  final ConversationRepository conversationRepository;
  final NotificationRepository notificationRepository;
  final AgoraCallService _agoraService;
  final SocketService _socketService;

  final Rxn<ActiveRideModel> activeRide = Rxn<ActiveRideModel>();
  final Rxn<CallSessionModel> currentCall = Rxn<CallSessionModel>();
  final Rxn<ActiveRideModel> pendingRide = Rxn<ActiveRideModel>();
  final RxInt conversationUnread = 0.obs;
  final RxInt notificationUnread = 0.obs;
  final RxList<AppNotificationModel> notifications =
      <AppNotificationModel>[].obs;
  final Rxn<NotificationFilter> notificationFilter = Rxn<NotificationFilter>();
  final RxBool notificationsHasMore = false.obs;
  final RxBool notificationsLoading = false.obs;
  final Rx<AgoraConnectionState> connectionState =
      AgoraConnectionState.idle.obs;
  final RxBool isBusy = false.obs;
  final RxBool isMuted = false.obs;
  final RxBool isSpeakerEnabled = false.obs;
  final RxString contactingDriverId = ''.obs;
  final RxString userFacingError = ''.obs;

  NotificationSoundService? get _soundsService =>
      Get.isRegistered<NotificationSoundService>()
          ? Get.find<NotificationSoundService>()
          : null;
  StreamSubscription<AgoraConnectionState>? _connectionSubscription;
  Timer? _durationTimer;
  Timer? _outgoingPollTimer;
  bool _pollInFlight = false;
  bool _connectedAcknowledged = false;
  final RxInt connectedSeconds = 0.obs;
  String _role = 'user';
  String _selfId = '';
  String _sessionToken = '';
  String _pushRegisteredForSession = '';
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

  Future<ActiveRideModel?> _createOrGetDriverContact(
    String driverId, {
    Map<String, dynamic>? pickup,
    Map<String, dynamic>? destination,
  }) async {
    final String normalizedId = driverId.trim();
    if (normalizedId.isEmpty || isBusy.value) return null;
    isBusy.value = true;
    contactingDriverId.value = normalizedId;
    userFacingError.value = '';
    try {
      final ActiveRideModel contact =
          await _activeRideRepository.createOrGetContact(
        normalizedId,
        pickup: pickup,
        destination: destination,
      );
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

  Future<void> openDriverChat(
    String driverId, {
    Map<String, dynamic>? pickup,
    Map<String, dynamic>? destination,
  }) async {
    final ActiveRideModel? contact = await _createOrGetDriverContact(
      driverId,
      pickup: pickup,
      destination: destination,
    );
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
    _wirePushService();
    await configureSession();
    await refreshActiveRide();
    await refreshUnreadSummary();
    await refreshNotifications();
  }

  /// Connects the push pipeline to the live controller. FCM may be absent
  /// (graceful fallback) but the wiring itself is always registered.
  void _wirePushService() {
    if (!Get.isRegistered<PushNotificationService>()) return;
    final PushNotificationService push = Get.find<PushNotificationService>();
    push.onForegroundMessage = _handleRemoteMessage;
    push.onDeepLink = (String link) {
      unawaited(DeepLinkService.instance.handle(link));
    };
  }

  /// A push message arrived in the foreground. The data payload mirrors the
  /// realtime `notification:new` shape, so it feeds the same pipeline.
  Future<void> _handleRemoteMessage(Map<String, dynamic> data) async {
    if (data.isEmpty) return;
    final AppNotificationModel notification =
        AppNotificationModel.fromJson(data);
    await _absorbNotification(notification);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.hidden ||
        state == AppLifecycleState.paused ||
        state == AppLifecycleState.detached) {
      // Never leave a ringtone or chime running while the app is not visible.
      unawaited(_soundsService?.stopCallSound());
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
      unawaited(_registerPushTokenOnce(token));
      _socketService.connect(ApiUrlConstants.socketUrl, token);
      _socketService.off('call:state');
      _socketService.off('ride:state');
      _socketService.off('driver:contact');
      _socketService.off('conversation:updated');
      _socketService.off('notification:new');
      _socketService.on('call:state', _handleCallStateEvent);
      _socketService.on('ride:state', (_) => refreshActiveRide());
      _socketService.on('driver:contact', _handleDriverContact);
      _socketService.on('conversation:updated', _handleConversationUpdated);
      _socketService.on('notification:new', _handleNotificationNew);
    }
  }

  /// Registers the FCM token once per session. The push service handles the
  /// Firebase-absent case internally (token fetch just fails silently).
  Future<void> _registerPushTokenOnce(String sessionToken) async {
    if (_pushRegisteredForSession == sessionToken) return;
    _pushRegisteredForSession = sessionToken;
    try {
      if (Get.isRegistered<PushNotificationService>()) {
        await Get.find<PushNotificationService>().registerCurrentToken();
      }
    } catch (error) {
      debugPrint('Push token registration failed: ${error.runtimeType}');
    }
  }

  Future<void> refreshUnreadSummary() async {
    try {
      final ConversationUnreadSummary summary =
          await conversationRepository.summary();
      conversationUnread.value = summary.unreadTotal;
    } catch (error) {
      debugPrint('Conversation unread refresh failed: ${error.runtimeType}');
    }
    try {
      notificationUnread.value = await notificationRepository.unreadCount();
    } catch (error) {
      debugPrint('Notification unread refresh failed: ${error.runtimeType}');
    }
  }

  /// Reloads the first page of notifications for the active filter.
  Future<void> refreshNotifications() async {
    if (notificationsLoading.value) return;
    notificationsLoading.value = true;
    try {
      final NotificationFilter filter =
          notificationFilter.value ?? NotificationFilter.all;
      final NotificationListResult result =
          await notificationRepository.list(filter: filter);
      notifications.assignAll(result.notifications);
      notificationsHasMore.value = result.hasMore;
      notificationUnread.value = result.unreadCount;
    } catch (error) {
      debugPrint('Notification refresh failed: ${error.runtimeType}');
    } finally {
      notificationsLoading.value = false;
    }
  }

  /// Appends the next page of notifications (infinite scroll).
  Future<void> loadMoreNotifications() async {
    if (notificationsLoading.value || !notificationsHasMore.value) return;
    notificationsLoading.value = true;
    final int page =
        (notifications.length / NotificationRepository.pageSize).ceil() + 1;
    try {
      final NotificationFilter filter =
          notificationFilter.value ?? NotificationFilter.all;
      final NotificationListResult result =
          await notificationRepository.list(filter: filter, page: page);
      final List<AppNotificationModel> fresh = <AppNotificationModel>[
        ...notifications
      ];
      final Set<String> existingIds =
          fresh.map((AppNotificationModel item) => item.id).toSet();
      fresh.addAll(result.notifications.where(
          (AppNotificationModel item) => !existingIds.contains(item.id)));
      notifications.assignAll(fresh);
      notificationsHasMore.value = result.hasMore;
    } catch (error) {
      debugPrint('Notification load more failed: ${error.runtimeType}');
    } finally {
      notificationsLoading.value = false;
    }
  }

  /// Switches the visible filter and reloads.
  Future<void> setNotificationFilter(NotificationFilter filter) async {
    if (notificationFilter.value == filter) return;
    notificationFilter.value = filter;
    await refreshNotifications();
  }

  Future<void> _handleConversationUpdated(dynamic data) async {
    await refreshUnreadSummary();
  }

  Future<void> _handleNotificationNew(dynamic data) async {
    if (data is! Map) return;
    final AppNotificationModel notification =
        AppNotificationModel.fromJson(Map<String, dynamic>.from(data));
    if (notification.id.isEmpty) {
      await refreshNotifications();
      return;
    }
    await _absorbNotification(notification);
  }

  /// Inserts a realtime/foreground notification into the list, bumps the
  /// unread badge and plays the matching sound. Shared by the socket event
  /// and the foreground push handler.
  Future<void> _absorbNotification(AppNotificationModel notification) async {
    notifications
      ..removeWhere(
        (AppNotificationModel existing) => existing.id == notification.id,
      )
      ..insert(0, notification);
    if (notifications.length > 100) {
      notifications.removeRange(100, notifications.length);
    }
    if (notification.isUnread) {
      notificationUnread.value++;
    }
    await _playNotificationSound(notification);
  }

  /// Maps a realtime notification to its Drewel sound. The event never needs
  /// deduplication here because [NotificationSoundService] collapses multiple
  /// sources for the same logical id onto a single play.
  Future<void> _playNotificationSound(AppNotificationModel notification) async {
    final NotificationSoundService? sounds = _soundsService;
    if (sounds == null) return;
    final String key = notification.messageId?.isNotEmpty == true
        ? notification.messageId!
        : notification.id;
    switch ((notification.type ?? '').toUpperCase()) {
      case 'RIDE_MESSAGE':
        await sounds.playMessage(eventKey: key);
      case 'POINTS_LOW_BALANCE':
      case 'POINTS_INSUFFICIENT_BALANCE':
        await sounds.playWarning(eventKey: key);
      case 'TRIP_OFFER_ACCEPTED':
      case 'POINTS_PURCHASE':
      case 'POINTS_CREDITED':
      case 'PURCHASED_POINTS_CREDITED':
      case 'POINTS_ADJUSTED':
      case 'WELCOME_POINTS_RECEIVED':
      case 'OFFER_POINTS_RELEASED':
        await sounds.playSuccess(eventKey: key);
      case 'POINT_PURCHASE_REQUEST_UPDATED':
        final String status =
            (notification.data['status'] ?? '').toString().toLowerCase();
        if (status == 'approved' || status == 'completed') {
          await sounds.playSuccess(eventKey: key);
        } else {
          await sounds.playNotification(eventKey: key);
        }
      default:
        await sounds.playNotification(eventKey: key);
    }
  }

  /// A passenger has just contacted this driver with a new ride request.
  /// This is the one authoritative source for the ride-request alert — REST
  /// refreshes and the foreground panel never re-trigger it.
  Future<void> _handleDriverContact(dynamic data) async {
    if (_role == ApiKeyConstants.driver) {
      final String rideId =
          data is Map ? (data['rideId'] ?? '').toString() : '';
      await _soundsService?.playRideRequest(eventKey: rideId);
    }
    await refreshActiveRide();
  }

  Future<RideConversationModel> markConversationRead(String rideId) async {
    final RideConversationModel conversation =
        await conversationRepository.markRead(rideId);
    await refreshUnreadSummary();
    return conversation;
  }

  Future<void> markNotificationRead(String notificationId) async {
    try {
      final int unread = await notificationRepository.markRead(notificationId);
      notificationUnread.value = unread;
      final int index = notifications.indexWhere(
        (AppNotificationModel item) => item.id == notificationId,
      );
      if (index >= 0) {
        notifications[index] = notifications[index].copyWith(read: true);
      }
    } catch (error) {
      debugPrint('Notification read failed: ${error.runtimeType}');
    }
  }

  Future<void> markAllNotificationsRead() async {
    try {
      notificationUnread.value = await notificationRepository.markAllAsRead();
      for (int index = 0; index < notifications.length; index++) {
        if (!notifications[index].read) {
          notifications[index] = notifications[index].copyWith(read: true);
        }
      }
    } catch (error) {
      debugPrint('Mark all notifications read failed: ${error.runtimeType}');
    }
  }

  void openConversation(String rideId) {
    Get.toNamed(Routes.RIDE_CHAT, arguments: <String, dynamic>{
      'rideId': rideId,
    });
  }

  /// Opens a notification: marks it read and routes through its deep link.
  /// Unknown or un-routable links fall back to the notifications center.
  Future<void> openNotification(AppNotificationModel notification) async {
    if (notification.isUnread) {
      await markNotificationRead(notification.id);
    }
    final String link = notification.effectiveDeepLink;
    await DeepLinkService.instance.handle(link);
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
      currentCall.value =
          currentCall.value?.mergeRuntimeState(latest) ?? latest;
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
    if (!hasAuthorizedRide || call.rideId != activeRide.value?.id) {
      await refreshActiveRide();
    }
    if (!hasAuthorizedRide || call.rideId != activeRide.value?.id) return;
    currentCall.value = call;
    // Start the looping ringtone before navigating. Duplicate ringing events
    // for the same call id are ignored internally.
    await _soundsService?.playIncomingCall(callId: call.id);
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
      // Answering means the ringtone must vanish immediately.
      await _soundsService?.stopCallSound(callId: current.id);
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
      currentCall.value =
          currentCall.value?.mergeRuntimeState(latest) ?? latest;
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
      final CallSessionModel connected =
          await callRepository.connected(call.id);
      currentCall.value = call.mergeRuntimeState(connected);
    } on CommunicationApiException catch (error) {
      _connectedAcknowledged = false;
      userFacingError.value = error.message;
    }
  }

  Future<void> declineCall() => _finishRemoteAction(callRepository.decline);
  Future<void> cancelCall() => _cancelOutgoingCall();
  Future<void> endCall() => _finishRemoteAction(callRepository.end);

  Future<void> _cancelOutgoingCall() async {
    final CallSessionModel? call = currentCall.value;
    if (call == null || isBusy.value) return;
    if (call.status == CallSessionStatus.accepted ||
        call.status == CallSessionStatus.connected) {
      await _finishRemoteAction(callRepository.end);
      return;
    }
    isBusy.value = true;
    bool shouldClose = false;
    try {
      final CallSessionModel latest = await callRepository.cancel(call.id);
      currentCall.value = call.mergeRuntimeState(latest);
      shouldClose = true;
    } on CommunicationApiException catch (error) {
      if (error.code == 'INVALID_CALL_STATE' || error.statusCode == 409) {
        shouldClose = await _resolveCancelRace(call);
      } else {
        userFacingError.value = error.message;
      }
    } finally {
      isBusy.value = false;
    }
    if (shouldClose) {
      await _closeCallRoute();
    }
  }

  Future<bool> _resolveCancelRace(CallSessionModel call) async {
    try {
      final CallSessionModel latest = await callRepository.getCall(call.id);
      currentCall.value = call.mergeRuntimeState(latest);
      if (latest.status == CallSessionStatus.accepted ||
          latest.status == CallSessionStatus.connected) {
        final CallSessionModel ended = await callRepository.end(call.id);
        currentCall.value = latest.mergeRuntimeState(ended);
        return true;
      }
      if (!latest.status.isActive) return true;
      userFacingError.value = 'The call state changed. Please try again.';
      return false;
    } on CommunicationApiException catch (error) {
      userFacingError.value = error.message;
      return false;
    }
  }

  Future<void> _finishRemoteAction(
    Future<CallSessionModel> Function(String callId) action,
  ) async {
    final CallSessionModel? call = currentCall.value;
    if (call == null || isBusy.value) return;
    isBusy.value = true;
    bool succeeded = false;
    try {
      final CallSessionModel latest = await action(call.id);
      currentCall.value = call.mergeRuntimeState(latest);
      succeeded = true;
    } on CommunicationApiException catch (error) {
      userFacingError.value = error.message;
    } finally {
      isBusy.value = false;
    }
    if (succeeded) {
      await _closeCallRoute();
    }
  }

  Future<void> _closeCallRoute() async {
    await _soundsService?.stopCallSound();
    await _terminateLocalCall();
    if (Get.currentRoute == Routes.ACTIVE_CALL ||
        Get.currentRoute == Routes.INCOMING_CALL ||
        Get.currentRoute == Routes.OUTGOING_CALL) {
      Get.back<void>();
    }
  }

  Future<void> toggleMute() async {
    if (currentCall.value == null) return;
    isMuted.toggle();
    await _agoraService.setMuted(isMuted.value);
  }

  Future<void> toggleSpeaker() async {
    if (currentCall.value == null) return;
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
    // The call is gone — the ringtone must not survive it.
    await _soundsService?.stopCallSound();
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

  Future<void> disposeForLogout() async {
    _durationTimer?.cancel();
    _durationTimer = null;
    _outgoingPollTimer?.cancel();
    _outgoingPollTimer = null;
    await _terminateLocalCall();
    activeRide.value = null;
    notifications.clear();
    notificationUnread.value = 0;
    conversationUnread.value = 0;
    _socketService.disconnect();
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
        conversationRepository: ConversationRepository(api),
        messageRepository: RideMessageRepository(api),
        notificationRepository: NotificationRepository(api),
        agoraService: AgoraCallService(),
      ),
      permanent: true,
    );
  }
}
