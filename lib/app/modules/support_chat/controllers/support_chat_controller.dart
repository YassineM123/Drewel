import 'package:flutter/cupertino.dart';
import 'package:get/get.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../../common/socket_services.dart';
import '../../../../common/common_widgets.dart';
import '../../../data/apis/api_constants/api_key_constants.dart';
import '../../../data/apis/api_constants/api_url_constants.dart';
import '../../../data/apis/api_models/get_chat_model.dart';

class SupportChatController extends GetxController with WidgetsBindingObserver {
  final SocketService socketService = SocketService();
  TextEditingController messageController = TextEditingController();
  ScrollController scrollController = ScrollController();
  final String adminId = ApiUrlConstants.supportAdminId;
  String userId = '';
  String userToken = '';
  String userType = ''; // 'driver' or 'user'
  List<ChatMessageModel> messageList = [];
  final supportName = 'Drewel Support'.obs;
  final supportOnline = false.obs;

  final isLoading = true.obs; // Loading state for chat messages
  final count = 0.obs;
  @override
  void onInit() async {
    SharedPreferences prefs = await SharedPreferences.getInstance();
    userId = prefs.getString(ApiKeyConstants.userId) ?? '';
    userToken = prefs.getString(ApiKeyConstants.token) ?? '';
    userType = prefs.getString(ApiKeyConstants.type) ??
        'user'; // Get user type (driver/user)
    super.onInit();
    initializeChat();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void onClose() {
    WidgetsBinding.instance.removeObserver(this);
    scrollController.dispose();
    messageController.dispose();
    socketService.disconnect();
    super.onClose();
  }

  @override
  void didChangeMetrics() {
    // Triggered when keyboard opens or closes
    Future.delayed(const Duration(milliseconds: 300), () {
      if (scrollController.hasClients) {
        scrollController.animateTo(
          scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  void increment() => count.value++;

  bool isMyMessage(ChatMessageModel message) {
    final String senderId = (message.msgByUserId ?? '').trim();
    return senderId.isNotEmpty && senderId == userId.trim();
  }

  void _replaceMessages(List<dynamic> rawMessages) {
    messageList = rawMessages
        .whereType<Map>()
        .map((item) => ChatMessageModel.fromJson(
            Map<String, dynamic>.from(item.cast<String, dynamic>())))
        .toList();
    isLoading.value = false;
    increment();
    scrollToBottom();
  }

  void _upsertMessage(ChatMessageModel incomingMessage) {
    final int existingIndex = (incomingMessage.sId ?? '').isEmpty
        ? -1
        : messageList
            .indexWhere((message) => message.sId == incomingMessage.sId);

    if (existingIndex != -1) {
      messageList[existingIndex] = incomingMessage;
    } else {
      final int pendingIndex = messageList.lastIndexWhere(
        (message) =>
            (message.sId ?? '').isEmpty &&
            message.msgByUserId == incomingMessage.msgByUserId &&
            (message.text ?? '').trim() == (incomingMessage.text ?? '').trim(),
      );

      if (pendingIndex != -1) {
        messageList[pendingIndex] = incomingMessage;
      } else {
        messageList.add(incomingMessage);
      }
    }

    isLoading.value = false;
    increment();
    scrollToBottom();
  }

  void _handleIncomingMessage(dynamic data) {
    if (data is List) {
      _replaceMessages(data);
      return;
    }

    if (data is Map<String, dynamic>) {
      final dynamic messagesData = data['messages'];

      if (messagesData is List) {
        _replaceMessages(messagesData);
        return;
      }

      if (data['text'] != null || data['_id'] != null) {
        _upsertMessage(ChatMessageModel.fromJson(data));
        return;
      }
    }

    isLoading.value = false;
  }

  void scrollToBottom() {
    Future.delayed(const Duration(milliseconds: 100), () {
      if (scrollController.hasClients) {
        scrollController.animateTo(
          scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  void initializeChat() async {
    if (userId.trim().isEmpty ||
        userToken.trim().isEmpty ||
        adminId.trim().isEmpty) {
      isLoading.value = false;
      CommonWidgets.showMyToastMessage(
        'Unable to open support chat. Please sign in again.',
      );
      return;
    }
    // Connect to WebSocket
    socketService.connect(ApiUrlConstants.socketUrl, userToken);

    // Listen to the connection status
    socketService.on('connect', (_) {
      socketService.emit('message-page', adminId); // Fetch previous messages
    });

    // Handle messages - both previous and new messages come through 'message' event
    socketService.onMessage((newMessage) {
      _handleIncomingMessage(newMessage);
    });

    // Handle old messages from 'message-page' event (backup handler)
    socketService.onMessagePage((data) {
      _handleIncomingMessage(data);
    });

    socketService.onMessageUser((data) {
      if (data is! Map) return;
      final Map<String, dynamic> details =
          Map<String, dynamic>.from(data.cast<String, dynamic>());
      final String name = (details['fullName'] ??
              [
                details['firstName'],
                details['lastName'],
              ]
                  .whereType<String>()
                  .where((part) => part.trim().isNotEmpty)
                  .join(' '))
          .toString()
          .trim();
      supportName.value = name.isEmpty ? 'Drewel Support' : name;
      supportOnline.value = details['online'] == true;
    });

    // Online user listener
    socketService.onOnlineUser((_) {});

    // Conversation listener
    socketService.onConversation((_) {});

    // Stop loading after 5 seconds regardless (timeout)
    Future.delayed(const Duration(seconds: 5), () {
      if (isLoading.value) {
        isLoading.value = false;
      }
    });
  }

  void sendMessage() async {
    String? imageUrl;
    // if(selectedFile!=null){
    //   imageUrl= await CloudinaryService.uploadImage(selectedFile!);
    // }
    String text = messageController.text.trim();
    if (text.isEmpty) return;
    if (!socketService.isConnected) {
      CommonWidgets.showMyToastMessage(
        'Chat is offline. Check your connection and try again.',
      );
      return;
    }

    final messageData = {
      'sender': userId,
      'receiver': adminId,
      'text': text,
      'msgByUserId': userId,
      'userType': userType, // Send user type (driver/user) with message
      'imageUrl': imageUrl ?? ''
    };
    messageList.add(
      ChatMessageModel(
        text: text,
        imageUrl: imageUrl ?? '',
        msgByUserId: userId,
        seen: false,
        createdAt: DateTime.now().toIso8601String(),
      ),
    );
    increment();
    scrollToBottom();

    // Emit the new message
    socketService.emitNewMessage(messageData);

    // Clear the input field
    //selectedFile=null;
    messageController.clear();
  }

  String formatMessageTime(ChatMessageModel message) {
    final DateTime? timestamp = DateTime.tryParse(message.createdAt ?? '');
    if (timestamp == null) return '';
    final DateTime local = timestamp.toLocal();
    final String hour = local.hour.toString().padLeft(2, '0');
    final String minute = local.minute.toString().padLeft(2, '0');
    return '$hour:$minute';
  }
}
