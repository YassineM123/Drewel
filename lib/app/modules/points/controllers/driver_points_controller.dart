import 'dart:async';
import 'dart:io';
import 'dart:math';

import 'package:flutter/widgets.dart';
import 'package:get/get.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../../../../common/socket_services.dart';
import '../../../data/apis/api_constants/api_key_constants.dart';
import '../../../data/apis/api_constants/api_url_constants.dart';
import '../../../data/apis/api_models/driver_points_models.dart';
import '../../../data/apis/communication_api_client.dart';
import '../../../data/repositories/driver_points_repository.dart';

enum PointsLoadState { initial, loading, ready, error, offline }

enum SendOfferResult { sent, insufficientPoints, failed }

abstract class PointsRealtime {
  bool get isConnected;
  void connect(String url, String token);
  void on(String event, void Function(dynamic data) callback);
  void off(String event);
  void disconnect();
}

class SocketPointsRealtime implements PointsRealtime {
  SocketPointsRealtime([SocketService? service])
      : _service = service ?? SocketService();

  final SocketService _service;

  @override
  bool get isConnected => _service.isConnected;

  @override
  void connect(String url, String token) => _service.connect(url, token);

  @override
  void disconnect() => _service.disconnect();

  @override
  void off(String event) => _service.off(event);

  @override
  void on(String event, void Function(dynamic data) callback) =>
      _service.on(event, callback);
}

