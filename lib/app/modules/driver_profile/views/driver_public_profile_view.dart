import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:shimmer/shimmer.dart';

import '../../../../common/colors.dart';
import '../../../../common/text_styles.dart';
import '../../../data/apis/api_models/driver_profile_models.dart';
import '../../communication/controllers/call_state_controller.dart';
import '../controllers/driver_profile_controller.dart';

const Color _pageColor = Color(0xFFF7F8FA);
const Color _lineColor = Color(0xFFEBECEF);
const double _radius = 16;

class DriverPublicProfileView extends GetView<DriverProfileController> {
  const DriverPublicProfileView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _pageColor,
      body: Obx(() {
        if (controller.loading.value && controller.profile.value == null) {
          return _buildSkeleton();
        }
        if (controller.error.value.isNotEmpty && controller.profile.value == null) {
          return _buildError();
        }
        final profile = controller.profile.value;
        if (profile == null) return const SizedBox.shrink();

        final bool hasInfo = profile.languages.isNotEmpty ||
            profile.experienceYears != null ||
            profile.city.isNotEmpty;

        return CustomScrollView(
          physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
          slivers: [
            _buildAppBar(profile),
            SliverToBoxAdapter(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildProfileHeader(profile),
                  if (profile.badges.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    _buildBadges(profile),
                  ],
                  if (hasInfo) ...[
                    const SizedBox(height: 14),
                    _buildInfoSection(profile),
                  ],
                  if (profile.vehicle.displayName.isNotEmpty) ...[
                    const SizedBox(height: 14),
                    _buildVehicleSection(profile),
                  ],
                  if (profile.bio.isNotEmpty) ...[
                    const SizedBox(height: 14),
                    _buildAboutSection(profile),
                  ],
                  const SizedBox(height: 14),
                  _buildReviewsSummary(profile),
                  const SizedBox(height: 14),
                  _buildRecentReviews(profile),
                  const SizedBox(height: 100),
                ],
              ),
            ),
          ],
        );
      }),
      bottomNavigationBar: Obx(() {
        final profile = controller.profile.value;
        if (profile == null) return const SizedBox.shrink();
        return _buildBottomCTA(profile);
      }),
    );
  }

  Widget _buildAppBar(PublicDriverProfile profile) {
    return SliverAppBar(
      expandedHeight: 0,
      floating: true,
      pinned: true,
      backgroundColor: primary3Color,
      surfaceTintColor: primary3Color,
      elevation: 0.5,
      leading: IconButton(
        icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
        onPressed: () => Get.back(),
      ),
      title: Text(
        profile.fullName.isNotEmpty ? profile.fullName : 'driver_profile'.tr,
        style: MyTextStyle.titleStyle16bb,
      ),
      centerTitle: true,
      actions: [
        Obx(() => IconButton(
              icon: Icon(
                controller.isFavorite.value
                    ? Icons.favorite_rounded
                    : Icons.favorite_border_rounded,
                color: controller.isFavorite.value ? primaryColor : text2Color,
                size: 22,
              ),
              onPressed: controller.toggleFavorite,
            )),
      ],
    );
  }

  Widget _buildProfileHeader(PublicDriverProfile profile) {
    final int completedTrips = profile.reviewsSummary.completedTrips;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
      decoration: const BoxDecoration(
        color: primary3Color,
        border: Border(bottom: BorderSide(color: _lineColor, width: 0.8)),
      ),
      child: Column(
        children: [
          Stack(
            alignment: Alignment.bottomRight,
            children: [
              _ProfileAvatar(
                imageUrl: profile.profileImageUrl,
                radius: 48,
              ),
              if (profile.isOnline)
                Positioned(
                  right: 2,
                  bottom: 2,
                  child: Container(
                    width: 18,
                    height: 18,
                    decoration: BoxDecoration(
                      color: profile.availabilityStatus.toLowerCase() == 'busy'
                          ? amberColor
                          : greenColor,
                      shape: BoxShape.circle,
                      border: Border.all(color: primary3Color, width: 3),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Flexible(
                child: Text(
                  profile.fullName,
                  style: MyTextStyle.titleStyle20bb,
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (profile.isVerified) ...[
                const SizedBox(width: 6),
                const Icon(Icons.verified_rounded, size: 20, color: primaryColor),
              ],
            ],
          ),
          const SizedBox(height: 6),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (profile.rating != null && profile.rating! > 0) ...[
                const Icon(Icons.star_rounded, size: 18, color: amberColor),
                const SizedBox(width: 3),
                Text(
                  profile.rating!.toStringAsFixed(2),
                  style: MyTextStyle.titleStyle14bb.copyWith(color: textColor),
                ),
                const SizedBox(width: 6),
                const Text('·', style: TextStyle(color: text2Color, fontSize: 16)),
                const SizedBox(width: 6),
              ],
              Text(
                '$completedTrips ${'trips'.tr}',
                style: MyTextStyle.titleStyle13b.copyWith(color: text2Color),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _AvailabilityBadge(status: profile.availabilityStatus),
              if (profile.ranking?.position != null) ...[
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: primaryColor.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: primaryColor.withValues(alpha: 0.25)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.emoji_events_rounded, size: 14, color: primaryColor),
                      const SizedBox(width: 4),
                      Text(
                        '#${profile.ranking!.position} ${'in_rankings'.tr}',
                        style: MyTextStyle.titleStyle12b.copyWith(
                          color: primaryColor,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildBadges(PublicDriverProfile profile) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: profile.badges.map((badge) {
          return Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
            decoration: BoxDecoration(
              color: primaryColor.withValues(alpha: 0.06),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: primaryColor.withValues(alpha: 0.2)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(_badgeIcon(badge), size: 14, color: primaryColor),
                const SizedBox(width: 5),
                Text(
                  badge,
                  style: MyTextStyle.titleStyle12b.copyWith(
                    color: primaryColor,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }

  IconData _badgeIcon(String badge) {
    final lower = badge.toLowerCase();
    if (lower.contains('verified')) return Icons.verified_user_rounded;
    if (lower.contains('top') || lower.contains('rated')) return Icons.star_rounded;
    if (lower.contains('elite')) return Icons.diamond_rounded;
    if (lower.contains('experience')) return Icons.workspace_premium_rounded;
    if (lower.contains('airport')) return Icons.flight_rounded;
    if (lower.contains('rising')) return Icons.trending_up_rounded;
    return Icons.shield_rounded;
  }

  Widget _buildInfoSection(PublicDriverProfile profile) {
    final List<Widget> items = [];

    if (profile.languages.isNotEmpty) {
      items.add(
        _InfoItem(
          icon: Icons.language_rounded,
          label: 'languages'.tr,
          value: profile.languages.join(' · '),
        ),
      );
    }
    if (profile.experienceYears != null && profile.experienceYears! > 0) {
      items.add(
        _InfoItem(
          icon: Icons.work_history_rounded,
          label: 'experience'.tr,
          value: '${profile.experienceYears} ${'years'.tr}',
        ),
      );
    }
    if (profile.city.isNotEmpty) {
      items.add(
        _InfoItem(
          icon: Icons.location_on_outlined,
          label: 'city'.tr,
          value: profile.city,
        ),
      );
    }

    if (items.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: primary3Color,
          borderRadius: BorderRadius.circular(_radius),
          border: Border.all(color: _lineColor),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.02),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          children: items
              .map((item) => Expanded(child: item))
              .toList(),
        ),
      ),
    );
  }

  Widget _buildVehicleSection(PublicDriverProfile profile) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: primary3Color,
          borderRadius: BorderRadius.circular(_radius),
          border: Border.all(color: _lineColor),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.02),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(7),
                  decoration: BoxDecoration(
                    color: primaryColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.directions_car_rounded, size: 18, color: primaryColor),
                ),
                const SizedBox(width: 10),
                Text('vehicle'.tr, style: MyTextStyle.titleStyle14bb),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              profile.vehicle.displayName,
              style: MyTextStyle.titleStyle16bb,
            ),
            if (profile.vehicle.registration.isNotEmpty) ...[
              const SizedBox(height: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: _pageColor,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: _lineColor),
                ),
                child: Text(
                  profile.vehicle.registration,
                  style: MyTextStyle.titleStyle12b.copyWith(
                    color: text2Color,
                    letterSpacing: 1.0,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildAboutSection(PublicDriverProfile profile) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: primary3Color,
          borderRadius: BorderRadius.circular(_radius),
          border: Border.all(color: _lineColor),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.02),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(7),
                  decoration: BoxDecoration(
                    color: primaryColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.info_outline_rounded, size: 18, color: primaryColor),
                ),
                const SizedBox(width: 10),
                Text('about'.tr, style: MyTextStyle.titleStyle14bb),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              profile.bio,
              style: MyTextStyle.titleStyle13b.copyWith(
                color: textColor,
                height: 1.5,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildReviewsSummary(PublicDriverProfile profile) {
    final summary = profile.reviewsSummary;
    if (summary.totalReviews == 0) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: primary3Color,
          borderRadius: BorderRadius.circular(_radius),
          border: Border.all(color: _lineColor),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.02),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(7),
                  decoration: BoxDecoration(
                    color: primaryColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.rate_review_rounded, size: 18, color: primaryColor),
                ),
                const SizedBox(width: 10),
                Text('reviews'.tr, style: MyTextStyle.titleStyle14bb),
                const Spacer(),
                Text(
                  '${summary.totalReviews} ${'reviews'.tr}',
                  style: MyTextStyle.titleStyle12b.copyWith(color: text2Color),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Text(
                  summary.averageRating.toStringAsFixed(2),
                  style: MyTextStyle.titleStyle30bb.copyWith(color: textColor),
                ),
                const SizedBox(width: 10),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildStars(summary.averageRating),
                    const SizedBox(height: 3),
                    Text(
                      '${summary.completedTrips} ${'trips'.tr}',
                      style: MyTextStyle.titleStyle12b.copyWith(color: text2Color),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 12),
            _buildRatingDistribution(summary.distribution),
          ],
        ),
      ),
    );
  }

  Widget _buildStars(double rating) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(5, (index) {
        if (index < rating.floor()) {
          return const Icon(Icons.star_rounded, size: 16, color: amberColor);
        } else if (index < rating) {
          return const Icon(Icons.star_half_rounded, size: 16, color: amberColor);
        }
        return const Icon(Icons.star_border_rounded, size: 16, color: amberColor);
      }),
    );
  }

  Widget _buildRatingDistribution(Map<String, int> distribution) {
    if (distribution.isEmpty) return const SizedBox.shrink();
    return Column(
      children: [5, 4, 3, 2, 1].map((stars) {
        final percentage = distribution[stars.toString()] ?? 0;
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 2.5),
          child: Row(
            children: [
              SizedBox(
                width: 16,
                child: Text(
                  '$stars',
                  style: MyTextStyle.titleStyle12b.copyWith(color: text2Color),
                  textAlign: TextAlign.right,
                ),
              ),
              const SizedBox(width: 4),
              const Icon(Icons.star_rounded, size: 12, color: amberColor),
              const SizedBox(width: 8),
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(3),
                  child: LinearProgressIndicator(
                    value: percentage / 100,
                    backgroundColor: _lineColor,
                    valueColor: AlwaysStoppedAnimation<Color>(
                      percentage > 50 ? primaryColor : amberColor,
                    ),
                    minHeight: 6,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(
                width: 36,
                child: Text(
                  '$percentage%',
                  style: MyTextStyle.titleStyle11b.copyWith(color: text2Color),
                  textAlign: TextAlign.right,
                ),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }

  Widget _buildRecentReviews(PublicDriverProfile profile) {
    return Obx(() {
      if (controller.reviews.isEmpty && !controller.reviewsLoading.value) {
        if (profile.reviewsSummary.totalReviews == 0) {
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
              decoration: BoxDecoration(
                color: primary3Color,
                borderRadius: BorderRadius.circular(_radius),
                border: Border.all(color: _lineColor),
              ),
              child: Column(
                children: [
                  Icon(Icons.star_outline_rounded, size: 36, color: primaryColor.withValues(alpha: 0.3)),
                  const SizedBox(height: 8),
                  Text(
                    'no_reviews_yet'.tr,
                    style: MyTextStyle.titleStyle13b.copyWith(color: text2Color),
                  ),
                ],
              ),
            ),
          );
        }
        return const SizedBox.shrink();
      }

      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text('recent_reviews'.tr, style: MyTextStyle.titleStyle14bb),
                const Spacer(),
                _SortChip(
                  label: 'recent'.tr,
                  selected: controller.reviewsSort.value == 'recent',
                  onTap: () => controller.changeSort('recent'),
                ),
                const SizedBox(width: 6),
                _SortChip(
                  label: 'highest'.tr,
                  selected: controller.reviewsSort.value == 'highest',
                  onTap: () => controller.changeSort('highest'),
                ),
                const SizedBox(width: 6),
                _SortChip(
                  label: 'lowest'.tr,
                  selected: controller.reviewsSort.value == 'lowest',
                  onTap: () => controller.changeSort('lowest'),
                ),
              ],
            ),
            const SizedBox(height: 12),
            ...controller.reviews.map((review) => _ReviewCard(review: review)),
            if (controller.reviewsLoading.value)
              const Padding(
                padding: EdgeInsets.all(16),
                child: Center(
                  child: SizedBox(
                    width: 24,
                    height: 24,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: primaryColor,
                    ),
                  ),
                ),
              ),
            if (!controller.reviewsLoading.value &&
                controller.reviewsPage.value < controller.reviewsTotalPages.value)
              Center(
                child: TextButton(
                  onPressed: controller.loadMoreReviews,
                  child: Text(
                    'load_more_reviews'.tr,
                    style: MyTextStyle.titleStyle13b.copyWith(color: primaryColor),
                  ),
                ),
              ),
          ],
        ),
      );
    });
  }

  Future<void> _handleContactDriver(BuildContext context, PublicDriverProfile profile) async {
    if (!Get.isRegistered<CallStateController>()) {
      CommunicationBinding().dependencies();
    }
    final CallStateController communication = Get.find<CallStateController>();
    final String driverId = profile.id.isNotEmpty ? profile.id : controller.driverId;
    if (driverId.isEmpty) return;

    await communication.openDriverChat(driverId);
  }

  Widget _buildBottomCTA(PublicDriverProfile profile) {
    if (!Get.isRegistered<CallStateController>()) {
      CommunicationBinding().dependencies();
    }
    final CallStateController communication = Get.find<CallStateController>();
    final String driverId = profile.id.isNotEmpty ? profile.id : controller.driverId;

    return Container(
      padding: EdgeInsets.fromLTRB(
        16,
        12,
        16,
        MediaQuery.of(Get.context!).padding.bottom + 12,
      ),
      decoration: BoxDecoration(
        color: primary3Color,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, -3),
          ),
        ],
        border: const Border(top: BorderSide(color: _lineColor, width: 0.5)),
      ),
      child: Obx(() {
        final bool isContacting =
            communication.contactingDriverId.value == driverId ||
            (communication.isBusy.value && communication.contactingDriverId.value.isNotEmpty);
        final bool isCoolingDown = communication.isDriverRequestCoolingDown;
        final int cooldownSec = communication.driverRequestCooldownSeconds.value;

        return SizedBox(
          height: 52,
          child: ElevatedButton(
            onPressed: isContacting
                ? null
                : () => _handleContactDriver(Get.context!, profile),
            style: ElevatedButton.styleFrom(
              backgroundColor: primaryColor,
              disabledBackgroundColor: primaryColor.withValues(alpha: 0.6),
              foregroundColor: primary3Color,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              elevation: 0,
            ),
            child: isContacting
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.5,
                      color: primary3Color,
                    ),
                  )
                : Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.chat_bubble_outline_rounded, size: 20, color: primary3Color),
                      const SizedBox(width: 8),
                      Text(
                        isCoolingDown
                            ? '${'request_ride'.tr} (${cooldownSec}s)'
                            : 'request_ride'.tr,
                        style: MyTextStyle.titleStyle16bw,
                      ),
                    ],
                  ),
          ),
        );
      }),
    );
  }

  Widget _buildSkeleton() {
    return Shimmer.fromColors(
      baseColor: Colors.grey.shade300,
      highlightColor: Colors.grey.shade100,
      child: SingleChildScrollView(
        child: Column(
          children: [
            SizedBox(
              height: AppBar().preferredSize.height + MediaQuery.of(Get.context!).padding.top,
              child: Container(color: primary3Color),
            ),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              color: primary3Color,
              child: Column(
                children: [
                  Container(
                    width: 96,
                    height: 96,
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Container(width: 160, height: 18, color: Colors.white),
                  const SizedBox(height: 8),
                  Container(width: 120, height: 14, color: Colors.white),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Container(
                width: double.infinity,
                height: 80,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(_radius),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Container(
                width: double.infinity,
                height: 120,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(_radius),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline_rounded, size: 48, color: primaryColor.withValues(alpha: 0.5)),
            const SizedBox(height: 16),
            Text(
              'unable_load_profile'.tr,
              style: MyTextStyle.titleStyle16bb,
            ),
            const SizedBox(height: 8),
            Text(
              controller.error.value,
              style: MyTextStyle.titleStyle13b.copyWith(color: text2Color),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: controller.loadProfile,
              style: ElevatedButton.styleFrom(
                backgroundColor: primaryColor,
                foregroundColor: primary3Color,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              child: Text('retry'.tr),
            ),
          ],
        ),
      ),
    );
  }
}

class _ProfileAvatar extends StatelessWidget {
  const _ProfileAvatar({required this.imageUrl, required this.radius});

  final String imageUrl;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: radius * 2,
      height: radius * 2,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: primaryColor.withValues(alpha: 0.08),
        border: Border.all(color: primaryColor.withValues(alpha: 0.25), width: 2.5),
        boxShadow: [
          BoxShadow(
            color: primaryColor.withValues(alpha: 0.08),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: ClipOval(
        child: imageUrl.isNotEmpty
            ? CachedNetworkImage(
                imageUrl: imageUrl,
                fit: BoxFit.cover,
                placeholder: (_, __) => Container(
                  color: Colors.grey.shade100,
                  child: Icon(Icons.person_rounded, size: radius, color: Colors.grey.shade400),
                ),
                errorWidget: (_, __, ___) => Container(
                  color: Colors.grey.shade100,
                  child: Icon(Icons.person_rounded, size: radius, color: Colors.grey.shade400),
                ),
              )
            : Container(
                color: Colors.grey.shade100,
                child: Icon(Icons.person_rounded, size: radius, color: Colors.grey.shade400),
              ),
      ),
    );
  }
}

class _AvailabilityBadge extends StatelessWidget {
  const _AvailabilityBadge({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final Color color;
    final String label;
    switch (status.toLowerCase()) {
      case 'online':
        color = greenColor;
        label = 'online'.tr;
        break;
      case 'busy':
        color = amberColor;
        label = 'busy'.tr;
        break;
      default:
        color = Colors.grey;
        label = 'offline'.tr;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 7,
            height: 7,
            decoration: BoxDecoration(
              color: color,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 6),
          Text(
            label.toUpperCase(),
            style: MyTextStyle.titleStyle12b.copyWith(
              color: color,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.5,
            ),
          ),
        ],
      ),
    );
  }
}

class _InfoItem extends StatelessWidget {
  const _InfoItem({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, size: 15, color: primaryColor),
            const SizedBox(width: 5),
            Flexible(
              child: Text(
                label,
                style: MyTextStyle.titleStyle11b.copyWith(color: text2Color),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        Text(
          value,
          style: MyTextStyle.titleStyle13bb.copyWith(color: textColor),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );
  }
}

class _SortChip extends StatelessWidget {
  const _SortChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: selected ? primaryColor : Colors.transparent,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: selected ? primaryColor : _lineColor,
          ),
        ),
        child: Text(
          label,
          style: MyTextStyle.titleStyle12b.copyWith(
            color: selected ? primary3Color : text2Color,
            fontWeight: selected ? FontWeight.w600 : FontWeight.normal,
          ),
        ),
      ),
    );
  }
}

