import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:shimmer/shimmer.dart';

import '../../../../common/colors.dart';
import '../../../../common/text_styles.dart';
import '../../../data/apis/api_models/driver_profile_models.dart';
import '../controllers/driver_profile_controller.dart';

const Color _pageColor = Color(0xFFF6F7F9);
const Color _lineColor = Color(0xFFE7E8EC);
const double _radius = 12;

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
        return CustomScrollView(
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
                  const SizedBox(height: 16),
                  _buildInfoSection(profile),
                  if (profile.vehicle.displayName.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    _buildVehicleSection(profile),
                  ],
                  if (profile.bio.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    _buildAboutSection(profile),
                  ],
                  const SizedBox(height: 16),
                  _buildReviewsSummary(profile),
                  const SizedBox(height: 16),
                  _buildRecentReviews(),
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
      leading: IconButton(
        icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
        onPressed: () => Get.back(),
      ),
      title: Text(
        profile.fullName.isNotEmpty ? profile.fullName : 'Driver Profile',
        style: MyTextStyle.titleStyle16bb,
      ),
      centerTitle: true,
      actions: [
        Obx(() => IconButton(
              icon: Icon(
                controller.isFavorite.value
                    ? Icons.favorite_rounded
                    : Icons.favorite_border_rounded,
                color: controller.isFavorite.value ? primaryColor : Colors.grey,
                size: 22,
              ),
              onPressed: controller.toggleFavorite,
            )),
      ],
    );
  }

  Widget _buildProfileHeader(PublicDriverProfile profile) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
      decoration: const BoxDecoration(
        color: primary3Color,
        border: Border(bottom: BorderSide(color: _lineColor, width: 0.5)),
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
                Container(
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
                Icon(Icons.verified_rounded, size: 20, color: primaryColor),
              ],
            ],
          ),
          const SizedBox(height: 6),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (profile.rating != null) ...[
                Icon(Icons.star_rounded, size: 18, color: amberColor),
                const SizedBox(width: 2),
                Text(
                  profile.rating!.toStringAsFixed(2),
                  style: MyTextStyle.titleStyle14bb.copyWith(color: amberColor),
                ),
                const SizedBox(width: 4),
                Text(
                  '· ${profile.reviewsSummary.completedTrips} trips',
                  style: MyTextStyle.titleStyle13b.copyWith(color: text2Color),
                ),
              ] else ...[
                Text(
                  '${profile.reviewsSummary.completedTrips} trips',
                  style: MyTextStyle.titleStyle13b.copyWith(color: text2Color),
                ),
              ],
            ],
          ),
          const SizedBox(height: 8),
          _AvailabilityBadge(status: profile.availabilityStatus),
          if (profile.ranking?.position != null) ...[
            const SizedBox(height: 8),
            Text(
              '#${profile.ranking!.position} in rankings',
              style: MyTextStyle.titleStyle12b.copyWith(
                color: primaryColor,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildBadges(PublicDriverProfile profile) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Wrap(
        spacing: 8,
        runSpacing: 6,
        children: profile.badges.map((badge) {
          return Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: primaryColor.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: primaryColor.withValues(alpha: 0.2)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(_badgeIcon(badge), size: 14, color: primaryColor),
                const SizedBox(width: 4),
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
    if (badge.contains('Verified')) return Icons.verified_rounded;
    if (badge.contains('Top Rated')) return Icons.star_rounded;
    if (badge.contains('Elite')) return Icons.diamond_rounded;
    if (badge.contains('Experienced')) return Icons.workspace_premium_rounded;
    if (badge.contains('Airport')) return Icons.flight_rounded;
    if (badge.contains('Rising')) return Icons.trending_up_rounded;
    return Icons.badge_rounded;
  }

  Widget _buildInfoSection(PublicDriverProfile profile) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: primary3Color,
          borderRadius: BorderRadius.circular(_radius),
          border: Border.all(color: _lineColor),
        ),
        child: Row(
          children: [
            if (profile.languages.isNotEmpty) ...[
              _InfoItem(
                icon: Icons.language_rounded,
                label: 'Languages',
                value: profile.languages.join(' · '),
              ),
              const SizedBox(width: 16),
            ],
            if (profile.experienceYears != null) ...[
              _InfoItem(
                icon: Icons.work_history_rounded,
                label: 'Experience',
                value: '${profile.experienceYears} Years',
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildVehicleSection(PublicDriverProfile profile) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: primary3Color,
          borderRadius: BorderRadius.circular(_radius),
          border: Border.all(color: _lineColor),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.directions_car_rounded, size: 18, color: primaryColor),
                const SizedBox(width: 8),
                Text('Vehicle', style: MyTextStyle.titleStyle14bb),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              profile.vehicle.displayName,
              style: MyTextStyle.titleStyle16bb,
            ),
            if (profile.vehicle.registration.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(
                profile.vehicle.registration,
                style: MyTextStyle.titleStyle13b.copyWith(color: text2Color),
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
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.info_outline_rounded, size: 18, color: primaryColor),
                const SizedBox(width: 8),
                Text('About', style: MyTextStyle.titleStyle14bb),
              ],
            ),
            const SizedBox(height: 10),
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
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.rate_review_rounded, size: 18, color: primaryColor),
                const SizedBox(width: 8),
                Text('Reviews', style: MyTextStyle.titleStyle14bb),
                const Spacer(),
                Text(
                  '${summary.totalReviews} reviews',
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
                const SizedBox(width: 8),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildStars(summary.averageRating),
                    const SizedBox(height: 2),
                    Text(
                      '${summary.completedTrips} completed rides',
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
          return Icon(Icons.star_rounded, size: 16, color: amberColor);
        } else if (index < rating) {
          return Icon(Icons.star_half_rounded, size: 16, color: amberColor);
        }
        return Icon(Icons.star_border_rounded, size: 16, color: amberColor);
      }),
    );
  }

  Widget _buildRatingDistribution(Map<String, int> distribution) {
    if (distribution.isEmpty) return const SizedBox.shrink();
    return Column(
      children: [5, 4, 3, 2, 1].map((stars) {
        final percentage = distribution[stars.toString()] ?? 0;
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 2),
          child: Row(
            children: [
              SizedBox(
                width: 20,
                child: Text(
                  '$stars',
                  style: MyTextStyle.titleStyle12b.copyWith(color: text2Color),
                  textAlign: TextAlign.right,
                ),
              ),
              const SizedBox(width: 4),
              Icon(Icons.star_rounded, size: 12, color: amberColor),
              const SizedBox(width: 6),
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(2),
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
              const SizedBox(width: 6),
              SizedBox(
                width: 32,
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

  Widget _buildRecentReviews() {
    return Obx(() {
      if (controller.reviews.isEmpty && !controller.reviewsLoading.value) {
        return const SizedBox.shrink();
      }
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text('Recent Reviews', style: MyTextStyle.titleStyle14bb),
                const Spacer(),
                _SortChip(
                  label: 'Recent',
                  selected: controller.reviewsSort.value == 'recent',
                  onTap: () => controller.changeSort('recent'),
                ),
                const SizedBox(width: 6),
                _SortChip(
                  label: 'Highest',
                  selected: controller.reviewsSort.value == 'highest',
                  onTap: () => controller.changeSort('highest'),
                ),
                const SizedBox(width: 6),
                _SortChip(
                  label: 'Lowest',
                  selected: controller.reviewsSort.value == 'lowest',
                  onTap: () => controller.changeSort('lowest'),
                ),
              ],
            ),
            const SizedBox(height: 10),
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
              TextButton(
                onPressed: controller.loadMoreReviews,
                child: Text(
                  'Load more reviews',
                  style: MyTextStyle.titleStyle13b.copyWith(color: primaryColor),
                ),
              ),
          ],
        ),
      );
    });
  }

  Widget _buildBottomCTA(PublicDriverProfile profile) {
    return Container(
      padding: EdgeInsets.fromLTRB(
        16,
        12,
        16,
        MediaQuery.of(Get.context!).padding.bottom + 12,
      ),
      decoration: const BoxDecoration(
        color: primary3Color,
        border: Border(top: BorderSide(color: _lineColor, width: 0.5)),
      ),
      child: SizedBox(
        height: 52,
        child: ElevatedButton(
          onPressed: () {
            // Navigate to request ride flow
            Get.back();
          },
          style: ElevatedButton.styleFrom(
            backgroundColor: primaryColor,
            foregroundColor: primary3Color,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            elevation: 0,
          ),
          child: Text(
            'Request Ride',
            style: MyTextStyle.titleStyle16bw,
          ),
        ),
      ),
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
              'Unable to load profile',
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
              ),
              child: const Text('Retry'),
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
        color: primaryColor.withValues(alpha: 0.1),
        border: Border.all(color: primaryColor.withValues(alpha: 0.2), width: 2),
      ),
      child: ClipOval(
        child: imageUrl.isNotEmpty
            ? CachedNetworkImage(
                imageUrl: imageUrl,
                fit: BoxFit.cover,
                placeholder: (_, __) => Container(
                  color: Colors.grey.shade200,
                  child: Icon(Icons.person_rounded, size: radius, color: Colors.grey),
                ),
                errorWidget: (_, __, ___) => Container(
                  color: Colors.grey.shade200,
                  child: Icon(Icons.person_rounded, size: radius, color: Colors.grey),
                ),
              )
            : Container(
                color: Colors.grey.shade200,
                child: Icon(Icons.person_rounded, size: radius, color: Colors.grey),
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
        label = 'Online';
        break;
      case 'busy':
        color = amberColor;
        label = 'Busy';
        break;
      default:
        color = Colors.grey;
        label = 'Offline';
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Text(
        label.toUpperCase(),
        style: MyTextStyle.titleStyle12b.copyWith(
          color: color,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.5,
        ),
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
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 14, color: primaryColor),
              const SizedBox(width: 4),
              Text(
                label,
                style: MyTextStyle.titleStyle11b.copyWith(color: text2Color),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(value, style: MyTextStyle.titleStyle14bb),
        ],
      ),
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
                      : 'Passenger',
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
    if (diff.inDays == 0) return 'Today';
    if (diff.inDays == 1) return 'Yesterday';
    if (diff.inDays < 7) return '${diff.inDays} days ago';
    if (diff.inDays < 30) return '${(diff.inDays / 7).floor()} weeks ago';
    return '${(diff.inDays / 30).floor()} months ago';
  }
}
