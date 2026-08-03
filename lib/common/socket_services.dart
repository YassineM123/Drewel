import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;

class SocketService {
  IO.Socket? _socket;
  bool _locationTrackingReady = false;
  Map<String, dynamic>? _pendingDriverLocation;
  void Function()? _locationTrackingReadyCallback;
  Function(dynamic)? _driversNearbyCallback;
  DateTime? _lastConnectionErrorLogAt;

  static const Duration _connectionErrorLogInterval = Duration(seconds: 30);

  // Initialize and connect the socket
  void connect(String url, String token) {
    // If already connected, just return
    if (_socket != null && _socket!.connected) {
      print('Socket already connected');
      return;
    }

    // Dispose old socket if exists but not connected - prevents stale socket instances
    if (_socket != null && !_socket!.connected) {
      print('Disposing stale socket...');
      _socket!.dispose();
      _socket = null;
    }

    _socket = IO.io(
      url,
      IO.OptionBuilder()
          .setTransports(['websocket']) // Use WebSocket transport
          .disableAutoConnect() // Disable auto-connect to handle it manually
          .setAuth({'token': token}) // Pass token in headers
          // Back off during temporary DNS/network loss instead of retrying every
          // few seconds indefinitely. A foreground resume creates a fresh socket.
          .enableReconnection()
          .setReconnectionDelay(2000)
          .setReconnectionDelayMax(30000)
          .setRandomizationFactor(0.5)
          .setTimeout(10000)
          .build(),
    );

    // IMPORTANT: Set up listeners BEFORE calling connect()
    _socket!.on('connect', (_) {
      _locationTrackingReady = false;
      _lastConnectionErrorLogAt = null;
      debugPrint('Connected to the WebSocket server');
    });

    _socket!.on('disconnect', (_) {
      _locationTrackingReady = false;
      debugPrint('Disconnected from the WebSocket server');
    });

    _socket!.on('connect_error', (err) {
      final DateTime now = DateTime.now();
      final DateTime? lastLogAt = _lastConnectionErrorLogAt;
      if (lastLogAt == null ||
          now.difference(lastLogAt) >= _connectionErrorLogInterval) {
        _lastConnectionErrorLogAt = now;
        debugPrint('WebSocket connection unavailable: $err');
      }
    });

    // Authentication is asynchronous on the server. Waiting for this event
    // prevents the first room join/location update from being emitted before
    // the server has registered its location handlers.
    _socket!.on('location-tracking-ready', (_) {
      _locationTrackingReady = true;
      _flushPendingDriverLocation();
      _locationTrackingReadyCallback?.call();
    });

    final Function(dynamic)? driversNearbyCallback = _driversNearbyCallback;
    if (driversNearbyCallback != null) {
      _socket!.on('drivers-nearby', driversNearbyCallback);
    }

    // Now connect AFTER listeners are set up
    _socket!.connect();
  }

  // Disconnect the socket
  void disconnect() {
    if (_socket != null) {
      _socket!.disconnect();
      _socket!.dispose();
      _socket = null;
    }
    _locationTrackingReady = false;
    _pendingDriverLocation = null;
    _lastConnectionErrorLogAt = null;
  }

  // Emit an event - check _socket!.connected directly for real-time state
  void emit(String event, dynamic data) {
    if (_socket != null && _socket!.connected) {
      _socket!.emit(event, data);
    } else {
      print('Socket not connected. Unable to emit $event');
    }
  }

  void emitWithAck(
    String event,
    dynamic data,
    void Function(dynamic response) callback,
  ) {
    final IO.Socket? socket = _socket;
    if (socket == null || !socket.connected) {
      callback(<String, dynamic>{
        'success': false,
        'code': 'SOCKET_DISCONNECTED',
      });
      return;
    }
    socket.emitWithAck(event, data, ack: callback);
  }

  // Listen to an event
  void on(String event, Function(dynamic) callback) {
    if (_socket != null) {
      _socket!.on(event, (data) {
        callback(data);
      });
    }
  }

  // Listen for socket connection. If already connected, call immediately.
  void onConnect(void Function() callback) {
    if (_socket == null) return;
    if (_socket!.connected) {
      callback();
      return;
    }
    _socket!.on('connect', (_) {
      callback();
    });
  }

