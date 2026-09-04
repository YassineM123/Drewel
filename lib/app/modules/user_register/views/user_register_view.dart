import 'package:drewel/app/data/constants/image_constants.dart';
import 'package:flutter/material.dart';

import 'package:get/get.dart';
import 'package:responsive_sizer/responsive_sizer.dart';
import 'package:carousel_slider/carousel_slider.dart';
import '../../../../common/colors.dart';
import '../../../../common/common_widgets.dart';
import '../../../../common/drewel_app_bar.dart';
import '../../../../common/drewel_pop_scope.dart';
import '../../../../common/text_styles.dart';
import '../../../data/constants/icons_constant.dart';
import '../../../data/constants/string_constants.dart';
import '../controllers/user_register_controller.dart';

class UserRegisterView extends GetView<UserRegisterController> {
  const UserRegisterView({super.key});
  @override
  Widget build(BuildContext context) {
    return Obx(() {
      controller.count.value;
      return DrewelPopScope(
        fallbackRoute: '/user-type',
        hasUnsavedChanges: controller.hasUnsavedChanges.value,
        child: Scaffold(
            appBar: const DrewelAppBar(
              title: '',
              showBackButton: true,
              fallbackRoute: '/user-type',
            ),
            backgroundColor: primaryColor,
            resizeToAvoidBottomInset: false,
            body: LayoutBuilder(
              builder: (context, constraints) {
                final metrics = _RegisterLayoutMetrics.fromHeight(
                  constraints.maxHeight,
                  MediaQuery.of(context).padding.bottom,
                );

                return SizedBox(
                  height: constraints.maxHeight,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      SizedBox(
                        height: metrics.logoSectionHeight,
                        child: Center(
                          child: CommonWidgets.appIcons(
                            assetName: IconConstants.icLogo,
                            height: metrics.logoHeight,
                            width: metrics.logoWidth,
                            fit: BoxFit.contain,
                          ),
                        ),
                      ),
                      Expanded(
                        child: Container(
                          width: double.infinity,
                          padding: EdgeInsets.fromLTRB(
                            metrics.horizontalPadding,
                            metrics.topPadding,
                            metrics.horizontalPadding,
                            metrics.bottomPadding,
                          ),
                          decoration: BoxDecoration(
                            color: primary3Color,
                            borderRadius: BorderRadius.only(
                              topRight:
                                  Radius.circular(metrics.sheetCornerRadius),
                              topLeft:
                                  Radius.circular(metrics.sheetCornerRadius),
                            ),
                          ),
                          child: CustomScrollView(
                            keyboardDismissBehavior:
                                ScrollViewKeyboardDismissBehavior.onDrag,
                            slivers: [
                              SliverToBoxAdapter(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      StringConstants.confirmYourInformation,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: MyTextStyle.titleStyleCustom(
                                        metrics.titleFontSize,
                                        FontWeight.bold,
                                        Colors.black,
                                        'Poppins',
                                      ),
                                    ),
                                    SizedBox(height: metrics.labelTopGap),
                                    Text(
                                      StringConstants.city,
                                      style: MyTextStyle.titleStyleCustom(
                                        metrics.sectionFontSize,
                                        FontWeight.normal,
                                        Colors.black,
                                        'Poppins',
                                      ),
                                    ),
                                    SizedBox(height: metrics.gridTopGap),
                                    _CityGrid(metrics: metrics),
                                    SizedBox(height: metrics.sectionGap),
                                    Text(
                                      StringConstants.findYourTransport,
                                      style: MyTextStyle.titleStyleCustom(
                                        metrics.sectionFontSize,
                                        FontWeight.normal,
                                        Colors.black,
                                        'Poppins',
                                      ),
                                    ),
                                    SizedBox(height: metrics.transportTopGap),
                                    _TransportGrid(metrics: metrics),
                                    SizedBox(height: metrics.bannerTopGap),
                                    _BannerCarousel(metrics: metrics),
                                    SizedBox(height: metrics.indicatorTopGap),
                                    _BannerIndicator(metrics: metrics),
                                  ],
                                ),
                              ),
                              SliverFillRemaining(
                                hasScrollBody: false,
                                child: Column(
                                  mainAxisAlignment: MainAxisAlignment.end,
                                  children: [
                                    SizedBox(height: metrics.buttonTopGap),
                                    CommonWidgets.commonElevatedButton(
                                      height: metrics.buttonHeight,
                                      borderRadius: metrics.buttonRadius,
                                      onPressed: () {
                                        controller.clickOnFindNowButton();
                                      },
                                      context: context,
                                      child: Text(
                                        StringConstants.findNow,
                                        style: MyTextStyle.titleStyleCustom(
                                          metrics.buttonFontSize,
                                          FontWeight.bold,
                                          Colors.white,
                                          'Poppins',
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      )
                    ],
                  ),
                );
              },
            )),
      );
    });
  }
}

class _RegisterLayoutMetrics {
  const _RegisterLayoutMetrics({
    required this.logoSectionHeight,
    required this.logoHeight,
    required this.logoWidth,
    required this.horizontalPadding,
    required this.topPadding,
    required this.bottomPadding,
    required this.sheetCornerRadius,
    required this.titleFontSize,
    required this.sectionFontSize,
    required this.labelTopGap,
    required this.gridTopGap,
    required this.sectionGap,
    required this.transportTopGap,
    required this.bannerTopGap,
    required this.indicatorTopGap,
    required this.buttonTopGap,
    required this.cityCardHeight,
    required this.cityRowSpacing,
    required this.transportIconBoxHeight,
    required this.transportLabelGap,
    required this.transportLabelHeight,
    required this.transportRowSpacing,
    required this.cardCornerRadius,
    required this.cityFontSize,
    required this.transportFontSize,
    required this.transportIconHeight,
    required this.transportIconWidth,
    required this.waterTankerIconHeight,
    required this.waterTankerIconWidth,
    required this.bannerHeight,
    required this.bannerRadius,
    required this.indicatorHeight,
    required this.activeIndicatorWidth,
    required this.inactiveIndicatorWidth,
    required this.indicatorGap,
    required this.buttonHeight,
    required this.buttonRadius,
    required this.buttonFontSize,
  });

  final double logoSectionHeight;
  final double logoHeight;
  final double logoWidth;
  final double horizontalPadding;
  final double topPadding;
  final double bottomPadding;
  final double sheetCornerRadius;
  final double titleFontSize;
  final double sectionFontSize;
  final double labelTopGap;
  final double gridTopGap;
  final double sectionGap;
  final double transportTopGap;
  final double bannerTopGap;
  final double indicatorTopGap;
  final double buttonTopGap;
  final double cityCardHeight;
  final double cityRowSpacing;
  final double transportIconBoxHeight;
  final double transportLabelGap;
  final double transportLabelHeight;
  final double transportRowSpacing;
  final double cardCornerRadius;
  final double cityFontSize;
  final double transportFontSize;
  final double transportIconHeight;
  final double transportIconWidth;
  final double waterTankerIconHeight;
  final double waterTankerIconWidth;
  final double bannerHeight;
  final double bannerRadius;
  final double indicatorHeight;
  final double activeIndicatorWidth;
  final double inactiveIndicatorWidth;
  final double indicatorGap;
  final double buttonHeight;
  final double buttonRadius;
  final double buttonFontSize;

  double get cityGridHeight => cityCardHeight * 2 + cityRowSpacing;
  double get transportCellHeight =>
      transportIconBoxHeight + transportLabelGap + transportLabelHeight;
  double get transportGridHeight =>
      transportCellHeight * 2 + transportRowSpacing;

  factory _RegisterLayoutMetrics.fromHeight(
    double height,
    double bottomSafeArea,
  ) {
    final double compact = ((height - 600) / 130).clamp(0.0, 1.0);
    double lerp(double small, double large) =>
        small + (large - small) * compact;

    return _RegisterLayoutMetrics(
      // Reclaim unused red header space before compressing the interactive
      // content. This also leaves enough room for the bottom safe area.
      logoSectionHeight: lerp(54, 78),
      logoHeight: lerp(52, 76),
      logoWidth: lerp(150, 190),
      horizontalPadding: lerp(14, 18),
      topPadding: lerp(12, 16),
      bottomPadding: lerp(8, 10) + bottomSafeArea,
      sheetCornerRadius: lerp(28, 38),
      titleFontSize: lerp(16, 20),
      sectionFontSize: lerp(14, 16),
      labelTopGap: lerp(2, 4),
      gridTopGap: lerp(4, 5),
      sectionGap: lerp(5, 7),
      transportTopGap: lerp(4, 5),
      bannerTopGap: lerp(8, 11),
      indicatorTopGap: lerp(7, 8),
      buttonTopGap: lerp(8, 9),
      cityCardHeight: lerp(49, 58),
      cityRowSpacing: lerp(6, 7),
      transportIconBoxHeight: lerp(48, 56),
      transportLabelGap: lerp(4, 5),
      transportLabelHeight: lerp(18, 21),
      transportRowSpacing: lerp(11, 13),
      cardCornerRadius: lerp(10, 12),
      cityFontSize: lerp(12, 14),
      transportFontSize: lerp(11, 12),
      transportIconHeight: lerp(28, 34),
      transportIconWidth: lerp(44, 52),
      waterTankerIconHeight: lerp(37, 45),
      waterTankerIconWidth: lerp(61, 72),
      bannerHeight: lerp(86, 105),
      bannerRadius: lerp(8, 12),
      indicatorHeight: lerp(7, 8),
      activeIndicatorWidth: lerp(24, 30),
      inactiveIndicatorWidth: lerp(7, 8),
      indicatorGap: lerp(2.5, 3),
      buttonHeight: lerp(48, 54),
      buttonRadius: lerp(7, 8),
      buttonFontSize: lerp(15, 18),
    );
  }
}

class _CityGrid extends GetView<UserRegisterController> {
  const _CityGrid({required this.metrics});

  final _RegisterLayoutMetrics metrics;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: metrics.cityGridHeight,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final double crossAxisSpacing = 10.px;
          final double itemWidth =
              (constraints.maxWidth - crossAxisSpacing * 3) / 4;
          return GridView.builder(
            padding: EdgeInsets.zero,
            itemCount: controller.cityList.length,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 4,
              childAspectRatio: itemWidth / metrics.cityCardHeight,
              crossAxisSpacing: crossAxisSpacing,
              mainAxisSpacing: metrics.cityRowSpacing,
            ),
            itemBuilder: (context, index) {
              return GestureDetector(
                onTap: () {
                  controller.clickCityItem(index);
                },
                child: Container(
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    borderRadius:
                        BorderRadius.circular(metrics.cardCornerRadius),
                    border: Border.all(
                      color: controller.cityIndex.value == index
                          ? primaryColor
                          : Colors.black.withValues(alpha: 0.2),
                    ),
                  ),
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    child: Text(
                      controller.cityList[index],
                      style: MyTextStyle.titleStyleCustom(
                        metrics.cityFontSize,
                        controller.cityIndex.value == index
                            ? FontWeight.bold
                            : FontWeight.normal,
                        Colors.black,
                        'Poppins',
                      ),
                      textAlign: TextAlign.center,
                      maxLines: 2,
                    ),
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}

class _TransportGrid extends GetView<UserRegisterController> {
  const _TransportGrid({required this.metrics});

  final _RegisterLayoutMetrics metrics;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: metrics.transportGridHeight,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final double crossAxisSpacing = 10.px;
          final double itemWidth =
              (constraints.maxWidth - crossAxisSpacing * 3) / 4;
          return GridView.builder(
            padding: EdgeInsets.zero,
            itemCount: controller.transportList.length,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 4,
              childAspectRatio: itemWidth / metrics.transportCellHeight,
              crossAxisSpacing: crossAxisSpacing,
              mainAxisSpacing: metrics.transportRowSpacing,
            ),
            itemBuilder: (context, index) {
              final bool selected = controller.transportIndex.value == index;
              return GestureDetector(
                onTap: () {
                  controller.clickOnTransportItem(index);
                },
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Container(
                      height: metrics.transportIconBoxHeight,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        borderRadius:
                            BorderRadius.circular(metrics.cardCornerRadius),
                        border: Border.all(
                          color: selected
                              ? primaryColor
                              : Colors.black.withValues(alpha: 0.2),
                        ),
                      ),
                      child: CommonWidgets.appIcons(
                        assetName:
                            controller.transportList[index]['image'] ?? '',
                        height: index == 7
                            ? metrics.waterTankerIconHeight
                            : metrics.transportIconHeight,
                        width: index == 7
                            ? metrics.waterTankerIconWidth
                            : metrics.transportIconWidth,
                        color: index == 0 ? Colors.black : null,
                      ),
                    ),
                    SizedBox(height: metrics.transportLabelGap),
                    SizedBox(
                      height: metrics.transportLabelHeight,
                      child: FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Text(
                          controller.transportList[index]['name'] ?? '',
                          style: MyTextStyle.titleStyleCustom(
                            metrics.transportFontSize,
                            selected ? FontWeight.bold : FontWeight.normal,
                            Colors.black,
                            'Poppins',
                          ),
                          textAlign: TextAlign.center,
                          maxLines: 1,
                        ),
                      ),
                    ),
                  ],
                ),
              );
            },
          );
        },
      ),
    );
  }
}

