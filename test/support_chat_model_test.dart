import 'package:drewel/app/data/apis/api_models/get_chat_model.dart';
import 'package:drewel/app/modules/support_chat/controllers/support_chat_controller.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('support chat message identity', () {
    test('reads a plain sender id', () {
      final message = ChatMessageModel.fromJson(<String, dynamic>{
        '_id': 'message-1',
        'msgByUserId': 'user-1',
        'text': 'Hello',
      });

      expect(message.msgByUserId, 'user-1');
    });

    test('reads a populated sender object', () {
      final message = ChatMessageModel.fromJson(<String, dynamic>{
        '_id': 'message-2',
        'msgByUserId': <String, dynamic>{
          '_id': 'admin-1',
          'fullName': 'Support Agent',
        },
        'text': 'How can I help?',
      });

      expect(message.msgByUserId, 'admin-1');
    });

    test('classifies only the authenticated user message as mine', () {
      final controller = SupportChatController()..userId = 'user-1';

      expect(
        controller.isMyMessage(ChatMessageModel(msgByUserId: 'user-1')),
        isTrue,
      );
      expect(
        controller.isMyMessage(ChatMessageModel(msgByUserId: 'admin-1')),
        isFalse,
      );
    });
  });
}