class DriverPointsController extends GetxController
    with WidgetsBindingObserver {
  DriverPointsController({
    required DriverPointsRepository repository,
    PointsRealtime? realtime,
    void Function(String message)? statusNotifier,
  })  : _repository = repository,
        _realtime = realtime ?? SocketPointsRealtime(),
        _statusNotifier = statusNotifier;

  final DriverPointsRepository _repository;
  final PointsRealtime _realtime;
  final void Function(String message)? _statusNotifier;
  final Random _random = Random.secure();

  final Rx<PointsLoadState> state = PointsLoadState.initial.obs;
  final Rxn<DriverPointsWallet> wallet = Rxn<DriverPointsWallet>();
  final RxList<PointTransaction> transactions = <PointTransaction>[].obs;
  final RxList<PointPack> packs = <PointPack>[].obs;
  final RxList<PointPurchaseRequest> purchaseRequests =
      <PointPurchaseRequest>[].obs;
  final RxList<TripOffer> offers = <TripOffer>[].obs;
  final RxBool isSendingOffer = false.obs;
  final RxBool isCreatingPurchaseRequest = false.obs;
  final RxBool isSocketConnected = false.obs;

  Future<bool>? _walletRefresh;
  Timer? _fallbackTimer;
  Timer? _disconnectRefreshTimer;
  final Set<String> _seenRealtimeEvents = <String>{};
  final Set<String> _shownOfferStatuses = <String>{};
  final Map<String, String> _offerRetryIds = <String, String>{};
  final Map<String, String> _purchaseRetryIds = <String, String>{};

  static const List<String> _pointsEvents = <String>[
    'points:reserved',
    'points:released',
    'points:charged',
    'points:credited',
    'points:wallet_updated',
    'points:purchase_request_updated',
  ];

  bool get isOffline => state.value == PointsLoadState.offline;

  @override
  void onInit() {
    super.onInit();
    WidgetsBinding.instance.addObserver(this);
    unawaited(configureRealtime());
    unawaited(refreshAll());
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      unawaited(configureRealtime());
      unawaited(refreshAll(silent: true));
    } else if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.detached ||
        state == AppLifecycleState.hidden) {
      _realtime.disconnect();
      _stopDisconnectedFallback();
      isSocketConnected.value = false;
    }
  }

  Future<void> configureRealtime() async {
    final preferences = await SharedPreferences.getInstance();
    final token = preferences.getString(ApiKeyConstants.token)?.trim() ?? '';
    if (token.isEmpty) return;
    _realtime.connect(ApiUrlConstants.socketUrl, token);
    for (final event in _pointsEvents) {
      _realtime.off(event);
      _realtime.on(event, (dynamic data) => handleRealtimeEvent(event, data));
    }
    _realtime.off('connect');
    _realtime.on('connect', (_) {
      _stopDisconnectedFallback();
      isSocketConnected.value = true;
      unawaited(refreshWallet(silent: true));
    });
    _realtime.off('disconnect');
    _realtime.on('disconnect', (_) {
      isSocketConnected.value = false;
      _startDisconnectedFallback();
    });
    isSocketConnected.value = _realtime.isConnected;
    if (isSocketConnected.value) {
      _stopDisconnectedFallback();
    }
  }

  Future<void> refreshAll({bool silent = false}) async {
    await Future.wait<void>(<Future<void>>[
      refreshWallet(silent: silent).then((_) {}),
      refreshTransactions(),
      refreshPacks(),
      refreshPurchaseRequests(),
      refreshOffers(),
    ]);
  }

  Future<bool> refreshWallet({bool silent = false}) {
    final current = _walletRefresh;
    if (current != null) return current;
    final future = _performWalletRefresh(silent: silent);
    _walletRefresh = future;
    return future.whenComplete(() => _walletRefresh = null);
  }

  Future<bool> _performWalletRefresh({required bool silent}) async {
    if (!silent && wallet.value == null) state.value = PointsLoadState.loading;
    try {
      applyWallet(await _repository.getWallet());
      state.value = PointsLoadState.ready;
      return true;
    } catch (error) {
      state.value = _isNetworkError(error)
          ? PointsLoadState.offline
          : PointsLoadState.error;
      return false;
    }
  }

  void applyWallet(DriverPointsWallet serverWallet) {
    final current = wallet.value;
    if (current == null || serverWallet.version >= current.version) {
      wallet.value = serverWallet;
    }
  }

  Future<void> refreshTransactions() async {
    try {
      transactions.assignAll(await _repository.getTransactions());
    } catch (error) {
      debugPrint('Points transaction refresh failed: ${error.runtimeType}');
    }
  }

  Future<void> refreshPacks() async {
    try {
      packs.assignAll(await _repository.getPacks());
    } catch (error) {
      debugPrint('Point pack refresh failed: ${error.runtimeType}');
    }
  }

  Future<void> refreshPurchaseRequests() async {
    try {
      purchaseRequests.assignAll(await _repository.getPurchaseRequests());
    } catch (error) {
      debugPrint('Purchase request refresh failed: ${error.runtimeType}');
    }
  }

  Future<void> refreshOffers() async {
    try {
      offers.assignAll(await _repository.getMyOffers());
    } catch (error) {
      debugPrint('Trip offer refresh failed: ${error.runtimeType}');
    }
  }

  TripOffer? offerForRide(String rideId) {
    for (final offer in offers) {
      if (offer.contactRideId == rideId) return offer;
    }
    return null;
  }

  Future<SendOfferResult> sendOffer(TripOfferDraft draft) async {
    if (isSendingOffer.value) return SendOfferResult.failed;
    final currentWallet = wallet.value;
    if (currentWallet == null) {
      await refreshWallet();
    }
    if (wallet.value?.canSendOffer != true) {
      return SendOfferResult.insufficientPoints;
    }
    isSendingOffer.value = true;
    final retryId = _offerRetryIds.putIfAbsent(
      draft.contactRideId,
      () => _newClientId('offer'),
    );
    try {
      final offer = await _repository.sendOffer(
        draft: draft,
        clientOfferId: retryId,
        idempotencyKey: retryId,
      );
      _offerRetryIds.remove(draft.contactRideId);
      offers.removeWhere((item) => item.id == offer.id);
      offers.insert(0, offer);
      await refreshWallet(silent: true);
      await refreshTransactions();
      return SendOfferResult.sent;
    } on CommunicationApiException catch (error) {
      if (error.code == 'INSUFFICIENT_AVAILABLE_POINTS') {
        await refreshWallet(silent: true);
        return SendOfferResult.insufficientPoints;
      }
      return SendOfferResult.failed;
    } catch (_) {
      return SendOfferResult.failed;
    } finally {
      isSendingOffer.value = false;
    }
  }

  Future<PointPurchaseRequest?> requestPack(PointPack pack) async {
    if (isCreatingPurchaseRequest.value) return null;
    isCreatingPurchaseRequest.value = true;
    final retryId =
        _purchaseRetryIds.putIfAbsent(pack.id, () => _newClientId('purchase'));
    try {
      final request = await _repository.createPurchaseRequest(
        packId: pack.id,
        clientRequestId: retryId,
      );
      _purchaseRetryIds.remove(pack.id);
      purchaseRequests.removeWhere((item) => item.id == request.id);
      purchaseRequests.insert(0, request);
      return request;
    } catch (_) {
      return null;
    } finally {
      isCreatingPurchaseRequest.value = false;
    }
  }

  void handleRealtimeEvent(String event, dynamic data) {
    if (data is! Map) return;
    final payload = Map<String, dynamic>.from(data);
    final version = _asInt(payload['walletVersion']);
    final offerId = (payload['offerId'] ?? '').toString();
    final status = (payload['status'] ?? '').toString().toLowerCase();
    final eventKey = '$event:$version:$offerId:$status';
    if (!_seenRealtimeEvents.add(eventKey)) return;
    if (_seenRealtimeEvents.length > 200) {
      _seenRealtimeEvents.remove(_seenRealtimeEvents.first);
    }

    final currentVersion = wallet.value?.version ?? -1;
    if (version > currentVersion) {
      unawaited(_refreshForRealtimeVersion(version));
    }
    if (offerId.isNotEmpty && status.isNotEmpty) {
      _notifyOfferStatusOnce(offerId, status, _asInt(payload['points']));
    } else if (event == 'points:reserved' && offerId.isNotEmpty) {
      _notifyOfferStatusOnce(offerId, 'pending', _asInt(payload['points']));
    }
    if (event == 'points:purchase_request_updated') {
      unawaited(refreshPurchaseRequests());
    }
  }

  Future<void> _refreshForRealtimeVersion(int expectedVersion) async {
    final refreshed = await refreshWallet(silent: true);
    await Future.wait<void>(<Future<void>>[
      refreshTransactions(),
      refreshOffers(),
    ]);
    if (refreshed && (wallet.value?.version ?? -1) >= expectedVersion) return;
    _fallbackTimer?.cancel();
    _fallbackTimer = Timer(const Duration(seconds: 3), () {
      unawaited(refreshWallet(silent: true));
      unawaited(refreshTransactions());
      unawaited(refreshOffers());
    });
  }

  void _startDisconnectedFallback() {
    if (_disconnectRefreshTimer != null) return;
    unawaited(_refreshAfterRealtimeLoss());
    _disconnectRefreshTimer = Timer.periodic(
      const Duration(seconds: 15),
      (_) => unawaited(_refreshAfterRealtimeLoss()),
    );
  }

  void _stopDisconnectedFallback() {
    _disconnectRefreshTimer?.cancel();
    _disconnectRefreshTimer = null;
  }

  Future<void> _refreshAfterRealtimeLoss() async {
    await Future.wait<void>(<Future<void>>[
      refreshWallet(silent: true).then((_) {}),
      refreshTransactions(),
      refreshPurchaseRequests(),
      refreshOffers(),
    ]);
  }

  void _notifyOfferStatusOnce(String offerId, String status, int points) {
    final key = '$offerId:$status';
    if (!_shownOfferStatuses.add(key)) return;
    final message = switch (status) {
      'pending' => 'points.reserved_status'.trParams({'points': '$points'}),
      'accepted' => 'points.accepted_status'.trParams({'points': '$points'}),
      'declined' => 'points.declined_status'.trParams({'points': '$points'}),
      'expired' => 'points.expired_status'.trParams({'points': '$points'}),
      'delivery_failed' => 'points.failure_status'.tr,
      'cancelled' => 'points.cancelled_status'.tr,
      _ => '',
    };
    if (message.isEmpty) return;
    if (_statusNotifier != null) {
      _statusNotifier(message);
    } else if (Get.context != null) {
      Get.snackbar(
        'Drewel',
        message,
        snackPosition: SnackPosition.BOTTOM,
        duration: const Duration(seconds: 3),
      );
    }
  }

  String _newClientId(String prefix) {
    final random = _random.nextInt(0x7fffffff).toRadixString(36);
    return '$prefix-${DateTime.now().microsecondsSinceEpoch}-$random';
  }

  bool _isNetworkError(Object error) =>
      error is SocketException ||
      error is http.ClientException ||
      error is TimeoutException;

  int _asInt(dynamic value) => value is num ? value.toInt() : -1;

  @override
  void onClose() {
    WidgetsBinding.instance.removeObserver(this);
    _fallbackTimer?.cancel();
    _stopDisconnectedFallback();
    for (final event in <String>[..._pointsEvents, 'connect', 'disconnect']) {
      _realtime.off(event);
    }
    _realtime.disconnect();
    super.onClose();
  }
}
