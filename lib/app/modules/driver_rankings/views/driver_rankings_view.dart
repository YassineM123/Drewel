import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:shimmer/shimmer.dart';

import '../../../../common/colors.dart';
import '../../../../common/text_styles.dart';
import '../../../data/apis/api_models/driver_profile_models.dart';
import '../../../routes/app_pages.dart';
import '../controllers/driver_rankings_controller.dart';

const Color _pageColor = Color(0xFFF6F7F9);
const Color _lineColor = Color(0xFFE7E8EC);

class DriverRankingsView extends GetView<DriverRankingsController> {
  const DriverRankingsView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _pageColor,
      appBar: AppBar(
        backgroundColor: primary3Color,
        surfaceTintColor: primary3Color,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => Get.back(),
        ),
        title: Text('Top Drivers', style: MyTextStyle.titleStyle20bb),
        centerTitle: true,
      ),
      body: Obx(() {
        if (controller.loading.value && controller.rankings.isEmpty) {
          return _buildSkeleton();
        }
        if (controller.error.value.isNotEmpty && controller.rankings.isEmpty) {
          return _buildError();
        }
        return RefreshIndicator(
          onRefresh: controller.refreshAll,
          child: ListView.builder(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            itemCount: controller.rankings.length + (controller.hasMore.value ? 1 : 0),
            itemBuilder: (context, index) {
              if (index == controller.rankings.length) {
                return _buildLoadMore();
              }
              return _buildRankingCard(controller.rankings[index], index);
            },
          ),
        );
      }),
    );
  }

  Widget _buildRankingCard(DriverRankingItem item, int index) {
    final isTopThree = item.position <= 3;
    final Color accentColor;
    if (item.position == 1) {
      accentColor = const Color(0xFFFFB800);
    } else if (item.position == 2) {
      accentColor = const Color(0xFF9E9E9E);
    } else if (item.position == 3) {
      accentColor = const Color(0xFFCD7F32);
    } else {
      accentColor = primaryColor;
    }

    return GestureDetector(
      onTap: () => Get.toNamed(
        Routes.PUBLIC_DRIVER_PROFILE,
        arguments: item.driver.id,
      ),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: primary3Color,
          borderRadius: BorderRadius.circular(isTopThree ? 14 : 10),
          border: Border.all(
            color: isTopThree ? accentColor.withValues(alpha: 0.3) : _lineColor,
            width: isTopThree ? 1.5 : 1,
          ),
        ),
        child: Row(
          children: [
            SizedBox(
              width: 40,
              child: isTopThree
                  ? Container(
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        color: accentColor.withValues(alpha: 0.12),
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: accentColor.withValues(alpha: 0.3),
                        ),
                      ),
                      child: Center(
                        child: Text(
                          '#${item.position}',
                          style: MyTextStyle.titleStyle12bb.copyWith(
                            color: accentColor,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    )
                  : Text(
                      '#${item.position}',
                      style: MyTextStyle.titleStyle14bb.copyWith(
                        color: text2Color,
                      ),
                      textAlign: TextAlign.center,
                    ),
            ),
            const SizedBox(width: 12),
            ClipOval(
              child: SizedBox(
                width: 48,
                height: 48,
                child: item.driver.profileImageUrl.isNotEmpty
                    ? CachedNetworkImage(
                        imageUrl: item.driver.profileImageUrl,
                        fit: BoxFit.cover,
                        placeholder: (_, __) => Container(
                          color: Colors.grey.shade200,
                          child: Icon(Icons.person, color: Colors.grey.shade400, size: 24),
                        ),
                        errorWidget: (_, __, ___) => Container(
                          color: Colors.grey.shade200,
                          child: Icon(Icons.person, color: Colors.grey.shade400, size: 24),
                        ),
                      )
                    : Container(
                        color: primaryColor.withValues(alpha: 0.1),
                        child: const Icon(Icons.person, color: primaryColor, size: 24),
                      ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          item.driver.fullName,
                          style: MyTextStyle.titleStyle14bb,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      if (item.driver.isVerified) ...[
                        const SizedBox(width: 4),
                        const Icon(Icons.verified_rounded, size: 16, color: primaryColor),
                      ],
                    ],
                  ),
                  const SizedBox(height: 3),
                  Row(
                    children: [
                      const Icon(Icons.star_rounded, size: 14, color: amberColor),
                      const SizedBox(width: 2),
                      Text(
                        item.ranking.weightedRating.toStringAsFixed(2),
                        style: MyTextStyle.titleStyle12b.copyWith(
                          color: amberColor,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        '${item.ranking.completedTrips} trips',
                        style: MyTextStyle.titleStyle12b.copyWith(color: text2Color),
                      ),
                    ],
                  ),
                  const SizedBox(height: 3),
                  if (item.driver.vehicleModel.isNotEmpty || item.driver.vehicleType.isNotEmpty)
                    Text(
                      [item.driver.vehicleType, item.driver.vehicleModel]
                          .where((s) => s.isNotEmpty)
                          .join(' · '),
                      style: MyTextStyle.titleStyle11b.copyWith(color: text2Color),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, size: 20, color: text2Color),
          ],
        ),
      ),
    );
  }

  Widget _buildLoadMore() {
    return Obx(() {
      if (controller.loadingMore.value) {
        return const Padding(
          padding: EdgeInsets.all(16),
          child: Center(
            child: SizedBox(
              width: 24,
              height: 24,
              child: CircularProgressIndicator(strokeWidth: 2, color: primaryColor),
            ),
          ),
        );
      }
      if (!controller.hasMore.value) return const SizedBox.shrink();
      return TextButton(
        onPressed: controller.loadMore,
        child: Text(
          'Load more',
          style: MyTextStyle.titleStyle13b.copyWith(color: primaryColor),
        ),
      );
    });
  }

  Widget _buildSkeleton() {
    return Shimmer.fromColors(
      baseColor: Colors.grey.shade300,
      highlightColor: Colors.grey.shade100,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: 8,
        itemBuilder: (_, __) => Container(
          margin: const EdgeInsets.only(bottom: 10),
          height: 76,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(10),
          ),
        ),
      ),
    );
  }

  Widget _buildError() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.error_outline, size: 48, color: primaryColor.withValues(alpha: 0.5)),
          const SizedBox(height: 16),
          Text('Unable to load rankings', style: MyTextStyle.titleStyle16bb),
          const SizedBox(height: 8),
          ElevatedButton(
            onPressed: controller.loadRankings,
            style: ElevatedButton.styleFrom(
              backgroundColor: primaryColor,
              foregroundColor: primary3Color,
            ),
            child: const Text('Retry'),
          ),
        ],
      ),
    );
  }
}