class _ReviewCard extends StatelessWidget {
  const _ReviewCard({required this.review});

  final DriverReview review;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: primary3Color,
        borderRadius: BorderRadius.circular(_radius),
        border: Border.all(color: _lineColor),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 4,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 16,
                backgroundColor: primaryColor.withValues(alpha: 0.1),
                child: Text(
                  review.reviewer.firstName.isNotEmpty
                      ? review.reviewer.firstName[0].toUpperCase()
                      : 'P',
                  style: MyTextStyle.titleStyle14bb.copyWith(color: primaryColor),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  review.reviewer.firstName.isNotEmpty
                      ? '${review.reviewer.firstName}.'
                      : 'passenger'.tr,
                  style: MyTextStyle.titleStyle13bb,
                ),
              ),
              if (review.submittedAt != null)
                Text(
                  _formatDate(review.submittedAt!),
                  style: MyTextStyle.titleStyle11b.copyWith(color: text2Color),
                ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: List.generate(5, (index) {
              return Icon(
                index < review.rating
                    ? Icons.star_rounded
                    : Icons.star_border_rounded,
                size: 16,
                color: amberColor,
              );
            }),
          ),
          if (review.comment.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              review.comment,
              style: MyTextStyle.titleStyle13b.copyWith(
                color: textColor,
                height: 1.4,
              ),
            ),
          ],
        ],
      ),
    );
  }

  String _formatDate(DateTime date) {
    final now = DateTime.now();
    final diff = now.difference(date);
    if (diff.inDays == 0) return 'today'.tr;
    if (diff.inDays == 1) return 'yesterday'.tr;
    if (diff.inDays < 7) return '${diff.inDays}d';
    if (diff.inDays < 30) return '${(diff.inDays / 7).floor()}w';
    return '${(diff.inDays / 30).floor()}m';
  }
}
