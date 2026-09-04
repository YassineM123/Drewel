import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:intl/intl.dart';

import '../../../../common/colors.dart';
import '../../../../common/drewel_app_bar.dart';
import '../../../../common/text_styles.dart';
import '../../../data/apis/api_models/ride_conversation_model.dart';
import '../controllers/messages_controller.dart';

class MessagesView extends GetView<MessagesController> {
  const MessagesView({super.key});

  static const List<String> _filters = <String>['all', 'active', 'completed'];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFCFCFC),
      appBar: const DrewelAppBar(title: 'Messages', showBackButton: true),
      body: SafeArea(
        top: false,
        child: Column(
          children: <Widget>[
            _MessagesToolbar(
              filters: _filters,
              onSearchChanged: controller.onSearchChanged,
              selectedFilter: controller.statusFilter,
              onFilterChanged: controller.setStatusFilter,
            ),
            Expanded(
              child: Obx(() {
                if (controller.loading.value &&
                    controller.conversations.isEmpty) {
                  return const Center(
                    child: CircularProgressIndicator(color: primaryColor),
                  );
                }
                if (controller.error.value.isNotEmpty &&
                    controller.conversations.isEmpty) {
                  return _ErrorState(
                    message: controller.error.value,
                    onRetry: controller.refreshList,
                  );
                }
                if (controller.conversations.isEmpty) {
                  return const _EmptyState();
                }
                return RefreshIndicator(
                  onRefresh: controller.refreshList,
                  child: ListView.separated(
                    padding: const EdgeInsets.only(bottom: 12),
                    physics: const AlwaysScrollableScrollPhysics(),
                    itemCount: controller.conversations.length,
                    separatorBuilder: (_, __) => const Divider(
                      height: 1,
                      indent: 84,
                      endIndent: 12,
                      color: Color(0xFFF0F0F0),
                    ),
                    itemBuilder: (BuildContext context, int index) {
                      final RideConversationModel conversation =
                          controller.conversations[index];
                      return _ConversationTile(
                        conversation: conversation,
                        onTap: () =>
                            controller.openConversation(conversation.rideId),
                      );
                    },
                  ),
                );
              }),
            ),
          ],
        ),
      ),
    );
  }
}

class _MessagesToolbar extends StatelessWidget {
  const _MessagesToolbar({
    required this.filters,
    required this.onSearchChanged,
    required this.selectedFilter,
    required this.onFilterChanged,
  });

  final List<String> filters;
  final ValueChanged<String> onSearchChanged;
  final RxString selectedFilter;
  final ValueChanged<String> onFilterChanged;