  // Remove a listener
  void off(String event) {
    if (_socket != null) {
      _socket!.off(event);
    }
  }

  // Check if socket is connected - use actual socket state
  bool get isConnected => _socket != null && _socket!.connected;

  // Specific handler for 'message' event
  void onMessage(Function(dynamic) callback) {
    on('message', (data) {
      print('Raw message data received:----- $data');
      callback(data);
    });
  }

  // Event-specific methods
  void onMessagePage(Function(dynamic) callback) =>
      on('message-page', callback);
  void onMessageUser(Function(dynamic) callback) =>
      on('message-user', callback);
  void onOnlineUser(Function(dynamic) callback) => on('onlineUser', callback);
  void onConversation(Function(dynamic) callback) =>
      on('conversation', callback);

  void emitNewMessage(Map<String, dynamic> messageData) =>
      emit('new message', messageData);
  void emitSeen(String msgByUserId) => emit('seen', msgByUserId);
  void emitJoinGroupRoom(String groupId) => emit('join-group-room', groupId);

  // ==================== LOCATION TRACKING EVENTS ====================

  /// Driver emits their location update (called every 5-10 seconds when online)
  /// Data: { driverId, lat, long, fullName, vehicleType, city }
  void emitDriverLocationUpdate(Map<String, dynamic> locationData) {
    // Always retain the newest GPS fix. It is flushed when the authenticated
    // location channel is ready and again after every reconnect.
    _pendingDriverLocation = Map<String, dynamic>.from(locationData);
    _flushPendingDriverLocation();
  }

  void _flushPendingDriverLocation() {
    final Map<String, dynamic>? location = _pendingDriverLocation;
    if (location == null ||
        !_locationTrackingReady ||
        _socket == null ||
        !_socket!.connected) {
      return;
    }
    _socket!.emit('driver-location-update', location);
  }

  /// Called whenever authenticated location handlers are ready, including
  /// after automatic Socket.IO reconnects.
  void onLocationTrackingReady(void Function() callback) {
    _locationTrackingReadyCallback = callback;
    if (_locationTrackingReady && isConnected) {
      callback();
    }
  }

  /// User emits their location update
  /// Data: { userId, lat, long }
  void emitUserLocationUpdate(Map<String, dynamic> locationData) =>
      emit('user-location-update', locationData);

  /// User listens for nearby drivers updates
  /// Callback receives: [{ driverId, lat, long, fullName, vehicleType, ... }, ...]
  void onDriversNearby(Function(dynamic) callback) {
    _driversNearbyCallback = callback;
    if (_socket != null) {
      _socket!.off('drivers-nearby');
      _socket!.on('drivers-nearby', callback);
    }
  }

  /// Driver listens for customer location during active booking
  /// Callback receives: { userId, lat, long }
  void onCustomerLocation(Function(dynamic) callback) =>
      on('customer-location', callback);

  /// User joins a room to receive driver updates for a specific city
  /// Data: { city, vehicleType?, lat?, long? }
  void emitJoinCityRoom(
    String city, {
    String? vehicleType,
    double? latitude,
    double? longitude,
    void Function(dynamic response)? onAck,
  }) {
    final Map<String, dynamic> payload = <String, dynamic>{
      'city': city,
      if (vehicleType != null && vehicleType.trim().isNotEmpty)
        'vehicleType': vehicleType,
      if (latitude != null) 'lat': latitude,
      if (longitude != null) 'long': longitude,
    };
    if (onAck == null) {
      emit('join-city-room', payload);
    } else {
      emitWithAck('join-city-room', payload, onAck);
    }
  }

  /// User leaves city room
  void emitLeaveCityRoom(String city) =>
      emit('leave-city-room', {'city': city});

  void joinRide(String rideId, void Function(dynamic response) callback) =>
      emitWithAck('ride:join', <String, dynamic>{'rideId': rideId}, callback);

  void leaveRide(String rideId) =>
      emit('ride:leave', <String, dynamic>{'rideId': rideId});

  void emitRideDriverLocation(
    String rideId,
    Map<String, dynamic> location,
    void Function(dynamic response) callback,
  ) =>
      emitWithAck(
        'ride:driver_location',
        <String, dynamic>{'rideId': rideId, ...location},
        callback,
      );
}