class _BannerCarousel extends GetView<UserRegisterController> {
  const _BannerCarousel({required this.metrics});

  final _RegisterLayoutMetrics metrics;

  @override
  Widget build(BuildContext context) {
    final int itemCount =
        controller.bannerList.isEmpty ? 1 : controller.bannerList.length;

    return CarouselSlider(
      carouselController: controller.sliderController,
      items: List.generate(itemCount, (index) {
        final String image = controller.bannerList.isEmpty
            ? ImageConstants.imgBanner
            : controller.bannerList[index].imageUrl ?? ImageConstants.imgBanner;
        return CommonWidgets.imageView(
          image: image,
          height: metrics.bannerHeight,
          width: double.infinity,
          fit: BoxFit.cover,
          borderRadius: BorderRadius.circular(metrics.bannerRadius),
        );
      }),
      options: CarouselOptions(
        height: metrics.bannerHeight,
        viewportFraction: 1.0,
        initialPage: 0,
        enableInfiniteScroll: itemCount > 1,
        reverse: false,
        autoPlay: itemCount > 1,
        pageSnapping: false,
        autoPlayInterval: const Duration(seconds: 4),
        autoPlayAnimationDuration: const Duration(milliseconds: 1000),
        autoPlayCurve: Curves.easeInOut,
        enlargeCenterPage: true,
        enlargeFactor: 0.01,
        scrollDirection: Axis.horizontal,
        onPageChanged: (val, _) {
          controller.currentIndex.value = val;
        },
      ),
    );
  }
}

class _BannerIndicator extends GetView<UserRegisterController> {
  const _BannerIndicator({required this.metrics});

  final _RegisterLayoutMetrics metrics;

  @override
  Widget build(BuildContext context) {
    final int itemCount =
        controller.bannerList.isEmpty ? 1 : controller.bannerList.length;

    return Align(
      alignment: Alignment.center,
      child: SizedBox(
        height: metrics.indicatorHeight,
        child: ListView.builder(
          itemCount: itemCount,
          shrinkWrap: true,
          scrollDirection: Axis.horizontal,
          itemBuilder: (context, index) {
            return Obx(() {
              final bool selected = controller.currentIndex.value == index;
              return Container(
                height: metrics.indicatorHeight,
                margin: EdgeInsets.symmetric(horizontal: metrics.indicatorGap),
                width: selected
                    ? metrics.activeIndicatorWidth
                    : metrics.inactiveIndicatorWidth,
                decoration: BoxDecoration(
                  borderRadius:
                      BorderRadius.circular(metrics.indicatorHeight / 2),
                  color: selected
                      ? const Color(0xff7E7E7E)
                      : const Color(0xFFD1D1D1),
                ),
              );
            });
          },
        ),
      ),
    );
  }
}