  @override
  Widget build(BuildContext context) => Container(
        color: primary3Color,
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
        child: Column(
          children: <Widget>[
            _SearchField(onChanged: onSearchChanged),
            const SizedBox(height: 10),
            Obx(
              () => Row(
                children: <Widget>[
                  for (final String filter in filters)
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 4),
                        child: _FilterChip(
                          label: switch (filter) {
                            'active' => 'Active',
                            'completed' => 'Completed',
                            _ => 'All',
                          },
                          selected: selectedFilter.value == filter,
                          onTap: () => onFilterChanged(filter),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      );
}

class _SearchField extends StatelessWidget {
  const _SearchField({required this.onChanged});

  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return TextField(
      onChanged: onChanged,
      textInputAction: TextInputAction.search,
      decoration: InputDecoration(
        hintText: 'search_messages_hint'.tr,
        prefixIcon: const Icon(Icons.search_rounded, color: text2Color),
        filled: true,
        fillColor: const Color(0xFFF1F1F1),
        contentPadding: const EdgeInsets.symmetric(vertical: 12),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide.none,
        ),
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? primaryColor : const Color(0xFFF1F1F1),
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Center(
            child: Text(
              label,
              style: TextStyle(
                color: selected ? Colors.white : text2Color,
                fontWeight: FontWeight.w700,
                fontSize: 13,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _ConversationTile extends StatelessWidget {
  const _ConversationTile({required this.conversation, required this.onTap});

  final RideConversationModel conversation;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final ConversationCounterpartModel? counterpart = conversation.counterpart;
    final bool isDriver = counterpart?.role == 'driver';
    final String? image = counterpart?.profileImageUrl;
    final String? vehicle = isDriver
        ? <String?>[
            counterpart?.vehicleType,
            counterpart?.vehicleModel,
          ]
            .where((String? value) => value != null && value.isNotEmpty)
            .join(' · ')
        : null;
    final String subtitle = _subtitle(counterpart, vehicle);
    final bool unread = conversation.hasUnread;

    return Material(
      color: Colors.white,
      child: ListTile(
        onTap: onTap,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        leading: Stack(
          clipBehavior: Clip.none,
          children: <Widget>[
            CircleAvatar(
              radius: 28,
              backgroundColor: primaryColor.withValues(alpha: 0.12),
              backgroundImage: image != null && image.isNotEmpty
                  ? NetworkImage(image)
                  : null,
              child: image == null || image.isEmpty
                  ? Icon(
                      isDriver
                          ? Icons.local_taxi_rounded
                          : Icons.person_rounded,
                      color: primaryColor,
                    )
                  : null,
            ),
            if (unread)
              Positioned(
                right: 0,
                top: 0,
                child: Container(
                  width: 12,
                  height: 12,
                  decoration: BoxDecoration(
                    color: primaryColor,
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white, width: 2),
                  ),
                ),
              ),
          ],
        ),
        title: Row(
          children: <Widget>[
            Expanded(
              child: Text(
                counterpart?.displayName ?? 'Ride participant',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: MyTextStyle.titleStyle16bb.copyWith(
                  fontWeight: unread ? FontWeight.w800 : FontWeight.w600,
                ),
              ),
            ),
            if (conversation.lastMessageAt != null)
              Text(
                _timeLabel(conversation.lastMessageAt!),
                style: TextStyle(
                  fontSize: 12,
                  color: unread ? primaryColor : text2Color,
                  fontWeight: unread ? FontWeight.w700 : FontWeight.w500,
                ),
              ),
          ],
        ),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 2),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Expanded(
                child: Text(
                  subtitle,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 14,
                    color: unread ? textColor : text2Color,
                    fontWeight: unread ? FontWeight.w600 : FontWeight.w400,
                  ),
                ),
              ),
              if (unread)
                Container(
                  margin: const EdgeInsets.only(left: 8),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: primaryColor,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    conversation.myUnreadCount > 99
                        ? '99+'
                        : '${conversation.myUnreadCount}',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  String _subtitle(
    ConversationCounterpartModel? counterpart,
    String? vehicle,
  ) {
    final ConversationLastMessageModel? last = conversation.lastMessage;
    final String prefix;
    if (counterpart == null) {
      prefix = '';
    } else if (counterpart.role == 'driver') {
      prefix = vehicle == null || vehicle.isEmpty
          ? '${counterpart.displayName} • Ride ${conversation.rideReference ?? ''}'
          : '$vehicle • ${conversation.rideReference ?? ''}'.trim();
    } else {
      prefix = 'Rider • ${conversation.rideReference ?? 'Ride'}'.trim();
    }
    if (last == null || last.preview.trim().isEmpty) {
      return prefix.isEmpty ? 'No messages yet' : prefix;
    }
    final String sender = last.senderRole == 'driver'
        ? 'Driver'
        : last.senderRole == 'passenger'
            ? 'Rider'
            : '';
    final String preview = last.preview.trim();
    return prefix.isEmpty
        ? (sender.isEmpty ? preview : '$sender: $preview')
        : '$prefix\n${sender.isEmpty ? preview : '$sender: $preview'}';
  }

  String _timeLabel(DateTime at) {
    final DateTime local = at.toLocal();
    final DateTime now = DateTime.now();
    if (now.year == local.year &&
        now.month == local.month &&
        now.day == local.day) {
      return DateFormat.Hm().format(local);
    }
    if (now.year == local.year) return DateFormat.MMMd().format(local);
    return DateFormat.yMMMd().format(local);
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            const Icon(
              Icons.chat_bubble_outline_rounded,
              size: 56,
              color: Color(0xFFC9C9C9),
            ),
            const SizedBox(height: 16),
            Text(
              'no_conversations_yet'.tr,
              style: const TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: textColor,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'messages_with_participants_appear_here'.tr,
              textAlign: TextAlign.center,
              style: const TextStyle(color: text2Color),
            ),
          ],
        ),
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            const Icon(Icons.wifi_off_rounded, size: 44, color: text2Color),
            const SizedBox(height: 12),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(color: text2Color),
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              style: FilledButton.styleFrom(
                backgroundColor: primaryColor,
                foregroundColor: Colors.white,
              ),
              onPressed: onRetry,
              icon: const Icon(Icons.refresh_rounded),
              label: Text('retry'.tr),
            ),
          ],
        ),
      ),
    );
  }
}
