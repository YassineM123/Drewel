import 'package:flutter/cupertino.dart';
import 'package:get/get.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../../common/socket_services.dart';
import '../../../data/apis/api_constants/api_key_constants.dart';
import '../../../data/apis/api_constants/api_url_constants.dart';
import '../../../data/apis/api_models/get_chat_model.dart';

class SupportChatController extends GetxController with WidgetsBindingObserver {
  final SocketService socketService = SocketService();
  TextEditingController messageController = TextEditingController();
  ScrollController scrollController = ScrollController();
  String adminId = '6861224ceac0edaf19ffa056';
  String userId = '';
  String userToken = '';
  String userType = ''; // 'driver' or 'user'
  List<ChatMessageModel> messageList = [];

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

    print("Invalid message format received.");
    isLoading.value = false;
  }

  void keyBoardInitialize() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final bottomInset = WidgetsBinding.instance.window.viewInsets.bottom;
      if (bottomInset > 0) {
        scrollToBottom();
      }

      // Listen for future changes in keyboard
      WidgetsBinding.instance.addObserver(
        LifecycleEventHandler(resumeCallBack: () async {
          Future.delayed(const Duration(milliseconds: 200), () {
            scrollToBottom();
          });
        }),
      );
    });
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
    print("self:-$userId    , admin:$adminId");
    print("user token:$userToken");

    // Connect to WebSocket
    socketService.connect(ApiUrlConstants.socketUrl, userToken);

    // Listen to the connection status
    socketService.on('connect', (_) {
      print('Socket connected. Emitting message-page event....$adminId');
      socketService.emit('message-page', adminId); // Fetch previous messages
    });

    // Handle messages - both previous and new messages come through 'message' event
    socketService.onMessage((newMessage) {
      print('Message received: $newMessage');
      _handleIncomingMessage(newMessage);
    });

    // Handle old messages from 'message-page' event (backup handler)
    socketService.onMessagePage((data) {
      print("Received from message-page event: $data");
      _handleIncomingMessage(data);
      print("Previous messages count: ${messageList.length}");
    });

    // Online user listener
    socketService.onOnlineUser((onlineUsers) {
      print('Online Users: $onlineUsers');
    });

    // Conversation listener
    socketService.onConversation((conversation) {
      print('Updated Conversation: $conversation');
    });

    // Stop loading after 5 seconds regardless (timeout)
    Future.delayed(const Duration(seconds: 5), () {
      if (isLoading.value) {
        print('Loading timeout - stopping loader');
        isLoading.value = false;
      }
    });
  }

  void sendMessage() async {
    print('start sending1....');
    String? imageUrl;
    // if(selectedFile!=null){
    //   imageUrl= await CloudinaryService.uploadImage(selectedFile!);
    // }
    String text = messageController.text.trim();
    if (text.isEmpty) return;

    final messageData = {
      'sender': userId,
      'receiver': adminId,
      'text': text,
      'msgByUserId': userId,
      'userType': userType, // Send user type (driver/user) with message
      'imageUrl': imageUrl ?? ''
    };
    print('start sending2....${messageData.toString()}');

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
}

class LifecycleEventHandler extends WidgetsBindingObserver {
  final Future<void> Function()? resumeCallBack;
  final Future<void> Function()? pauseCallBack;

  LifecycleEventHandler({this.resumeCallBack, this.pauseCallBack});

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    switch (state) {
      case AppLifecycleState.resumed:
        if (resumeCallBack != null) {
          resumeCallBack!();
        }
        break;
      case AppLifecycleState.paused:
        if (pauseCallBack != null) {
          pauseCallBack!();
        }
        break;
      default:
        break;
    }
  }
}
