import 'dart:convert';

import 'package:drewel/app/data/apis/api_models/ride_conversation_model.dart';
import 'package:drewel/app/data/apis/communication_api_client.dart';
import 'package:drewel/app/data/repositories/active_ride_repository.dart';
import 'package:drewel/app/data/repositories/call_repository.dart';
import 'package:drewel/app/data/repositories/conversation_repository.dart';
import 'package:drewel/app/data/repositories/notification_repository.dart';
import 'package:drewel/app/data/repositories/ride_message_repository.dart';
import 'package:drewel/app/data/services/agora_call_service.dart';
import 'package:drewel/app/modules/communication/controllers/call_state_controller.dart';
import 'package:drewel/app/modules/messages/controllers/messages_controller.dart';
import 'package:drewel/common/socket_services.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get/get.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

const Map<String, dynamic> _conversationJson = <String, dynamic>{
  '_id': 'conv-1',
  'rideId': 'ride-1',
  'status': 'active',
  'rideReference': 'DRW-123',
  'myUnreadCount': 2,
  'counterpart': <String, dynamic>{
    '_id': 'driver-1',
    'role': 'driver',
    'firstName': 'Alex',
    'fullName': 'Alex Robin',
    'vehicleType': 'Sedan',
    'vehicleModel': 'Honda City',
  },
  'lastMessage': <String, dynamic>{
    'preview': 'I am at the pickup now.',
    'senderRole': 'driver',
    'status': 'delivered',
    'at': '2026-08-10T08:00:00.000Z',
  },
  'lastMessageAt': '2026-08-10T08:00:00.000Z',
};

CommunicationApiClient _apiFor(MockClient client) =>
    CommunicationApiClient(client: client);

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues(<String, Object>{
      'token': 'test-token',
    });
  });

  tearDown(() {
    Get.reset();
  });
  testWidgets('MessagesController loads conversations and unread count',
      (WidgetTester tester) async {
    final List<String> listStatuses = <String>[];
    final CommunicationApiClient api = _apiFor(
      MockClient((http.Request request) async {
        if (request.url.path.contains('/notification/get-notifications')) {
          return _json(<String, dynamic>{'notifications': <Object>[]});
        }
        if (request.url.path.contains('/conversations/summary')) {
          return _json(<String, dynamic>{'unreadTotal': 2});
        }
        if (request.url.path.contains('/conversations')) {
          listStatuses.add(request.url.queryParameters['status'] ?? '');
          return _json(<String, dynamic>{
            'conversations': <Map<String, dynamic>>[_conversationJson],
            'unreadTotal': 2,
            'pagination': <String, dynamic>{
              'page': 1,
              'limit': 20,
              'total': 1,
              'totalPages': 1,
            },
          });
        }
        return http.Response('not found', 404);
      }),
    );
    final CallStateController communication = _communication(api);
    await tester.pumpWidget(const GetMaterialApp(
      home: Scaffold(body: SizedBox.expand()),
    ));
    Get.put(communication, permanent: true);
    final MessagesController controller =
        MessagesController(communication: communication);
    Get.put(controller);
    await controller.refreshList();

    expect(controller.conversations, hasLength(1));
    expect(controller.conversations.first.rideId, 'ride-1');
    expect(controller.conversations.first.counterpart?.displayName,
        'Alex Robin');
    expect(controller.conversations.first.hasUnread, isTrue);
    expect(controller.unreadTotal, 2);
    expect(listStatuses, contains('all'));

    controller.setStatusFilter('active');
    await controller.refreshList();
    expect(listStatuses, contains('active'));
  });

  testWidgets('MessagesController reports actionable errors', (
      WidgetTester tester) async {
    final CommunicationApiClient api = _apiFor(
      MockClient((http.Request request) async =>
          http.Response('{"message":"Session expired."}', 401)),
    );
    final CallStateController communication = _communication(api);
    await tester.pumpWidget(const GetMaterialApp(
      home: Scaffold(body: SizedBox.expand()),
    ));
    Get.put(communication, permanent: true);
    final MessagesController controller =
        MessagesController(communication: communication);
    Get.put(controller);
    await controller.refreshList();

    expect(controller.conversations, isEmpty);
    expect(controller.error.value, contains('Session expired'));
  });
}

CallStateController _communication(CommunicationApiClient api) =>
    CallStateController(
      activeRideRepository: ActiveRideRepository(api),
      callRepository: CallRepository(api),
      conversationRepository: ConversationRepository(api),
      messageRepository: RideMessageRepository(api),
      notificationRepository: NotificationRepository(api),
      agoraService: AgoraCallService(),
      socketService: _FakeSocketService(),
    );

class _FakeSocketService extends SocketService {
  @override
  void connect(String url, String token) {}

  @override
  void disconnect() {}

  @override
  void off(String event) {}

  @override
  void on(String event, Function(dynamic) callback) {}
}

http.Response _json(Map<String, dynamic> body) => http.Response(
      jsonEncode(body),
      200,
      headers: <String, String>{'content-type': 'application/json'},
    );
